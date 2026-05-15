const { pool } = require('../config/db');

// ----- helpers ------------------------------------------------

function parsePositiveInt(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

// Map common PostgreSQL constraint errors to friendly 400 responses so the
// client never sees raw DB error text.
function mapPgError(err) {
  if (!err || !err.code) return err;
  if (err.code === '23505') {
    return makeError(400, `Unique constraint violated${err.constraint ? `: ${err.constraint}` : ''}`);
  }
  if (err.code === '23503') {
    return makeError(400, `Foreign key violation${err.constraint ? `: ${err.constraint}` : ''}`);
  }
  if (err.code === '23514') {
    return makeError(400, `Check constraint violated${err.constraint ? `: ${err.constraint}` : ''}`);
  }
  return err;
}

const PRODUCT_UPDATABLE_FIELDS = [
  'category_id',
  'manufacturer_id',
  'sku',
  'part_number',
  'slug',
  'name',
  'short_description',
  'description',
  'price',
  'cost',
  'currency',
  'stock',
  'is_active',
];

function isFiniteNonNegativeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function validateProductPayload(body, { isCreate }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Body must be a JSON object';
  }

  if (isCreate) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) return 'name is required';
    if (typeof body.sku !== 'string' || body.sku.trim().length === 0) return 'sku is required';
    if (!isFiniteNonNegativeNumber(body.price)) return 'price is required and must be a non-negative number';
    if (!Number.isInteger(body.category_id) || body.category_id <= 0) {
      return 'category_id is required and must be a positive integer';
    }
    if (!Number.isInteger(body.manufacturer_id) || body.manufacturer_id <= 0) {
      return 'manufacturer_id is required and must be a positive integer';
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) return 'name must be a non-empty string';
    if (body.name.length > 200) return 'name too long (max 200)';
  }
  if (body.sku !== undefined) {
    if (typeof body.sku !== 'string' || body.sku.trim().length === 0) return 'sku must be a non-empty string';
    if (body.sku.length > 60) return 'sku too long (max 60)';
  }
  if (body.price !== undefined && !isFiniteNonNegativeNumber(body.price)) {
    return 'price must be a non-negative number';
  }
  if (body.cost !== undefined && body.cost !== null && !isFiniteNonNegativeNumber(body.cost)) {
    return 'cost must be a non-negative number or null';
  }
  if (body.stock !== undefined && (!Number.isInteger(body.stock) || body.stock < 0)) {
    return 'stock must be a non-negative integer';
  }
  if (body.category_id !== undefined && (!Number.isInteger(body.category_id) || body.category_id <= 0)) {
    return 'category_id must be a positive integer';
  }
  if (body.manufacturer_id !== undefined && (!Number.isInteger(body.manufacturer_id) || body.manufacturer_id <= 0)) {
    return 'manufacturer_id must be a positive integer';
  }
  if (body.currency !== undefined) {
    if (typeof body.currency !== 'string' || body.currency.length !== 3) return 'currency must be a 3-letter code';
  }
  if (body.part_number !== undefined && body.part_number !== null) {
    if (typeof body.part_number !== 'string') return 'part_number must be a string';
    if (body.part_number.length > 80) return 'part_number too long (max 80)';
  }
  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string' || body.slug.trim().length === 0) return 'slug must be a non-empty string';
    if (body.slug.length > 200) return 'slug too long (max 200)';
  }
  if (body.short_description !== undefined && body.short_description !== null) {
    if (typeof body.short_description !== 'string') return 'short_description must be a string';
    if (body.short_description.length > 500) return 'short_description too long (max 500)';
  }
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    return 'description must be a string';
  }
  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') {
    return 'is_active must be a boolean';
  }

  return null;
}

async function fetchProductDetailRow(id) {
  const { rows } = await pool.query(
    `SELECT
       p.id, p.sku, p.part_number, p.slug,
       p.name, p.short_description, p.description,
       p.price, p.cost, p.currency, p.stock, p.stock_reserved, p.is_active,
       p.created_at, p.updated_at,
       m.id   AS manufacturer_id,
       m.name AS manufacturer_name,
       m.slug AS manufacturer_slug,
       c.id           AS category_id,
       c.name         AS category_name,
       c.display_name AS category_display_name,
       c.slug         AS category_slug
     FROM products p
     INNER JOIN manufacturers m ON m.id = p.manufacturer_id
     INNER JOIN categories    c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

function toAdminProductShape(row) {
  return {
    id: row.id,
    sku: row.sku,
    part_number: row.part_number,
    slug: row.slug,
    name: row.name,
    short_description: row.short_description,
    description: row.description,
    price: row.price,
    cost: row.cost,
    currency: row.currency,
    stock: row.stock,
    stock_reserved: row.stock_reserved,
    is_active: !!row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    manufacturer: {
      id: row.manufacturer_id,
      name: row.manufacturer_name,
      slug: row.manufacturer_slug,
    },
    category: {
      id: row.category_id,
      name: row.category_name,
      display_name: row.category_display_name,
      slug: row.category_slug,
    },
  };
}

// ----- public reads (unchanged behavior) ----------------------

async function listProducts(req, res, next) {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
      : 50;
    const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;

    const where = ['p.is_active = TRUE'];
    const params = [];

    if (req.query.search !== undefined) {
      const raw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
      const term = String(raw || '').trim();
      if (term.length > 0) {
        const like = `%${term}%`;
        params.push(like, like);
        where.push(
          `(p.name ILIKE $${params.length - 1} OR p.part_number ILIKE $${params.length})`
        );
      }
    }

    if (req.query.category_id !== undefined) {
      const categoryId = parsePositiveInt(req.query.category_id);
      if (!categoryId) return next(makeError(400, 'Invalid category_id'));
      params.push(categoryId);
      where.push(`p.category_id = $${params.length}`);
    }

    if (req.query.manufacturer_id !== undefined) {
      const manufacturerId = parsePositiveInt(req.query.manufacturer_id);
      if (!manufacturerId) return next(makeError(400, 'Invalid manufacturer_id'));
      params.push(manufacturerId);
      where.push(`p.manufacturer_id = $${params.length}`);
    }

    if (req.query.vehicle_id !== undefined) {
      const vehicleId = parsePositiveInt(req.query.vehicle_id);
      if (!vehicleId) return next(makeError(400, 'Invalid vehicle_id'));
      params.push(vehicleId);
      where.push(
        `EXISTS (SELECT 1 FROM product_compatibility pc WHERE pc.product_id = p.id AND pc.vehicle_id = $${params.length})`
      );
    }

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const sql = `SELECT
         p.id,
         p.name,
         p.price,
         p.stock,
         m.name         AS manufacturer,
         c.display_name AS category
       FROM products p
       INNER JOIN manufacturers m ON m.id = p.manufacturer_id
       INNER JOIN categories    c ON c.id = p.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.id
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return next(makeError(400, 'Invalid product id'));

    const { rows: productRows } = await pool.query(
      `SELECT
         p.id, p.sku, p.part_number, p.slug,
         p.name, p.short_description, p.description,
         p.price, p.currency, p.stock, p.is_active,
         p.created_at, p.updated_at,
         m.id   AS manufacturer_id,
         m.name AS manufacturer_name,
         m.slug AS manufacturer_slug,
         c.id           AS category_id,
         c.name         AS category_name,
         c.display_name AS category_display_name,
         c.slug         AS category_slug
       FROM products p
       INNER JOIN manufacturers m ON m.id = p.manufacturer_id
       INNER JOIN categories    c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );

    if (productRows.length === 0) return next(makeError(404, `Product not found: id=${id}`));

    const p = productRows[0];

    const { rows: imageRows } = await pool.query(
      `SELECT id, url, alt_text, position, is_primary
       FROM product_images
       WHERE product_id = $1
       ORDER BY position`,
      [id]
    );

    res.json({
      id: p.id,
      sku: p.sku,
      part_number: p.part_number,
      slug: p.slug,
      name: p.name,
      short_description: p.short_description,
      description: p.description,
      price: p.price,
      currency: p.currency,
      stock: p.stock,
      is_active: !!p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
      manufacturer: {
        id: p.manufacturer_id,
        name: p.manufacturer_name,
        slug: p.manufacturer_slug,
      },
      category: {
        id: p.category_id,
        name: p.category_name,
        display_name: p.category_display_name,
        slug: p.category_slug,
      },
      images: imageRows,
    });
  } catch (err) {
    next(err);
  }
}

async function getProductCompatibility(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return next(makeError(400, 'Invalid product id'));

    const { rows: productRows } = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );
    if (productRows.length === 0) return next(makeError(404, `Product not found: id=${id}`));

    const { rows } = await pool.query(
      `SELECT
         v.id    AS vehicle_id,
         vb.name AS brand,
         vm.name AS model,
         v.trim,
         v.year_from,
         v.year_to,
         v.body_type,
         e.code            AS engine_code,
         e.displacement_cc AS engine_displacement_cc,
         e.fuel_type       AS engine_fuel_type,
         pc.position,
         pc.notes
       FROM product_compatibility pc
       INNER JOIN vehicles       v  ON v.id  = pc.vehicle_id
       INNER JOIN vehicle_models vm ON vm.id = v.model_id
       INNER JOIN vehicle_brands vb ON vb.id = vm.brand_id
       INNER JOIN engines        e  ON e.id  = v.engine_id
       WHERE pc.product_id = $1
       ORDER BY vb.name, vm.name, v.year_from`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ----- admin writes (admin / seller) --------------------------

async function createProduct(req, res, next) {
  try {
    const validationError = validateProductPayload(req.body, { isCreate: true });
    if (validationError) return next(makeError(400, validationError));

    const name = req.body.name.trim();
    const sku = req.body.sku.trim();
    const effectiveSlug =
      (typeof req.body.slug === 'string' && req.body.slug.trim().length > 0
        ? req.body.slug.trim()
        : slugify(name));
    if (!effectiveSlug) return next(makeError(400, 'slug could not be derived from name'));

    const params = [
      req.body.category_id,
      req.body.manufacturer_id,
      sku,
      req.body.part_number ?? null,
      effectiveSlug,
      name,
      req.body.short_description ?? null,
      req.body.description ?? null,
      req.body.price,
      req.body.cost ?? null,
      req.body.currency ?? 'ARS',
      Number.isInteger(req.body.stock) ? req.body.stock : 0,
      typeof req.body.is_active === 'boolean' ? req.body.is_active : true,
    ];

    let insertedId;
    try {
      const { rows } = await pool.query(
        `INSERT INTO products
           (category_id, manufacturer_id, sku, part_number, slug, name,
            short_description, description, price, cost, currency, stock, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        params
      );
      insertedId = rows[0].id;
    } catch (dbErr) {
      return next(mapPgError(dbErr));
    }

    const row = await fetchProductDetailRow(insertedId);
    res.status(201).json(toAdminProductShape(row));
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return next(makeError(400, 'Invalid product id'));

    const validationError = validateProductPayload(req.body, { isCreate: false });
    if (validationError) return next(makeError(400, validationError));

    const sets = [];
    const params = [];

    for (const field of PRODUCT_UPDATABLE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      let value = req.body[field];
      if (typeof value === 'string' && (field === 'name' || field === 'sku' || field === 'slug')) {
        value = value.trim();
      }
      params.push(value);
      sets.push(`${field} = $${params.length}`);
    }

    if (sets.length === 0) return next(makeError(400, 'No updatable fields provided'));

    params.push(id);
    const idPlaceholder = `$${params.length}`;

    let affected;
    try {
      const { rowCount } = await pool.query(
        `UPDATE products SET ${sets.join(', ')} WHERE id = ${idPlaceholder}`,
        params
      );
      affected = rowCount;
    } catch (dbErr) {
      return next(mapPgError(dbErr));
    }

    if (affected === 0) return next(makeError(404, `Product not found: id=${id}`));

    const row = await fetchProductDetailRow(id);
    res.json(toAdminProductShape(row));
  } catch (err) {
    next(err);
  }
}

async function setProductStatus(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return next(makeError(400, 'Invalid product id'));

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next(makeError(400, 'Body must be a JSON object'));
    }
    if (typeof body.is_active !== 'boolean') {
      return next(makeError(400, 'is_active must be a boolean'));
    }

    const { rowCount } = await pool.query(
      'UPDATE products SET is_active = $1 WHERE id = $2',
      [body.is_active, id]
    );
    if (rowCount === 0) return next(makeError(404, `Product not found: id=${id}`));

    const row = await fetchProductDetailRow(id);
    res.json(toAdminProductShape(row));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProductById,
  getProductCompatibility,
  createProduct,
  updateProduct,
  setProductStatus,
};
