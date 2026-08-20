import { Pool, types } from 'pg';
import { env } from '../config/env.js';

// PostgreSQL DATE es una fecha de calendario, no un instante UTC. Mantenerlo
// como string evita que pg lo convierta a medianoche local y lo desplace por zona horaria.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  // Neon requiere TLS; esta opción no registra ni expone la URL de conexión.
});
