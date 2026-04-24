const express = require('express');
const {
  listProducts,
  getProductById,
  getProductCompatibility,
} = require('../controllers/products.controller');

const router = express.Router();

router.get('/', listProducts);
router.get('/:id', getProductById);
router.get('/:id/compatibility', getProductCompatibility);

module.exports = router;
