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
