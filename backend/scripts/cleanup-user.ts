import { pool } from '../src/db/pool.js';

const username = process.env.SMOKE_USERNAME;
if (!username || !/^rodeo_smoke_[0-9]+$/.test(username)) throw new Error('SMOKE_USERNAME no tiene el formato esperado.');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('DELETE FROM notificaciones WHERE user_id IN (SELECT id FROM usuarios WHERE username = $1)', [username]);
  await client.query('DELETE FROM mediciones_satelitales WHERE lote_id IN (SELECT l.id FROM lotes l JOIN establecimientos e ON e.id = l.establecimiento_id JOIN usuarios u ON u.id = e.user_id WHERE u.username = $1)', [username]);
  await client.query('DELETE FROM dias_clima WHERE consulta_clima_id IN (SELECT c.id FROM consultas_clima c JOIN lotes l ON l.id = c.lote_id JOIN establecimientos e ON e.id = l.establecimiento_id JOIN usuarios u ON u.id = e.user_id WHERE u.username = $1)', [username]);
  await client.query('DELETE FROM consultas_clima WHERE lote_id IN (SELECT l.id FROM lotes l JOIN establecimientos e ON e.id = l.establecimiento_id JOIN usuarios u ON u.id = e.user_id WHERE u.username = $1)', [username]);
  await client.query('DELETE FROM lotes WHERE establecimiento_id IN (SELECT e.id FROM establecimientos e JOIN usuarios u ON u.id = e.user_id WHERE u.username = $1)', [username]);
  await client.query('DELETE FROM establecimientos WHERE user_id IN (SELECT id FROM usuarios WHERE username = $1)', [username]);
  const result = await client.query('DELETE FROM usuarios WHERE username = $1', [username]);
  await client.query('COMMIT');
  console.log(`Usuario smoke eliminado: ${result.rowCount ?? 0}`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
