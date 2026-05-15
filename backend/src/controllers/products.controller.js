const { pool } = require('../config/db');

function parsePositiveInt(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

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
      if (!categoryId) {
        const err = new Error('Invalid category_id');
        err.status = 400;
        throw err;
      }
      params.push(categoryId);
      where.push(`p.category_id = $${params.length}`);
    }

    if (req.query.manufacturer_id !== undefined) {
      const manufacturerId = parsePositiveInt(req.query.manufacturer_id);
      if (!manufacturerId) {
        const err = new Error('Invalid manufacturer_id');
        err.status = 400;
        throw err;
      }
      params.push(manufacturerId);
      where.push(`p.manufacturer_id = $${params.length}`);
    }

    if (req.query.vehicle_id !== undefined) {
      const vehicleId = parsePositiveInt(req.query.vehicle_id);
      if (!vehicleId) {
        const err = new Error('Invalid vehicle_id');
        err.status = 400;
        throw err;
      }
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
    if (!id) {
      const err = new Error('Invalid product id');
      err.status = 400;
      throw err;
    }

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

    if (productRows.length === 0) {
      const err = new Error(`Product not found: id=${id}`);
      err.status = 404;
      throw err;
    }

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
    if (!id) {
      const err = new Error('Invalid product id');
      err.status = 400;
      throw err;
    }

    const { rows: productRows } = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );
    if (productRows.length === 0) {
      const err = new Error(`Product not found: id=${id}`);
      err.status = 404;
      throw err;
    }

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

module.exports = {
  listProducts,
  getProductById,
  getProductCompatibility,
};
