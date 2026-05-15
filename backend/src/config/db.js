const { Pool, types } = require('pg');

// Return BIGINT (oid 20) as JS number instead of string. Safe for ids up to
// Number.MAX_SAFE_INTEGER (~9e15) — well above anything an id column hits in
// this app. Keeps Map.get(id) lookups and arithmetic working regardless of
// whether the Postgres column was created as INT or BIGINT.
types.setTypeParser(20, (val) => Number.parseInt(val, 10));

function buildPoolConfig() {
  const max = Number(process.env.DB_CONNECTION_LIMIT) || 10;

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      // Supabase / most hosted PG providers require SSL. Disable strict cert
      // checking because their certs aren't in the default Node trust store.
      ssl: { rejectUnauthorized: false },
      max,
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'car_parts',
    max,
  };
}

const pool = new Pool(buildPoolConfig());

async function ping() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

module.exports = { pool, ping };
