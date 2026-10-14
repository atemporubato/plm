// Kör en SQL-fil mot Supabase: node tools/db.mjs supabase/migrations/0001_init.sql
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
// Läser .env i repots rot så att scripten kan köras direkt med node.
try { for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); } } catch {}
import { createRequire } from 'node:module';
const { Client } = createRequire(import.meta.url)('pg');
const ref = process.env.SUPABASE_URL.replace(/^https:\/\/([^.]+).*/, '$1');
export const client = () => new Client({ host: 'aws-1-eu-central-1.pooler.supabase.com', port: 5432, user: `postgres.${ref}`, database: 'postgres', password: process.env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } });
if (process.argv[2]) {
  const c = client(); await c.connect();
  try { await c.query('begin'); await c.query(await readFile(process.argv[2], 'utf8')); await c.query('commit'); console.log('OK', process.argv[2]); }
  catch (e) { await c.query('rollback'); console.error('FEL:', e.message, e.position ? 'pos ' + e.position : ''); process.exitCode = 1; }
  finally { await c.end(); }
}
