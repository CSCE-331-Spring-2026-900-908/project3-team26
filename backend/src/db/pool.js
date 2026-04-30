// Shared PostgreSQL connection pool used by every route and service.
// Prefers DATABASE_URL (Render/hosted) over individual PG* vars (local dev).
// SSL is enabled automatically for any non-localhost host.
// Environment files are loaded before pool creation so both local and hosted configs work.
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });
dotenv.config({ path: new URL('../../.env', import.meta.url) });
dotenv.config({ path: new URL('../../env', import.meta.url) });
dotenv.config();

const { Pool } = pg;
const host = process.env.PGHOST || 'localhost';
const sslMode = process.env.PGSSLMODE || '';
const shouldUseSsl =
  sslMode === 'require' ||
  (host !== 'localhost' && host !== '127.0.0.1' && host !== '');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: shouldUseSsl || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'bubble_tea_pos',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      ssl: shouldUseSsl || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

// One-shot query helper — use for simple SELECTs/INSERTs that don't need a transaction.
export async function query(text, params = []) {
  return pool.query(text, params);
}

// Checks out a dedicated client for multi-statement transactions (BEGIN/COMMIT/ROLLBACK).
// Always releases the client back to the pool even if the callback throws.
export async function withClient(callback) {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export default pool;
