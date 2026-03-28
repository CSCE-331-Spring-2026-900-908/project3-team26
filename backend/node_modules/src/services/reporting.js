import { query } from '../db/pool.js';
import { getSchemaSupport } from '../db/compat.js';

function money(value) {
  return Number(value || 0).toFixed(2);
}

function normalizeMethod(value = '') {
  const method = value.trim().toUpperCase();
  if (method === 'CARD' || method === 'CREDIT' || method === 'DEBIT') {
    return 'CARD';
  }
  if (method === 'CASH') {
    return 'CASH';
  }
  return 'OTHER';
}

export async function getDailyTotals(businessDate) {
  const support = await getSchemaSupport();
  const salesSql = support.hasOrderVoids
    ? `SELECT COALESCE(SUM(o.total_amount), 0) AS sales
       FROM orders o
       LEFT JOIN order_voids ov ON ov.order_id = o.id
       WHERE o.order_time::date = $1 AND ov.order_id IS NULL`
    : `SELECT COALESCE(SUM(total_amount), 0) AS sales
       FROM orders
       WHERE order_time::date = $1`;
  const salesResult = await query(salesSql, [businessDate]);

  const voidsResult = support.hasOrderVoids
    ? await query('SELECT COUNT(*)::int AS voids FROM order_voids WHERE business_date = $1', [businessDate])
    : { rows: [{ voids: 0 }] };

  const paymentResult = support.hasOrderPayments
    ? await query(
        support.hasOrderVoids
          ? `SELECT op.method, COALESCE(SUM(op.amount), 0) AS amount
             FROM order_payments op
             LEFT JOIN order_voids ov ON ov.order_id = op.order_id
             WHERE op.business_date = $1 AND ov.order_id IS NULL
             GROUP BY op.method`
          : `SELECT op.method, COALESCE(SUM(op.amount), 0) AS amount
             FROM order_payments op
             WHERE op.business_date = $1
             GROUP BY op.method`,
        [businessDate]
      )
    : { rows: [] };

  const sales = Number(salesResult.rows[0]?.sales || 0);
  let cashPayments = 0;
  let cardPayments = 0;
  let otherPayments = 0;

  for (const row of paymentResult.rows) {
    const amount = Number(row.amount || 0);
    const method = normalizeMethod(row.method);
    if (method === 'CASH') {
      cashPayments += amount;
    } else if (method === 'CARD') {
      cardPayments += amount;
    } else {
      otherPayments += amount;
    }
  }

  const allocated = cashPayments + cardPayments + otherPayments;
  if (allocated < sales) {
    cashPayments += sales - allocated;
  }

  return {
    businessDate,
    sales,
    voids: Number(voidsResult.rows[0]?.voids || 0),
    cashPayments,
    cardPayments,
    otherPayments,
    tax: Number((sales * 0.0825).toFixed(2)),
    totalCash: cashPayments,
  };
}

export async function getHourlySalesSummary(businessDate) {
  const support = await getSchemaSupport();
  const sql = support.hasOrderVoids
    ? `SELECT EXTRACT(HOUR FROM o.order_time)::int AS hour,
              COUNT(*)::int AS order_count,
              COALESCE(SUM(o.total_amount), 0) AS sales
       FROM orders o
       LEFT JOIN order_voids ov ON ov.order_id = o.id
       WHERE o.order_time::date = $1 AND ov.order_id IS NULL
       GROUP BY hour
       ORDER BY hour`
    : `SELECT EXTRACT(HOUR FROM order_time)::int AS hour,
              COUNT(*)::int AS order_count,
              COALESCE(SUM(total_amount), 0) AS sales
       FROM orders
       WHERE order_time::date = $1
       GROUP BY hour
       ORDER BY hour`;
  const result = await query(sql, [businessDate]);

  return result.rows.map((row) => ({
    hour: Number(row.hour),
    orderCount: Number(row.order_count),
    sales: Number(row.sales || 0),
    salesLabel: money(row.sales),
  }));
}

export async function buildXReport(businessDate) {
  const totals = await getDailyTotals(businessDate);
  const hourly = await getHourlySalesSummary(businessDate);

  return {
    businessDate,
    sales: money(totals.sales),
    tax: money(totals.tax),
    cashPayments: money(totals.cashPayments),
    cardPayments: money(totals.cardPayments),
    otherPayments: money(totals.otherPayments),
    voids: totals.voids,
    hourly,
  };
}

export async function buildZPreview(businessDate, signature = 'Manager') {
  const report = await buildXReport(businessDate);
  return {
    ...report,
    signature,
    status: 'ready-to-close',
  };
}
