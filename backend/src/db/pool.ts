import { Pool } from 'pg';
import { env } from '../config/env.js';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  // Neon requiere TLS; esta opción no registra ni expone la URL de conexión.
});
