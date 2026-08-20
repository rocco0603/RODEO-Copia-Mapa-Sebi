import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pool } from '../src/db/pool.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationDirectory = scriptDirectory.endsWith('dist\\scripts') || scriptDirectory.endsWith('dist/scripts')
  ? '../../migrations'
  : '../migrations';
const migrationPath = resolve(scriptDirectory, migrationDirectory, '001_initial_schema.sql');

try {
  const sql = await readFile(migrationPath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migración 001 aplicada correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
