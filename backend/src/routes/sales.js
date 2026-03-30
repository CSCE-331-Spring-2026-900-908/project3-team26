import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/weekly', async (req, res, next) => {
  const weeks = Math.min(Number(req.query.weeks || 12), 52);
  try {
    const result = await query(
      `SELECT *
       FROM (
         SELECT
           DATE_TRUNC('week', orders.order_time)::date AS week_start,
           COUNT(orders.id)::int AS number_of_orders,
           SUM(order_totals.order_total) AS weekly_total_sales
         FROM orders
         JOIN (
           SELECT
             orders.id AS order_id,
             SUM(order_items.quantity * order_items.price_charged) AS order_total
           FROM orders
           JOIN order_items ON order_items.order_id = orders.id
           GROUP BY orders.id
         ) AS order_totals ON orders.id = order_totals.order_id
         GROUP BY DATE_TRUNC('week', orders.order_time)
         ORDER BY week_start DESC
       ) weekly
       ORDER BY week_start DESC
       LIMIT $1`,
      [weeks]
    );

    res.json({
      weeks: result.rows.map((row) => ({
        weekStart: row.week_start,
        numberOfOrders: Number(row.number_of_orders),
        weeklyTotalSales: Number(row.weekly_total_sales),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/peak-day', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT
         DATE(orders.order_time) AS sales_date,
         COUNT(orders.id)::int AS number_of_orders,
         SUM(order_totals.order_total) AS daily_total_sales
       FROM orders
       JOIN (
         SELECT
           orders.id AS order_id,
           SUM(order_items.quantity * order_items.price_charged) AS order_total
         FROM orders
         JOIN order_items ON order_items.order_id = orders.id
         GROUP BY orders.id
       ) AS order_totals ON orders.id = order_totals.order_id
       GROUP BY DATE(orders.order_time)
       ORDER BY daily_total_sales DESC
       LIMIT 1`
    );

    res.json({ peakDay: result.rows[0] || null });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (_req, res, next) => {
  try {
    const [summary, topItems, sourceBreakdown, hourly] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(total_amount), 0) AS total_sales,
           COUNT(*)::int AS total_orders,
           COALESCE(AVG(total_amount), 0) AS average_order,
           MIN(order_time) AS earliest_order,
           MAX(order_time) AS latest_order
         FROM orders`
      ),
      query(
        `SELECT m.name, SUM(oi.quantity)::int AS total_units_sold
         FROM order_items oi
         JOIN menu_items m ON m.id = oi.menu_item_id
         GROUP BY m.id, m.name
         ORDER BY total_units_sold DESC
         LIMIT 5`
      ),
      query(
        `SELECT order_source, COUNT(*)::int AS orders, COALESCE(SUM(total_amount), 0) AS sales
         FROM orders
         GROUP BY order_source
         ORDER BY order_source`
      ),
      query(
        `SELECT EXTRACT(HOUR FROM order_time)::int AS hour_of_day,
                COUNT(*)::int AS order_count,
                SUM(total_amount) AS total_sales
         FROM orders
         GROUP BY hour_of_day
         ORDER BY hour_of_day`
      ),
    ]);

    res.json({
      summary: {
        totalSales: Number(summary.rows[0].total_sales),
        totalOrders: Number(summary.rows[0].total_orders),
        averageOrder: Number(summary.rows[0].average_order),
        earliestOrder: summary.rows[0].earliest_order,
        latestOrder: summary.rows[0].latest_order,
      },
      topItems: topItems.rows.map((row) => ({
        name: row.name,
        totalUnitsSold: Number(row.total_units_sold),
      })),
      sourceBreakdown: sourceBreakdown.rows.map((row) => ({
        orderSource: row.order_source,
        orders: Number(row.orders),
        sales: Number(row.sales),
      })),
      hourly: hourly.rows.map((row) => ({
        hourOfDay: Number(row.hour_of_day),
        orderCount: Number(row.order_count),
        totalSales: Number(row.total_sales),
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;