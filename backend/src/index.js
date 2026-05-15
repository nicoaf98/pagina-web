require('dotenv').config();

const app = require('./app');
const { ping } = require('./config/db');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await ping();
    console.log('[db] MySQL connection ok');
  } catch (err) {
    console.warn('[db] MySQL unreachable at startup:', err.code || err.message);
  }

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

start();
