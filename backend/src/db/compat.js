import { query, withClient } from './pool.js';

let cachedSupport;

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

export async function getSchemaSupport() {
  if (!cachedSupport) {
    cachedSupport = withClient(async (client) => inspectSupport(client)).catch((error) => {
      cachedSupport = undefined;
      throw error;
    });
  }

  return cachedSupport;
}

export async function databaseHealthcheck() {
  await query('SELECT 1');
  return getSchemaSupport();
}
