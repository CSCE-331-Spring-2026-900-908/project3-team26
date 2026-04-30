// compat.js: detects which optional tables and columns exist in the live database
// so routes can degrade gracefully on older schemas (e.g. the original Project 2 DB).
// Results are cached after the first call so we only hit information_schema once.
import { query, withClient } from './pool.js';

let cachedSupport;

// Queries information_schema to see which Project 3 columns/tables are present.
// Returns a support object that routes check before writing optional fields.
async function inspectSupport(client) {
  const orderSourceColumn = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM information_schema.columns
     WHERE table_name = 'orders' AND column_name = 'order_source'`
  );
  const orderPaymentsTable = await client.query(`SELECT to_regclass('public.order_payments') AS name`);
  const orderVoidsTable = await client.query(`SELECT to_regclass('public.order_voids') AS name`);
  const reportTotalsTable = await client.query(
    `SELECT to_regclass('public.report_daily_totals') AS name`
  );
  const zArchiveTable = await client.query(`SELECT to_regclass('public.z_report_archive') AS name`);

  return {
    hasOrderSource: Number(orderSourceColumn.rows[0].count) > 0,
    hasOrderPayments: Boolean(orderPaymentsTable.rows[0].name),
    hasOrderVoids: Boolean(orderVoidsTable.rows[0].name),
    hasReportDailyTotals: Boolean(reportTotalsTable.rows[0].name),
    hasZReportArchive: Boolean(zArchiveTable.rows[0].name),
  };
}

// Returns the cached support object, running inspectSupport once on first call.
// Clears the cache on failure so the next request retries rather than serving stale results.
export async function getSchemaSupport() {
  if (!cachedSupport) {
    cachedSupport = withClient(async (client) => inspectSupport(client)).catch((error) => {
      cachedSupport = undefined;
      throw error;
    });
  }

  return cachedSupport;
}

// Confirms the database is reachable and returns the schema support object.
// Called by the /api/health endpoint and by hosting platforms during startup checks.
export async function databaseHealthcheck() {
  await query('SELECT 1');
  return getSchemaSupport();
}
