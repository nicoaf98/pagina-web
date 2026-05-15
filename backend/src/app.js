const express = require('express');

const healthRoutes = require('./routes/health.routes');
const productsRoutes = require('./routes/products.routes');
const vehiclesRoutes = require('./routes/vehicles.routes');
const ordersRoutes = require('./routes/orders.routes');
const authRoutes = require('./routes/auth.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', vehiclesRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
