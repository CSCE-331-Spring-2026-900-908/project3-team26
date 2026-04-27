import { query, withClient } from '../db/pool.js';
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
  const support = await getSchemaSupport();
  let closedAt = null;

  if (support.hasReportDailyTotals) {
    const result = await query(
      `SELECT z_generated, z_generated_at, z_signature
       FROM report_daily_totals
       WHERE business_date = $1`,
      [businessDate]
    );
    const row = result.rows[0];
    if (row?.z_generated) {
      closedAt = row.z_generated_at;
      signature = row.z_signature || signature;
    }
  }

  return {
    ...report,
    signature,
    closedAt,
    status: closedAt ? 'closed' : 'ready-to-close',
  };
}

export async function closeZReport(businessDate, signature = 'Manager') {
  const support = await getSchemaSupport();
  if (!support.hasReportDailyTotals || !support.hasZReportArchive) {
    throw new Error('Z report reset requires the report tables. Run database/migrations.sql first.');
  }

  const totals = await getDailyTotals(businessDate);
  const normalizedSignature = String(signature || 'Manager').trim() || 'Manager';

  const closedAt = await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const existing = await client.query(
        `SELECT z_generated
         FROM report_daily_totals
         WHERE business_date = $1
         FOR UPDATE`,
        [businessDate]
      );

      if (existing.rows[0]?.z_generated) {
        throw new Error('Z report has already been reset for today.');
      }

      const closedResult = await client.query(
        `INSERT INTO report_daily_totals (
           business_date,
           sales,
           voids,
           cash_payments,
           card_payments,
           other_payments,
           tax,
           total_cash,
           z_generated,
           z_generated_at,
           z_signature
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), $9)
         ON CONFLICT (business_date)
         DO UPDATE SET
           sales = EXCLUDED.sales,
           voids = EXCLUDED.voids,
           cash_payments = EXCLUDED.cash_payments,
           card_payments = EXCLUDED.card_payments,
           other_payments = EXCLUDED.other_payments,
           tax = EXCLUDED.tax,
           total_cash = EXCLUDED.total_cash,
           z_generated = TRUE,
           z_generated_at = NOW(),
           z_signature = EXCLUDED.z_signature
         RETURNING z_generated_at`,
        [
          businessDate,
          totals.sales,
          totals.voids,
          totals.cashPayments,
          totals.cardPayments,
          totals.otherPayments,
          totals.tax,
          totals.totalCash,
          normalizedSignature,
        ]
      );

      await client.query(
        `INSERT INTO z_report_archive (
           business_date,
           generated_at,
           signature,
           sales,
           returns_amount,
           returns_count,
           voids,
           discards,
           cash_payments,
           card_payments,
           other_payments,
           tax,
           total_cash,
           discounts,
           service_charges
         )
         VALUES ($1, NOW(), $2, $3, 0, 0, $4, 0, $5, $6, $7, $8, $9, 0, 0)`,
        [
          businessDate,
          normalizedSignature,
          totals.sales,
          totals.voids,
          totals.cashPayments,
          totals.cardPayments,
          totals.otherPayments,
          totals.tax,
          totals.totalCash,
        ]
      );

      await client.query('COMMIT');
      return closedResult.rows[0].z_generated_at;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return {
    ...(await buildZPreview(businessDate, normalizedSignature)),
    closedAt,
    status: 'closed',
  };
}
