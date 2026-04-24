require('dotenv').config();

const express = require('express');

const { ping } = require('./config/db');
const healthRoutes = require('./routes/health.routes');
const productsRoutes = require('./routes/products.routes');
const vehiclesRoutes = require('./routes/vehicles.routes');
const ordersRoutes = require('./routes/orders.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});


app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api', vehiclesRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

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
