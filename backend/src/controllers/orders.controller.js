const { pool } = require('../config/db');

function parsePositiveInt(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseDate(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseDateEndOfDay(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const trimmed = raw.trim();
  // Bare YYYY-MM-DD input: extend to end of that day in UTC.
  // Anything with an explicit time component is parsed as-is.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T23:59:59.999Z`);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(trimmed);
  return Number.isFinite(d.getTime()) ? d : null;
}

const ALLOWED_PAYMENT_STATUSES = ['pending', 'authorized', 'paid', 'refunded', 'failed'];
const ALLOWED_FULFILLMENT_STATUSES = [
  'not_shipped',
  'preparing',
  'shipped',
  'delivered',
  'returned',
  'cancelled',
];

function validateCreatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Body must be a JSON object';
  }

  const { customer_name, customer_email, customer_phone, items } = body;

  if (typeof customer_name !== 'string' || customer_name.trim().length === 0) {
    return 'customer_name is required';
  }
  if (customer_name.length > 200) return 'customer_name too long (max 200)';

  if (typeof customer_email !== 'string' || customer_email.trim().length === 0) {
    return 'customer_email is required';
  }
  const email = customer_email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'customer_email format invalid';
  if (email.length > 150) return 'customer_email too long (max 150)';

  if (customer_phone !== undefined && customer_phone !== null && customer_phone !== '') {
    if (typeof customer_phone !== 'string') return 'customer_phone must be a string';
    if (customer_phone.length > 40) return 'customer_phone too long (max 40)';
  }

  if (!Array.isArray(items) || items.length === 0) return 'items must be a non-empty array';
  if (items.length > 100) return 'items array too large (max 100 lines)';

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return `items[${i}] must be an object`;
    }
    if (!Number.isInteger(item.product_id) || item.product_id <= 0) {
      return `items[${i}].product_id must be a positive integer`;
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return `items[${i}].quantity must be a positive integer`;
    }
    if (item.quantity > 10000) {
      return `items[${i}].quantity too large (max 10000)`;
    }
  }

  return null;
}

function buildOrderResponse(orderRow, itemRows) {
  return {
    id: orderRow.id,
    order_code: orderRow.order_code,
    customer: {
      id: orderRow.customer_id,
      name: orderRow.customer_name,
      email: orderRow.customer_email,
      phone: orderRow.customer_phone,
    },
    subtotal: orderRow.subtotal,
    tax_amount: orderRow.tax_amount,
    shipping_cost: orderRow.shipping_cost,
    discount_amount: orderRow.discount_amount,
    total: orderRow.total,
    currency: orderRow.currency,
    payment_status: orderRow.payment_status,
    fulfillment_status: orderRow.fulfillment_status,
    created_at: orderRow.created_at,
    updated_at: orderRow.updated_at,
    items: itemRows.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: r.product_name_snapshot,
      product_sku: r.product_sku_snapshot,
      quantity: r.quantity,
      unit_price: r.unit_price,
      discount_amount: r.discount_amount,
      line_total: r.line_total,
    })),
  };
}

async function fetchOrderWithItems(executor, id) {
  const { rows: orderRows } = await executor.query(
    `SELECT id, order_code, customer_id,
            customer_name, customer_email, customer_phone,
            subtotal, tax_amount, shipping_cost, discount_amount, total, currency,
            payment_status, fulfillment_status,
            created_at, updated_at
     FROM orders
     WHERE id = $1`,
    [id]
  );
  if (orderRows.length === 0) return null;

  const { rows: itemRows } = await executor.query(
    `SELECT id, product_id, product_name_snapshot, product_sku_snapshot,
            quantity, unit_price, discount_amount, line_total
     FROM order_items
     WHERE order_id = $1
     ORDER BY id`,
    [id]
  );

  return buildOrderResponse(orderRows[0], itemRows);
}

async function createOrder(req, res, next) {
  const validationError = validateCreatePayload(req.body);
  if (validationError) return next(makeError(400, validationError));

  const customerName = req.body.customer_name.trim();
  const customerEmail = req.body.customer_email.trim();
  const customerPhone =
    req.body.customer_phone && req.body.customer_phone.trim().length > 0
      ? req.body.customer_phone.trim()
      : null;

  // Aggregate duplicate product_ids so stock is checked against total qty per product.
  const grouped = new Map();
  for (const item of req.body.items) {
    grouped.set(item.product_id, (grouped.get(item.product_id) || 0) + item.quantity);
  }
  const productIds = [...grouped.keys()];

  let orderId;
  let transactionError = null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: products } = await client.query(
      `SELECT id, sku, name, price, stock, is_active
       FROM products
       WHERE id = ANY($1::int[])
       FOR UPDATE`,
      [productIds]
    );

    const byId = new Map(products.map((p) => [p.id, p]));

    for (const pid of productIds) {
      const p = byId.get(pid);
      if (!p) throw makeError(400, `Product not found: id=${pid}`);
      if (!p.is_active) throw makeError(400, `Product is inactive: id=${pid}`);
      const reqQty = grouped.get(pid);
      if (p.stock < reqQty) {
        throw makeError(
          400,
          `Insufficient stock for product id=${pid}: stock=${p.stock}, requested=${reqQty}`
        );
      }
    }

    const lineItems = productIds.map((pid) => {
      const p = byId.get(pid);
      const qty = grouped.get(pid);
      const unitPrice = Number(p.price);
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      return {
        product_id: pid,
        product_name: p.name,
        product_sku: p.sku,
        quantity: qty,
        unit_price: unitPrice,
        discount_amount: 0,
        line_total: lineTotal,
      };
    });

    const subtotal =
      Math.round(lineItems.reduce((s, li) => s + li.line_total, 0) * 100) / 100;
    const discountAmount = 0;
    const shippingCost = 0;
    const taxAmount = 0;
    const total = Math.round((subtotal + shippingCost - discountAmount) * 100) / 100;

    // Insert with a temporary unique code, then rewrite to ORD-YYYY-NNNNNN using
    // the returned id. PG's RETURNING clause gives us the new id in one round-trip.
    const tmpCode = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const { rows: insertedRows } = await client.query(
      `INSERT INTO orders
         (order_code, customer_name, customer_email, customer_phone,
          subtotal, tax_amount, shipping_cost, discount_amount, total, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ARS')
       RETURNING id`,
      [
        tmpCode,
        customerName,
        customerEmail,
        customerPhone,
        subtotal,
        taxAmount,
        shippingCost,
        discountAmount,
        total,
      ]
    );
    orderId = insertedRows[0].id;

    const finalCode = `ORD-${new Date().getFullYear()}-${String(orderId).padStart(6, '0')}`;
    await client.query('UPDATE orders SET order_code = $1 WHERE id = $2', [
      finalCode,
      orderId,
    ]);

    // Insert order_items one row at a time. PG has no equivalent to mysql2's
    // bulk array-of-arrays shorthand; a loop inside the same transaction is
    // simple and fine at this scale.
    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name_snapshot, product_sku_snapshot,
            quantity, unit_price, discount_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orderId,
          li.product_id,
          li.product_name,
          li.product_sku,
          li.quantity,
          li.unit_price,
          li.discount_amount,
          li.line_total,
        ]
      );
    }

    for (const li of lineItems) {
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
        li.quantity,
        li.product_id,
      ]);
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback failures; the outer error is already captured
    }
    transactionError = err;
  } finally {
    client.release();
  }

  if (transactionError) return next(transactionError);

  try {
    const order = await fetchOrderWithItems(pool, orderId);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return next(makeError(400, 'Invalid order id'));

    const order = await fetchOrderWithItems(pool, id);
    if (!order) return next(makeError(404, `Order not found: id=${id}`));

    res.json(order);
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
      : 50;
    const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;

    const where = [];
    const params = [];

    if (req.query.customer_email !== undefined) {
      const raw = Array.isArray(req.query.customer_email)
        ? req.query.customer_email[0]
        : req.query.customer_email;
      const email = String(raw || '').trim();
      if (email.length === 0) {
        return next(makeError(400, 'customer_email cannot be empty'));
      }
      if (email.length > 150) {
        return next(makeError(400, 'customer_email too long (max 150)'));
      }
      params.push(email);
      where.push(`customer_email = $${params.length}`);
    }

    if (req.query.payment_status !== undefined) {
      const ps = String(req.query.payment_status).trim();
      if (!ALLOWED_PAYMENT_STATUSES.includes(ps)) {
        return next(
          makeError(
            400,
            `Invalid payment_status (allowed: ${ALLOWED_PAYMENT_STATUSES.join(', ')})`
          )
        );
      }
      params.push(ps);
      where.push(`payment_status = $${params.length}`);
    }

    if (req.query.fulfillment_status !== undefined) {
      const fs = String(req.query.fulfillment_status).trim();
      if (!ALLOWED_FULFILLMENT_STATUSES.includes(fs)) {
        return next(
          makeError(
            400,
            `Invalid fulfillment_status (allowed: ${ALLOWED_FULFILLMENT_STATUSES.join(', ')})`
          )
        );
      }
      params.push(fs);
      where.push(`fulfillment_status = $${params.length}`);
    }

    if (req.query.date_from !== undefined) {
      const d = parseDate(req.query.date_from);
      if (!d) {
        return next(makeError(400, 'Invalid date_from (expected ISO date string)'));
      }
      params.push(d);
      where.push(`created_at >= $${params.length}`);
    }

    if (req.query.date_to !== undefined) {
      const d = parseDateEndOfDay(req.query.date_to);
      if (!d) {
        return next(makeError(400, 'Invalid date_to (expected ISO date string)'));
      }
      params.push(d);
      where.push(`created_at <= $${params.length}`);
    }

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const sql = `SELECT
         id, order_code,
         customer_name, customer_email, customer_phone,
         subtotal, tax_amount, shipping_cost, discount_amount, total, currency,
         payment_status, fulfillment_status,
         created_at, updated_at
       FROM orders
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  const id = parsePositiveInt(req.params.id);
  if (!id) return next(makeError(400, 'Invalid order id'));

  let transactionError = null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      `SELECT id, fulfillment_status
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (orderRows.length === 0) {
      throw makeError(404, `Order not found: id=${id}`);
    }

    const currentStatus = orderRows[0].fulfillment_status;
    if (currentStatus === 'cancelled') {
      throw makeError(400, `Order already cancelled: id=${id}`);
    }
    if (currentStatus === 'shipped' || currentStatus === 'delivered') {
      throw makeError(
        400,
        `Cannot cancel order id=${id}: already ${currentStatus}`
      );
    }

    const { rows: items } = await client.query(
      `SELECT product_id, quantity
       FROM order_items
       WHERE order_id = $1`,
      [id]
    );

    for (const item of items) {
      await client.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [
        item.quantity,
        item.product_id,
      ]);
    }

    await client.query(
      `UPDATE orders
       SET fulfillment_status = 'cancelled',
           cancelled_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback failures; outer error is already captured
    }
    transactionError = err;
  } finally {
    client.release();
  }

  if (transactionError) return next(transactionError);

  try {
    const updated = await fetchOrderWithItems(pool, id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  const id = parsePositiveInt(req.params.id);
  if (!id) return next(makeError(400, 'Invalid order id'));

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(makeError(400, 'Body must be a JSON object'));
  }

  const ALLOWED_TARGETS = ['preparing', 'shipped', 'delivered', 'returned'];
  const newStatus = body.fulfillment_status;
  if (!ALLOWED_TARGETS.includes(newStatus)) {
    return next(
      makeError(
        400,
        `Invalid fulfillment_status (allowed: ${ALLOWED_TARGETS.join(', ')})`
      )
    );
  }

  const ALLOWED_TRANSITIONS = {
    not_shipped: 'preparing',
    preparing: 'shipped',
    shipped: 'delivered',
    delivered: 'returned',
  };

  let transactionError = null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      `SELECT id, fulfillment_status
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    if (orderRows.length === 0) {
      throw makeError(404, `Order not found: id=${id}`);
    }

    const currentStatus = orderRows[0].fulfillment_status;
    const expectedNext = ALLOWED_TRANSITIONS[currentStatus];
    if (expectedNext !== newStatus) {
      throw makeError(
        400,
        `Invalid transition from ${currentStatus} to ${newStatus}`
      );
    }

    if (newStatus === 'shipped') {
      await client.query(
        `UPDATE orders
         SET fulfillment_status = $1, shipped_at = NOW()
         WHERE id = $2`,
        [newStatus, id]
      );
    } else if (newStatus === 'delivered') {
      await client.query(
        `UPDATE orders
         SET fulfillment_status = $1, delivered_at = NOW()
         WHERE id = $2`,
        [newStatus, id]
      );
    } else {
      await client.query(
        `UPDATE orders
         SET fulfillment_status = $1
         WHERE id = $2`,
        [newStatus, id]
      );
    }

    // Returned orders restore stock (same pattern as cancelOrder).
    if (newStatus === 'returned') {
      const { rows: items } = await client.query(
        `SELECT product_id, quantity
         FROM order_items
         WHERE order_id = $1`,
        [id]
      );
      for (const item of items) {
        await client.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [
          item.quantity,
          item.product_id,
        ]);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback failures; outer error is already captured
    }
    transactionError = err;
  } finally {
    client.release();
  }

  if (transactionError) return next(transactionError);

  try {
    const updated = await fetchOrderWithItems(pool, id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  getOrderById,
  listOrders,
  cancelOrder,
  updateOrderStatus,
};
