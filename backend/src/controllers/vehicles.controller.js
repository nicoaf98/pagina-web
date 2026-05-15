const { pool } = require('../config/db');

function parsePositiveInt(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseYear(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
}

async function listVehicleBrands(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug
       FROM vehicle_brands
       WHERE is_active = TRUE
       ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function listVehicleModels(req, res, next) {
  try {
    const where = [];
    const params = [];

    if (req.query.brand_id !== undefined) {
      const brandId = parsePositiveInt(req.query.brand_id);
      if (!brandId) {
        const err = new Error('Invalid brand_id');
        err.status = 400;
        throw err;
      }
      params.push(brandId);
      where.push(`vm.brand_id = $${params.length}`);
    }

    const sql = `SELECT
         vm.id,
         vm.brand_id,
         vb.name AS brand_name,
         vm.name,
         vm.is_active
       FROM vehicle_models vm
       INNER JOIN vehicle_brands vb ON vb.id = vm.brand_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY vb.name, vm.name`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function listVehicles(req, res, next) {
  try {
    const where = [];
    const params = [];

    if (req.query.brand_id !== undefined) {
      const brandId = parsePositiveInt(req.query.brand_id);
      if (!brandId) {
        const err = new Error('Invalid brand_id');
        err.status = 400;
        throw err;
      }
      params.push(brandId);
      where.push(`vm.brand_id = $${params.length}`);
    }

    if (req.query.model_id !== undefined) {
      const modelId = parsePositiveInt(req.query.model_id);
      if (!modelId) {
        const err = new Error('Invalid model_id');
        err.status = 400;
        throw err;
      }
      params.push(modelId);
      where.push(`v.model_id = $${params.length}`);
    }

    if (req.query.engine_id !== undefined) {
      const engineId = parsePositiveInt(req.query.engine_id);
      if (!engineId) {
        const err = new Error('Invalid engine_id');
        err.status = 400;
        throw err;
      }
      params.push(engineId);
      where.push(`v.engine_id = $${params.length}`);
    }

    if (req.query.year !== undefined) {
      const year = parseYear(req.query.year);
      if (!year) {
        const err = new Error('Invalid year (expected integer between 1900 and 2100)');
        err.status = 400;
        throw err;
      }
      params.push(year);
      const p = `$${params.length}`;
      where.push(`v.year_from <= ${p} AND (v.year_to IS NULL OR v.year_to >= ${p})`);
    }

    const sql = `SELECT
         v.id,
         vb.name       AS brand,
         vm.name       AS model,
         e.code        AS engine_code,
         e.description AS engine_description,
         v.year_from,
         v.year_to,
         v.trim,
         v.body_type,
         v.notes
       FROM vehicles v
       INNER JOIN vehicle_models vm ON vm.id = v.model_id
       INNER JOIN vehicle_brands vb ON vb.id = vm.brand_id
       INNER JOIN engines        e  ON e.id  = v.engine_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY vb.name, vm.name, v.year_from`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listVehicleBrands,
  listVehicleModels,
  listVehicles,
};
