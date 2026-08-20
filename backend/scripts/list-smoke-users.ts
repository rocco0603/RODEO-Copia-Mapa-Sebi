import { pool } from '../src/db/pool.js';

const result = await pool.query<{ username: string }>("SELECT username FROM usuarios WHERE username LIKE 'rodeo_smoke_%' ORDER BY username");
console.log(result.rows.map((row) => row.username).join('\n'));
await pool.end();
