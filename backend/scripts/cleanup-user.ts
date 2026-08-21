import { pool } from '../src/db/pool.js';
import { eliminarUsuarioSmoke } from './smoke-cleanup.js';

try {
  const eliminado = await eliminarUsuarioSmoke(pool, process.env.SMOKE_USERNAME);
  console.log(`Usuario smoke eliminado: ${eliminado ? 1 : 0}`);
} finally {
  await pool.end();
}
