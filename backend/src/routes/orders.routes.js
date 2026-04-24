const express = require('express');
const {
  createOrder,
  getOrderById,
  listOrders,
  cancelOrder,
  updateOrderStatus,
} = require('../controllers/orders.controller');

const router = express.Router();

router.post('/', createOrder);
router.get('/', listOrders);
router.get('/:id', getOrderById);
router.post('/:id/cancel', cancelOrder);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
