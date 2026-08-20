import { pool } from '../src/db/pool.js';

const tablasEsperadas = [
  'usuarios',
  'establecimientos',
  'lotes',
  'mediciones_satelitales',
  'consultas_clima',
  'dias_clima',
  'notificaciones',
];

const result = await pool.query<{ tablename: string }>(
  `SELECT tablename
   FROM pg_catalog.pg_tables
   WHERE schemaname = 'public' AND tablename = ANY($1::text[])
   ORDER BY tablename`,
  [tablasEsperadas],
);

console.log(result.rows.map((row) => row.tablename).join('\n'));
await pool.end();
