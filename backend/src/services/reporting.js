// Reporting service: builds X-reports, Z-report previews, and manages Z-report close/undo.
// An X-report is a running snapshot of today's sales that can be pulled at any time.
// A Z-report is the end-of-day close: it archives the X-report totals and locks the day.
import { query, withClient } from '../db/pool.js';
import { getSchemaSupport } from '../db/compat.js';

// Formats a number as a two-decimal-place string for the report fields.
function money(value) {
  return Number(value || 0).toFixed(2);
}

// Normalizes a raw payment method string to CASH, CARD, or OTHER.
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

// Returns a zeroed-out report skeleton used when a Z has already been closed
// (the live X/Z queries would return wrong numbers once the day is archived).
function emptyReport(businessDate, signature = 'Manager', closedAt = null) {
  return {
    businessDate,
    sales: money(0),
    tax: money(0),
    cashPayments: money(0),
    cardPayments: money(0),
    otherPayments: money(0),
    voids: 0,
    hourly: [],
    signature,
    closedAt,
  };
}

// Checks whether today's Z-report has been closed. Returns { closed, closedAt, signature }.
export async function getZReportCloseStatus(businessDate) {
  const support = await getSchemaSupport();
  if (!support.hasReportDailyTotals) {
    return { closed: false, closedAt: null, signature: null };
  }

  const result = await query(
    `SELECT z_generated, z_generated_at, z_signature
     FROM report_daily_totals
     WHERE business_date = $1`,
    [businessDate]
  );
  const row = result.rows[0];
  return {
    closed: Boolean(row?.z_generated),
    closedAt: row?.z_generated_at || null,
    signature: row?.z_signature || null,
  };
}

// Computes today's sales, void count, and payment breakdown from the orders/payments tables.
// Unallocated revenue (orders without a matching payment row) is credited to CASH as a fallback.
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

// Breaks today's orders into hourly buckets for the X-report's hourly activity table.
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

// Assembles the full X-report for a given business date.
// Returns an empty report if the Z has already been closed so the UI shows zeroed data.
export async function buildXReport(businessDate) {
  const closeStatus = await getZReportCloseStatus(businessDate);
  if (closeStatus.closed) {
    return emptyReport(businessDate, closeStatus.signature || 'Manager', closeStatus.closedAt);
  }

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

// Builds the Z-report preview by extending the X-report with a close status and signature.
// Returns status: 'closed' if already reset, 'ready-to-close' otherwise.
export async function buildZPreview(businessDate, signature = 'Manager') {
  const report = await buildXReport(businessDate);
  const closeStatus = await getZReportCloseStatus(businessDate);
  const closedAt = closeStatus.closedAt;

  return {
    ...report,
    signature: closeStatus.signature || signature,
    closedAt,
    status: closeStatus.closed ? 'closed' : 'ready-to-close',
  };
}

// Closes the Z-report for today: upserts the daily totals into report_daily_totals,
// writes an immutable row to z_report_archive, and sets z_generated=TRUE.
// Uses a row-level lock (FOR UPDATE) to prevent double-closes under concurrent requests.
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

// Undoes the Z-report close for today: clears the z_generated flag and removes the archive row
// so the live X-report resumes accumulating orders normally.
export async function reopenZReport(businessDate) {
  const support = await getSchemaSupport();
  if (!support.hasReportDailyTotals || !support.hasZReportArchive) {
    throw new Error('Z report reset requires the report tables. Run database/migrations.sql first.');
  }

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const existing = await client.query(
        `SELECT z_generated
         FROM report_daily_totals
         WHERE business_date = $1
         FOR UPDATE`,
        [businessDate]
      );

      if (!existing.rows[0]?.z_generated) {
        throw new Error('Z report is not currently reset.');
      }

      await client.query(
        `UPDATE report_daily_totals
         SET z_generated = FALSE,
             z_generated_at = NULL,
             z_signature = NULL
         WHERE business_date = $1`,
        [businessDate]
      );
      await client.query('DELETE FROM z_report_archive WHERE business_date = $1', [businessDate]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return buildZPreview(businessDate);
}
