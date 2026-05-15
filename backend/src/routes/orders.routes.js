const express = require('express');
const {
  createOrder,
  getOrderById,
  listOrders,
  cancelOrder,
  updateOrderStatus,
} = require('../controllers/orders.controller');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Any authenticated user (admin/seller/customer) can place an order.
const authed = [authMiddleware];
// Order management is staff-only.
const staffOnly = [authMiddleware, requireRole('admin', 'seller')];

router.post('/',             authed,     createOrder);
router.get('/',              staffOnly,  listOrders);
router.get('/:id',           staffOnly,  getOrderById);
router.post('/:id/cancel',   staffOnly,  cancelOrder);
router.patch('/:id/status',  staffOnly,  updateOrderStatus);

module.exports = router;
