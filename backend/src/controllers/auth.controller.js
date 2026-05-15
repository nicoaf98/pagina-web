const bcrypt = require('bcryptjs');
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

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

function validateLoginPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Body must be a JSON object';
  }
  const { email, password } = body;
  if (typeof email !== 'string' || email.trim().length === 0) {
    return 'email is required';
  }
  if (email.length > 150) {
    return 'email too long (max 150)';
  }
  if (typeof password !== 'string' || password.length === 0) {
    return 'password is required';
  }
  if (password.length > 200) {
    return 'password too long';
  }
  return null;
}

async function login(req, res, next) {
  try {
    const validationError = validateLoginPayload(req.body);
    if (validationError) return next(makeError(400, validationError));

    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const { rows } = await pool.query(
      `SELECT id, email, password_hash, full_name, role, is_active
       FROM users
       WHERE email = $1`,
      [email]
    );

    // Use a generic 401 for every failure path (no user, inactive user, wrong
    // password) so we don't leak which condition triggered the rejection.
    if (rows.length === 0) {
      return next(makeError(401, 'Invalid credentials'));
    }
    const user = rows[0];
    if (!user.is_active) {
      return next(makeError(401, 'Invalid credentials'));
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return next(makeError(401, 'Invalid credentials'));
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  // req.user is loaded by authMiddleware; password_hash is never selected.
  res.json({
    id: req.user.id,
    email: req.user.email,
    full_name: req.user.full_name,
    role: req.user.role,
    is_active: req.user.is_active,
  });
}

module.exports = { login, me };
