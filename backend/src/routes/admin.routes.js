const express = require('express');
const {
  adminListProducts,
  bulkUpdatePrices,
} = require('../controllers/products.controller');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

const staffOnly = [authMiddleware, requireRole('admin', 'seller')];

router.get('/products',                  staffOnly, adminListProducts);
router.patch('/products/prices/bulk',    staffOnly, bulkUpdatePrices);

module.exports = router;
