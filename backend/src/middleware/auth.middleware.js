const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured on the server');
  }
  return secret;
}

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.toLowerCase().startsWith('bearer ')) {
      return next(makeError(401, 'Missing or malformed Authorization header'));
    }
    const token = header.slice(7).trim();
    if (!token) {
      return next(makeError(401, 'Missing bearer token'));
    }

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch (verifyErr) {
      // jwt.verify throws TokenExpiredError or JsonWebTokenError. Surface as 401
      // without leaking which case it is.
      return next(makeError(401, 'Invalid or expired token'));
    }

    const userId = payload && payload.sub;
    if (!Number.isInteger(userId) || userId <= 0) {
      return next(makeError(401, 'Invalid token payload'));
    }

    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, is_active
       FROM users
       WHERE id = $1`,
      [userId]
    );
    if (rows.length === 0) {
      return next(makeError(401, 'User not found'));
    }
    const user = rows[0];
    if (!user.is_active) {
      return next(makeError(401, 'User is inactive'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authMiddleware };
