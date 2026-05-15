const express = require('express');
const {
  listProducts,
  getProductById,
  getProductCompatibility,
  createProduct,
  updateProduct,
  setProductStatus,
} = require('../controllers/products.controller');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

const staffOnly = [authMiddleware, requireRole('admin', 'seller')];

// Public reads
router.get('/', listProducts);
router.get('/:id', getProductById);
router.get('/:id/compatibility', getProductCompatibility);

// Staff-only writes
router.post('/', staffOnly, createProduct);
router.patch('/:id/status', staffOnly, setProductStatus);
router.patch('/:id', staffOnly, updateProduct);

module.exports = router;
