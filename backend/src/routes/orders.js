// Orders route: creates completed orders, records line items, and returns order receipts.
// Uses schema feature detection so it can run against both the base and migrated databases.
import { Router } from 'express';
import { withClient } from '../db/pool.js';
import { getSchemaSupport } from '../db/compat.js';

const router = Router();

// Texas state sales tax (6.25%) plus typical College Station local rate (2.0%) = 8.25%.
// Applied to every order subtotal before storing the total in the orders table.
const TEXAS_TAX_RATE = 0.0825;

function roundCurrency(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function nextId(client, table) {
  // The class database uses integer IDs without sequences, so routes allocate the next ID manually.
  const result = await client.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${table}`);
  return Number(result.rows[0].next_id);
}

router.get('/:id', async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const support = await getSchemaSupport();
    const rows = await withClient(async (client) => {
      const orderResult = await client.query(
        `SELECT o.id, o.order_time, o.total_amount, o.cashier,
                ${support.hasOrderSource ? 'o.order_source,' : "'cashier' AS order_source,"}
                ${support.hasOrderPayments ? 'op.method AS payment_method, op.amount AS payment_amount' : "NULL AS payment_method, NULL AS payment_amount"}
         FROM orders o
         ${support.hasOrderPayments ? 'LEFT JOIN order_payments op ON op.order_id = o.id' : ''}
         WHERE o.id = $1`,
        [orderId]
      );
      if (orderResult.rowCount === 0) {
        return [];
      }
      const itemsResult = await client.query(
        `SELECT oi.id, oi.quantity, oi.price_charged, oi.menu_item_id, m.name
         FROM order_items oi
         JOIN menu_items m ON m.id = oi.menu_item_id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [orderId]
      );
      return [{ ...orderResult.rows[0], items: itemsResult.rows }];
    });

    if (!rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({ order: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const {
    items = [],
    cashierId = null,
    source = 'cashier',
    paymentMethod = 'CASH',
  } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one order item is required.' });
  }

  try {
    const support = await getSchemaSupport();
    const order = await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const menuIds = items.map((item) => Number(item.menuItemId));
        const menuResult = await client.query(
          'SELECT id, name, price, availability FROM menu_items WHERE id = ANY($1::int[]) ORDER BY id',
          [menuIds]
        );
        const menuMap = new Map(menuResult.rows.map((row) => [Number(row.id), row]));

        // Compute the pre-tax subtotal from menu prices; line items are stored at their unit price.
        let subtotal = 0;
        for (const item of items) {
          const quantity = Number(item.quantity || 0);
          const menuItem = menuMap.get(Number(item.menuItemId));
          if (!menuItem || !menuItem.availability || quantity <= 0) {
            throw new Error(`Invalid menu selection for item ${item.menuItemId}.`);
          }
          subtotal += Number(menuItem.price) * quantity;
        }
        subtotal = roundCurrency(subtotal);
        const tax = roundCurrency(subtotal * TEXAS_TAX_RATE);
        const grandTotal = roundCurrency(subtotal + tax);

        const orderId = await nextId(client, 'orders');
        let orderItemId = await nextId(client, 'order_items');
        const now = new Date();
        const normalizedSource = source === 'kiosk' ? 'kiosk' : 'cashier';
        const normalizedPayment = String(paymentMethod).trim().toUpperCase() || 'CASH';

        if (support.hasOrderSource) {
          await client.query(
            `INSERT INTO orders(id, order_time, total_amount, cashier, order_source)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, now, grandTotal.toFixed(2), cashierId || null, normalizedSource]
          );
        } else {
          await client.query(
            `INSERT INTO orders(id, order_time, total_amount, cashier)
             VALUES ($1, $2, $3, $4)`,
            [orderId, now, grandTotal.toFixed(2), cashierId || null]
          );
        }

        for (const item of items) {
          const menuItem = menuMap.get(Number(item.menuItemId));
          await client.query(
            `INSERT INTO order_items(id, order_id, quantity, price_charged, menu_item_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderItemId, orderId, Number(item.quantity), Number(menuItem.price), Number(item.menuItemId)]
          );
          orderItemId += 1;
        }

        if (support.hasOrderPayments) {
          await client.query(
            `INSERT INTO order_payments(order_id, business_date, method, amount)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (order_id)
             DO UPDATE SET business_date = EXCLUDED.business_date, method = EXCLUDED.method, amount = EXCLUDED.amount`,
            [orderId, now.toISOString().slice(0, 10), normalizedPayment, grandTotal.toFixed(2)]
          );
        }

        const details = items.map((item) => {
          const menuItem = menuMap.get(Number(item.menuItemId));
          return {
            menuItemId: Number(item.menuItemId),
            name: menuItem.name,
            quantity: Number(item.quantity),
            unitPrice: Number(menuItem.price),
          };
        });

        await client.query('COMMIT');

        return {
          id: orderId,
          orderTime: now,
          subtotal,
          tax,
          taxRate: TEXAS_TAX_RATE,
          totalAmount: grandTotal,
          cashierId,
          source: normalizedSource,
          paymentMethod: normalizedPayment,
          items: details,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    return res.status(201).json({ order });
  } catch (error) {
    return next(error);
  }
});

export default router;
