const { pool } = require('../config/db');
const { getSupabaseClient, STORAGE_BUCKET } = require('../config/supabase');

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parsePositiveInt(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function safeFileName(name) {
  const cleaned = String(name || 'file')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .slice(0, 100);
  return cleaned.length > 0 ? cleaned : 'file';
}

// Extract the bucket-relative path from a Supabase public URL like
//   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
// Returns null if the URL doesn't look like one of our objects.
function pathFromPublicUrl(url) {
  if (typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function productExists(executor, productId) {
  const { rows } = await executor.query('SELECT id FROM products WHERE id = $1', [productId]);
  return rows.length > 0;
}

async function listProductImages(req, res, next) {
  try {
    const productId = parsePositiveInt(req.params.id);
    if (!productId) return next(makeError(400, 'Invalid product id'));

    if (!(await productExists(pool, productId))) {
      return next(makeError(404, `Product not found: id=${productId}`));
    }

    const { rows } = await pool.query(
      `SELECT id, url, alt_text, position, is_primary
       FROM product_images
       WHERE product_id = $1
       ORDER BY position, id`,
      [productId]
    );
    res.json(rows.map((r) => ({ ...r, is_primary: !!r.is_primary })));
  } catch (err) {
    next(err);
  }
}

async function uploadProductImage(req, res, next) {
  try {
    const productId = parsePositiveInt(req.params.id);
    if (!productId) return next(makeError(400, 'Invalid product id'));

    const file = req.file;
    if (!file) return next(makeError(400, 'file field is required (multipart/form-data)'));
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return next(makeError(400, 'file must be an image (mime type image/*)'));
    }
    if (file.size > 3 * 1024 * 1024) {
      return next(makeError(413, 'File too large (max 3MB)'));
    }

    let altText = null;
    if (req.body && typeof req.body.alt_text === 'string') {
      const trimmed = req.body.alt_text.trim();
      if (trimmed.length > 200) return next(makeError(400, 'alt_text too long (max 200)'));
      if (trimmed.length > 0) altText = trimmed;
    }

    if (!(await productExists(pool, productId))) {
      return next(makeError(404, `Product not found: id=${productId}`));
    }

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (cfgErr) {
      return next(makeError(500, cfgErr.message));
    }

    const path = `products/${productId}/${Date.now()}-${safeFileName(file.originalname)}`;

    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (uploadErr) {
      return next(makeError(500, `Storage upload failed: ${uploadErr.message}`));
    }

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    let inserted;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: countRows } = await client.query(
        'SELECT COUNT(*)::int AS count, COALESCE(MAX(position), -1) AS max_pos FROM product_images WHERE product_id = $1',
        [productId]
      );
      const isFirst = countRows[0].count === 0;
      const nextPosition = countRows[0].max_pos + 1;

      const { rows } = await client.query(
        `INSERT INTO product_images (product_id, url, alt_text, position, is_primary)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, url, alt_text, position, is_primary`,
        [productId, publicUrl, altText, nextPosition, isFirst]
      );
      inserted = rows[0];

      await client.query('COMMIT');
    } catch (dbErr) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      // Best-effort: clean up the uploaded blob since the row failed.
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      } catch (_) { /* ignore */ }
      return next(dbErr);
    } finally {
      client.release();
    }

    res.status(201).json({ ...inserted, is_primary: !!inserted.is_primary });
  } catch (err) {
    next(err);
  }
}

async function deleteProductImage(req, res, next) {
  try {
    const productId = parsePositiveInt(req.params.id);
    const imageId = parsePositiveInt(req.params.imageId);
    if (!productId) return next(makeError(400, 'Invalid product id'));
    if (!imageId) return next(makeError(400, 'Invalid image id'));

    let storagePath = null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: imgRows } = await client.query(
        `SELECT id, url, is_primary
         FROM product_images
         WHERE id = $1 AND product_id = $2`,
        [imageId, productId]
      );
      if (imgRows.length === 0) {
        throw makeError(404, `Image not found: id=${imageId} for product ${productId}`);
      }
      const img = imgRows[0];
      storagePath = pathFromPublicUrl(img.url);

      await client.query(
        'DELETE FROM product_images WHERE id = $1 AND product_id = $2',
        [imageId, productId]
      );

      // If we deleted the primary, promote the next image (lowest position/id).
      if (img.is_primary) {
        const { rows: nextRows } = await client.query(
          `SELECT id FROM product_images
           WHERE product_id = $1
           ORDER BY position, id
           LIMIT 1`,
          [productId]
        );
        if (nextRows.length > 0) {
          await client.query(
            'UPDATE product_images SET is_primary = TRUE WHERE id = $1',
            [nextRows[0].id]
          );
        }
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      return next(dbErr);
    } finally {
      client.release();
    }

    // Remove the file from storage. Best-effort: an orphan blob is recoverable
    // via a cleanup job, but a dangling DB row is not. The DB delete already
    // succeeded, so we never block the response on storage failures.
    if (storagePath) {
      try {
        const supabase = getSupabaseClient();
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      } catch (storageErr) {
        console.warn(
          `[product-images] failed to remove storage object ${storagePath}: ${storageErr.message || storageErr}`
        );
      }
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function setPrimaryProductImage(req, res, next) {
  try {
    const productId = parsePositiveInt(req.params.id);
    const imageId = parsePositiveInt(req.params.imageId);
    if (!productId) return next(makeError(400, 'Invalid product id'));
    if (!imageId) return next(makeError(400, 'Invalid image id'));

    let updated = null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        'SELECT id FROM product_images WHERE id = $1 AND product_id = $2',
        [imageId, productId]
      );
      if (rows.length === 0) {
        throw makeError(404, `Image not found: id=${imageId} for product ${productId}`);
      }

      await client.query(
        'UPDATE product_images SET is_primary = FALSE WHERE product_id = $1 AND is_primary = TRUE',
        [productId]
      );
      const { rows: updRows } = await client.query(
        `UPDATE product_images SET is_primary = TRUE
         WHERE id = $1 AND product_id = $2
         RETURNING id, url, alt_text, position, is_primary`,
        [imageId, productId]
      );
      updated = updRows[0];

      await client.query('COMMIT');
    } catch (dbErr) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      return next(dbErr);
    } finally {
      client.release();
    }

    res.json({ ...updated, is_primary: !!updated.is_primary });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProductImages,
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
};
