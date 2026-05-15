const express = require('express');
const { login, me } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/login', login);
router.get('/me', authMiddleware, me);

module.exports = router;
