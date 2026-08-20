import { pool } from '../src/db/pool.js';

const baseUrl = `http://localhost:${process.env.PORT ?? 3001}`;
const username = `rodeo_smoke_${Date.now()}`;
const password = 'smoke-password-2026';
const establecimiento = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] },
};
const loteValido = (min: number, max: number) => ({
  type: 'Feature', properties: {},
  geometry: { type: 'Polygon', coordinates: [[[min, min], [max, min], [max, max], [min, max], [min, min]]] },
});

let cookie = '';

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let body: unknown = null;
  if (response.status !== 204) body = await response.json();
  return { status: response.status, body };
}

function expect(status: number, actual: number, label: string): void {
  if (status !== actual) throw new Error(`${label}: esperado ${status}, recibido ${actual}`);
  console.log(`OK ${label} (${actual})`);
}

try {
  expect(200, (await request('/api/health')).status, 'health');
  cookie = '';
  expect(401, (await request('/api/auth/me')).status, 'me sin sesión');
  expect(201, (await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) })).status, 'registro');
  expect(409, (await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) })).status, 'username duplicado');
  expect(200, (await request('/api/auth/me')).status, 'me autenticado');
  expect(204, (await request('/api/auth/logout', { method: 'POST' })).status, 'logout');
  cookie = '';
  expect(401, (await request('/api/auth/me')).status, 'me después de logout');
  expect(200, (await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })).status, 'login');
  expect(401, (await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password: 'incorrecta-2026' }) })).status, 'login incorrecto');
  expect(201, (await request('/api/establecimiento', { method: 'POST', body: JSON.stringify({ nombre: 'Smoke', polygon: establecimiento }) })).status, 'crear establecimiento');
  expect(409, (await request('/api/establecimiento', { method: 'POST', body: JSON.stringify({ nombre: 'Segundo', polygon: establecimiento }) })).status, 'segundo establecimiento');
  expect(200, (await request('/api/establecimiento')).status, 'obtener establecimiento');
  expect(400, (await request('/api/lotes', { method: 'POST', body: JSON.stringify({ polygon: loteValido(20, 21) }) })).status, 'lote fuera');
  expect(201, (await request('/api/lotes', { method: 'POST', body: JSON.stringify({ apodo: 'Primero', polygon: loteValido(1, 2) }) })).status, 'primer lote');
  expect(400, (await request('/api/lotes', { method: 'POST', body: JSON.stringify({ polygon: loteValido(1.5, 2.5) }) })).status, 'lote superpuesto');
  const list = await request('/api/lotes');
  expect(200, list.status, 'listar lotes');
  const firstLot = (list.body as { lotes: Array<{ id: string; numero: number }> }).lotes[0];
  expect(200, (await request(`/api/lotes/${firstLot.id}`, { method: 'PATCH', body: JSON.stringify({ activo: false }) })).status, 'editar lote');
  expect(204, (await request(`/api/lotes/${firstLot.id}`, { method: 'DELETE' })).status, 'soft delete');
  expect(201, (await request('/api/lotes', { method: 'POST', body: JSON.stringify({ polygon: loteValido(3, 4) }) })).status, 'nuevo lote sin reutilizar número');
  expect(400, (await request('/api/establecimiento', { method: 'PATCH', body: JSON.stringify({ polygon: loteValido(0, 2) }) })).status, 'establecimiento deja lote afuera');
  const me = await request('/api/auth/me');
  expect(200, me.status, 'onboarding no se revierte');
  console.log('Smoke test completo.');
} finally {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM notificaciones WHERE user_id IN (SELECT id FROM usuarios WHERE username = $1)', [username]);
    await client.query('DELETE FROM mediciones_satelitales WHERE lote_id IN (SELECT l.id FROM lotes l JOIN establecimientos e ON e.id = l.establecimiento_id JOIN usuarios u ON u.id = e.user_id WHERE u.username = $1)', [username]);
    await client.query('DELETE FROM dias_clima WHERE consulta_clima_id IN (SELECT c.id FROM consultas_clima c JOIN lotes l ON l.id = c.lote_id JOIN establecimientos e ON e.id = l.establecimiento_id JOIN usuarios u ON u.id = e.user_id WHERE u.username = $1)', [username]);
    await client.query('DELETE FROM consultas_clima WHERE lote_id IN (SELECT l.id FROM lotes l JOIN establecimientos e ON e.id = l.establecimiento_id JOIN usuarios u ON u.id = e.user_id WHERE u.username = $1)', [username]);
    await client.query('DELETE FROM lotes WHERE establecimiento_id IN (SELECT e.id FROM establecimientos e JOIN usuarios u ON u.id = e.user_id WHERE u.username = $1)', [username]);
    await client.query('DELETE FROM establecimientos WHERE user_id IN (SELECT id FROM usuarios WHERE username = $1)', [username]);
    await client.query('DELETE FROM usuarios WHERE username = $1', [username]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await pool.end();
}
