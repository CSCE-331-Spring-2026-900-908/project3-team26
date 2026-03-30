import { Router } from 'express';
import { query, withClient } from '../db/pool.js';
import { getSchemaSupport } from '../db/compat.js';
import { buildXReport, buildZPreview } from '../services/reporting.js';

const router = Router();

async function nextId(client, table) {
  const result = await client.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${table}`);
  return Number(result.rows[0].next_id);
}

router.get('/dashboard', async (_req, res, next) => {
  try {
    const support = await getSchemaSupport();
    const [totals, lowStock, recentOrders, productUsage] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS orders,
           COALESCE(SUM(total_amount), 0) AS sales,
           COALESCE(AVG(total_amount), 0) AS average_order,
           COUNT(DISTINCT cashier)::int AS active_cashiers
         FROM orders`
      ),
      query(
        `SELECT i.id AS ingredient_id, i.name, inv.quantity, inv.threshold
         FROM inventory inv
         JOIN ingredients i ON i.id = inv.ingredient_id
         WHERE inv.quantity <= inv.threshold
         ORDER BY inv.quantity ASC, i.name ASC
         LIMIT 10`
      ),
      query(
        `SELECT o.id, o.order_time, o.total_amount,
                ${support.hasOrderSource ? 'o.order_source,' : "'cashier' AS order_source,"}
                ${support.hasOrderVoids ? "CASE WHEN ov.order_id IS NULL THEN 'ACTIVE' ELSE 'VOIDED' END AS status" : "'ACTIVE' AS status"}
         FROM orders o
         ${support.hasOrderVoids ? 'LEFT JOIN order_voids ov ON ov.order_id = o.id' : ''}
         ORDER BY o.id DESC
         LIMIT 10`
      ),
      query(
        `SELECT i.id AS ingredient_id, i.name, i.unit,
                COALESCE(SUM(oi.quantity), 0)::numeric AS units_used
         FROM ingredients i
         LEFT JOIN menu_item_ingredients mii ON mii.ingredient_id = i.id
         LEFT JOIN order_items oi ON oi.menu_item_id = mii.menu_item_id
         GROUP BY i.id, i.name, i.unit
         ORDER BY units_used DESC, i.name
         LIMIT 10`
      ),
    ]);

    res.json({
      totals: {
        orders: Number(totals.rows[0].orders),
        sales: Number(totals.rows[0].sales),
        averageOrder: Number(totals.rows[0].average_order),
        activeCashiers: Number(totals.rows[0].active_cashiers),
      },
      lowStock: lowStock.rows,
      recentOrders: recentOrders.rows,
      productUsage: productUsage.rows.map((row) => ({
        ingredientId: Number(row.ingredient_id),
        name: row.name,
        unit: row.unit,
        unitsUsed: Number(row.units_used),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const support = await getSchemaSupport();
    const result = await query(
      `SELECT o.id, o.order_time, o.total_amount, o.cashier,
              ${support.hasOrderSource ? 'o.order_source,' : "'cashier' AS order_source,"}
              ${support.hasOrderVoids ? "CASE WHEN ov.order_id IS NULL THEN 'ACTIVE' ELSE 'VOIDED' END AS status, ov.voided_at, ov.manager_id" : "'ACTIVE' AS status, NULL AS voided_at, NULL AS manager_id"}
       FROM orders o
       ${support.hasOrderVoids ? 'LEFT JOIN order_voids ov ON ov.order_id = o.id' : ''}
       ORDER BY o.id DESC
       LIMIT 250`
    );
    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/void', async (req, res, next) => {
  const orderId = Number(req.params.id);
  const managerId = req.body?.managerId || null;

  try {
    const support = await getSchemaSupport();
    if (!support.hasOrderVoids) {
      return res.status(400).json({ error: 'Order voiding is unavailable on the original Project 2 schema.' });
    }
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const orderResult = await client.query(
          'SELECT order_time::date AS business_date FROM orders WHERE id = $1',
          [orderId]
        );
        if (orderResult.rowCount === 0) {
          throw new Error('Order not found.');
        }

        const alreadyVoided = await client.query(
          'SELECT COUNT(*)::int AS count FROM order_voids WHERE order_id = $1',
          [orderId]
        );
        if (Number(alreadyVoided.rows[0].count) > 0) {
          throw new Error('Order is already voided.');
        }

        await client.query(
          `INSERT INTO order_voids(order_id, business_date, voided_at, manager_id)
           VALUES ($1, $2, NOW(), $3)`,
          [orderId, orderResult.rows[0].business_date, managerId]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
