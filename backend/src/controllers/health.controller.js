const { pool } = require('../config/db');

async function getHealth(req, res) {
  const base = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    const dbOk = rows[0] && rows[0].ok === 1;
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'connected' : 'unexpected_response',
      ...base,
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      db: 'disconnected',
      error: err.code || err.message,
      ...base,
    });
  }
}

module.exports = { getHealth };
