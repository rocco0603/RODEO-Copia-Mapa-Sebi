import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, test } from 'vitest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { establecimiento, lote, clima, medicionOptica, medicionRadar } from '../helpers/fixtures.js';
import { migrateTestDatabase, resetTestDatabase } from '../helpers/db.js';

const tieneBaseDeTest = Boolean(process.env.TEST_DATABASE_URL);
const integration = tieneBaseDeTest ? describe : describe.skip;

if (!tieneBaseDeTest) console.warn('TEST_DATABASE_URL no configurada: tests de integración omitidos para no tocar DATABASE_URL.');

let app: Express;
let pool: Pool;

type Agent = ReturnType<typeof request.agent>;

async function registrar(username: string, password = 'password-segura-2026'): Promise<Agent> {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send({ username, password });
  expect(response.status).toBe(201);
  return agent;
}

async function crearEstablecimiento(agent: Agent) {
  const response = await agent.post('/api/establecimiento').send({ nombre: 'Campo de prueba', polygon: establecimiento });
  expect(response.status).toBe(201);
  return response.body.establecimiento;
}

async function crearLote(agent: Agent, min = 1, max = 2) {
  const response = await agent.post('/api/lotes').send({ polygon: lote(min, max) });
  expect(response.status).toBe(201);
  return response.body.lote;
}

async function prepararLote(username = `usuario_${Date.now()}_${Math.random()}`) {
  const agent = await registrar(username);
  await crearEstablecimiento(agent);
  const lot = await crearLote(agent);
  return { agent, lot };
}

integration('API backend de RODEO', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const modules = await Promise.all([import('../../src/app.js'), import('../../src/db/pool.js')]);
    app = modules[0].app;
    pool = modules[1].pool;
    await migrateTestDatabase(pool);
  });

  beforeEach(async () => { await resetTestDatabase(pool); });

  afterAll(async () => { await pool.end(); });

  describe('health y autenticación', () => {
    test('health responde ok y comprueba la base', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', database: 'ok' });
    });

    test('registra username trimmeado, hash y onboarding pendiente', async () => {
      const agent = request.agent(app);
      const response = await agent.post('/api/auth/register').send({ username: '  ana  ', password: 'password-segura-2026' });
      expect(response.status).toBe(201);
      expect(response.body.user.username).toBe('ana');
      expect(response.body.user.onboardingCompleted).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain('password_hash');
      const row = await pool.query('SELECT username, password_hash, onboarding_completed_at FROM usuarios WHERE username = $1', ['ana']);
      expect(row.rows[0].password_hash).not.toBe('password-segura-2026');
      expect(row.rows[0].onboarding_completed_at).toBeNull();
    });

    test('rechaza payload inválido y username duplicado', async () => {
      const agent = request.agent(app);
      expect((await agent.post('/api/auth/register').send({ username: 'corto', password: '123' })).status).toBe(400);
      expect((await agent.post('/api/auth/register').send({ username: 'duplicado', password: 'password-segura-2026' })).status).toBe(201);
      const duplicate = await request(app).post('/api/auth/register').send({ username: 'duplicado', password: 'password-segura-2026' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('USERNAME_TAKEN');
    });

    test('login no filtra usuario inexistente, crea cookie HttpOnly y /me devuelve la sesión', async () => {
      await registrar('login_user');
      const wrongUser = await request(app).post('/api/auth/login').send({ username: 'no_existe', password: 'password-segura-2026' });
      const wrongPassword = await request(app).post('/api/auth/login').send({ username: 'login_user', password: 'incorrecta-2026' });
      expect(wrongUser.status).toBe(401);
      expect(wrongPassword.status).toBe(401);
      expect(wrongUser.body.error.code).toBe('INVALID_CREDENTIALS');
      const agent = request.agent(app);
      const login = await agent.post('/api/auth/login').send({ username: 'login_user', password: 'password-segura-2026' });
      expect(login.status).toBe(200);
      expect(login.headers['set-cookie'][0]).toMatch(/rodeo_session=.*HttpOnly/);
      expect(login.body).not.toHaveProperty('token');
      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user.username).toBe('login_user');
      expect(me.body.user.onboardingCompleted).toBe(false);
    });

    test('logout invalida el flujo de sesión del agente', async () => {
      const agent = await registrar('logout_user');
      expect((await agent.post('/api/auth/logout')).status).toBe(204);
      expect((await agent.get('/api/auth/me')).status).toBe(401);
      expect((await request(app).get('/api/auth/me')).status).toBe(401);
    });
  });

  describe('gateway Copernicus', () => {
    test('rechaza usuario sin sesiÃ³n', async () => {
      expect((await request(app).get('/api/copernicus/estado')).status).toBe(401);
      expect((await request(app).post('/api/copernicus/statistics').send({})).status).toBe(401);
    });

    test('estado refleja credenciales opcionales', async () => {
      const anteriorId = process.env.COPERNICUS_CLIENT_ID;
      const anteriorSecret = process.env.COPERNICUS_CLIENT_SECRET;
      try {
        const { agent } = await prepararLote('copernicus_state_user');
        delete process.env.COPERNICUS_CLIENT_ID;
        delete process.env.COPERNICUS_CLIENT_SECRET;
        expect((await agent.get('/api/copernicus/estado')).body).toEqual({ configurado: false });
        process.env.COPERNICUS_CLIENT_ID = 'id-de-prueba';
        process.env.COPERNICUS_CLIENT_SECRET = 'secret-de-prueba';
        expect((await agent.get('/api/copernicus/estado')).body).toEqual({ configurado: true });
      } finally {
        if (anteriorId === undefined) delete process.env.COPERNICUS_CLIENT_ID; else process.env.COPERNICUS_CLIENT_ID = anteriorId;
        if (anteriorSecret === undefined) delete process.env.COPERNICUS_CLIENT_SECRET; else process.env.COPERNICUS_CLIENT_SECRET = anteriorSecret;
      }
    });

    test('statistics devuelve 503 controlado sin credenciales', async () => {
      const anteriorId = process.env.COPERNICUS_CLIENT_ID;
      const anteriorSecret = process.env.COPERNICUS_CLIENT_SECRET;
      try {
        const { agent } = await prepararLote('copernicus_missing_user');
        delete process.env.COPERNICUS_CLIENT_ID;
        delete process.env.COPERNICUS_CLIENT_SECRET;
        const response = await agent.post('/api/copernicus/statistics').send({ input: {} });
        expect(response.status).toBe(503);
        expect(response.body.error.code).toBe('COPERNICUS_NOT_CONFIGURED');
      } finally {
        if (anteriorId === undefined) delete process.env.COPERNICUS_CLIENT_ID; else process.env.COPERNICUS_CLIENT_ID = anteriorId;
        if (anteriorSecret === undefined) delete process.env.COPERNICUS_CLIENT_SECRET; else process.env.COPERNICUS_CLIENT_SECRET = anteriorSecret;
      }
    });
  });

  describe('establecimiento y onboarding', () => {
    test('crea, lee, renombra y rechaza un segundo establecimiento', async () => {
      const agent = await registrar('establecimiento_user');
      expect((await agent.get('/api/establecimiento')).body.establecimiento).toBeNull();
      await crearEstablecimiento(agent);
      expect((await agent.post('/api/establecimiento').send({ nombre: 'Otro', polygon: establecimiento })).body.error.code).toBe('ESTABLISHMENT_EXISTS');
      const patch = await agent.patch('/api/establecimiento').send({ nombre: 'Campo renombrado' });
      expect(patch.status).toBe(200);
      expect(patch.body.establecimiento.nombre).toBe('Campo renombrado');
      expect((await agent.post('/api/establecimiento').send({ nombre: '', polygon: establecimiento })).body.error.code).toBe('INVALID_NAME');
      expect((await agent.post('/api/establecimiento').send({ nombre: 'Invalido', polygon: { type: 'Point' } })).body.error.code).toBe('INVALID_POLYGON');
    });

    test('el primer lote completa onboarding y /me lo refleja', async () => {
      const { agent } = await prepararLote('onboarding_user');
      const me = await agent.get('/api/auth/me');
      expect(me.body.user.onboardingCompleted).toBe(true);
    });
  });

  describe('aislamiento y geometría', () => {
    test('un usuario no puede operar sobre establecimiento, lote ni historial ajenos', async () => {
      const owner = await prepararLote('owner_user');
      const other = await registrar('other_user');
      expect((await other.get('/api/establecimiento')).body.establecimiento).toBeNull();
      expect((await other.get('/api/lotes')).status).toBe(409);
      const paths = [
        other.patch(`/api/lotes/${owner.lot.id}`).send({ activo: false }),
        other.delete(`/api/lotes/${owner.lot.id}`),
        other.get(`/api/lotes/${owner.lot.id}/historial`),
        other.post(`/api/lotes/${owner.lot.id}/mediciones-satelitales`).send(medicionOptica),
        other.post(`/api/lotes/${owner.lot.id}/clima`).send(clima()),
        other.post(`/api/lotes/${owner.lot.id}/usos`).send({ fecha: '2026-08-20' }),
        other.get(`/api/lotes/${owner.lot.id}/estado`),
      ];
      for (const response of await Promise.all(paths)) expect(response.status).toBe(404);
    });

    test('rechaza lotes fuera, parcialmente fuera y superpuestos', async () => {
      const agent = await registrar('geometry_create_user');
      await crearEstablecimiento(agent);
      expect((await agent.post('/api/lotes').send({ polygon: lote(20, 21) })).body.error.code).toBe('LOT_OUTSIDE_ESTABLISHMENT');
      expect((await agent.post('/api/lotes').send({ polygon: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[9, 9], [11, 9], [11, 11], [9, 11], [9, 9]]] } } })).body.error.code).toBe('LOT_OUTSIDE_ESTABLISHMENT');
      await crearLote(agent, 1, 3);
      expect((await agent.post('/api/lotes').send({ polygon: lote(2, 4) })).body.error.code).toBe('LOT_OVERLAPS_EXISTING');
    });

    test('edición de establecimiento protege lotes activos e inactivos, pero no soft-deleted', async () => {
      const agent = await registrar('boundary_user');
      await crearEstablecimiento(agent);
      const lot = await crearLote(agent, 6, 8);
      const invalid = await agent.patch('/api/establecimiento').send({ polygon: lote(0, 7) });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('ESTABLISHMENT_GEOMETRY_INVALID');
      expect((await agent.get('/api/establecimiento')).body.establecimiento.polygon).toEqual(establecimiento);
      expect((await agent.patch(`/api/lotes/${lot.id}`).send({ activo: false })).status).toBe(200);
      expect((await agent.patch('/api/establecimiento').send({ polygon: lote(0, 7) })).status).toBe(400);
      expect((await agent.delete(`/api/lotes/${lot.id}`)).status).toBe(204);
      expect((await agent.patch('/api/establecimiento').send({ polygon: lote(0, 7) })).status).toBe(200);
    });

    test('edita un lote, pero conserva el polygon anterior cuando falla', async () => {
      const agent = await registrar('lot_edit_user');
      await crearEstablecimiento(agent);
      const first = await crearLote(agent, 1, 2);
      await crearLote(agent, 4, 5);
      expect((await agent.patch(`/api/lotes/${first.id}`).send({ polygon: lote(2, 3) })).status).toBe(200);
      const outside = await agent.patch(`/api/lotes/${first.id}`).send({ polygon: lote(9, 11) });
      expect(outside.body.error.code).toBe('LOT_OUTSIDE_ESTABLISHMENT');
      const overlap = await agent.patch(`/api/lotes/${first.id}`).send({ polygon: lote(4.2, 4.8) });
      expect(overlap.body.error.code).toBe('LOT_OVERLAPS_EXISTING');
      const row = await pool.query('SELECT polygon FROM lotes WHERE id = $1', [first.id]);
      expect(row.rows[0].polygon).toEqual(lote(2, 3));
    });
  });

  describe('lotes, numeración, soft delete y estado', () => {
    test('asigna números históricos y no reutiliza el de un lote eliminado', async () => {
      const agent = await registrar('numbering_user');
      await crearEstablecimiento(agent);
      const first = await crearLote(agent, 1, 2);
      const second = await crearLote(agent, 3, 4);
      expect(second.numero).toBe(2);
      expect((await agent.delete(`/api/lotes/${second.id}`)).status).toBe(204);
      const third = await crearLote(agent, 5, 6);
      expect(third.numero).toBe(3);
      expect((await agent.delete(`/api/lotes/${second.id}`)).body.error.code).toBe('LOT_NOT_FOUND');
      const dbRow = await pool.query('SELECT deleted_at FROM lotes WHERE id = $1', [second.id]);
      expect(dbRow.rows[0].deleted_at).not.toBeNull();
      const list = await agent.get('/api/lotes');
      expect(list.body.lotes.map((item: { id: string }) => item.id)).toEqual([first.id, third.id]);
    });

    test('persiste activar y desactivar un lote', async () => {
      const { agent, lot } = await prepararLote('active_user');
      expect((await agent.patch(`/api/lotes/${lot.id}`).send({ activo: false })).body.lote.activo).toBe(false);
      expect((await agent.patch(`/api/lotes/${lot.id}`).send({ activo: true })).body.lote.activo).toBe(true);
      expect((await pool.query('SELECT activo FROM lotes WHERE id = $1', [lot.id])).rows[0].activo).toBe(true);
    });
  });

  describe('persistencia satelital', () => {
    test('separa Sentinel-2 y Sentinel-1 y conserva sólo sus campos aplicables', async () => {
      const { agent, lot } = await prepararLote('satellite_user');
      const optical = await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send(medicionOptica);
      const radar = await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send(medicionRadar);
      expect(optical.status).toBe(201);
      expect(radar.status).toBe(201);
      expect(optical.body.medicion.ndvi.mediana).toBe(0.52);
      expect(optical.body.medicion.observedAt).toBe('2026-08-16');
      expect(optical.body.medicion.consultedAt).toBe('2026-08-20T12:00:00.000Z');
      expect(optical.body.medicion.rvi.mediana).toBeNull();
      expect(radar.body.medicion.rvi.mediana).toBe(0.62);
      expect(radar.body.medicion.ndvi.mediana).toBeNull();
      expect(radar.body.medicion.puntaje).toBeNull();
      expect((await pool.query('SELECT COUNT(*)::int AS count FROM mediciones_satelitales WHERE lote_id = $1', [lot.id])).rows[0].count).toBe(2);
    });

    test('hace upsert por lote, fuente y fecha, pero mantiene fuentes separadas', async () => {
      const { agent, lot } = await prepararLote('upsert_user');
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send(medicionOptica);
      const updated = { ...medicionOptica, consultedAt: '2026-08-20T13:00:00.000Z', puntaje: 90 };
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send(updated);
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send(medicionRadar);
      const rows = await pool.query('SELECT fuente, observed_at, puntaje, consulted_at FROM mediciones_satelitales WHERE lote_id = $1 ORDER BY fuente', [lot.id]);
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0].observed_at).toBe('2026-08-16');
      expect(rows.rows.find((row) => row.fuente === 'sentinel-2').puntaje).toBe(90);
    });

    test('persiste alertas Sentinel-2 como JSON y las conserva en el upsert', async () => {
      const { agent, lot } = await prepararLote('satellite_alerts_user');
      const payload = { ...medicionOptica, alertas: ['dato antiguo', 'cobertura baja'] };
      const primera = await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send(payload);
      expect(primera.status).toBe(201);

      const historial = await agent.get(`/api/lotes/${lot.id}/mediciones-satelitales?fuente=sentinel-2`);
      expect(historial.status).toBe(200);
      expect(historial.body.mediciones[0].alertas).toEqual(['dato antiguo', 'cobertura baja']);

      const segunda = await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...payload, alertas: ['cobertura actualizada'], puntaje: 90 });
      expect(segunda.status).toBe(201);
      expect((await pool.query('SELECT COUNT(*)::int AS count FROM mediciones_satelitales WHERE lote_id = $1 AND fuente = $2', [lot.id, 'sentinel-2'])).rows[0].count).toBe(1);
      expect((await agent.get(`/api/lotes/${lot.id}/mediciones-satelitales?fuente=sentinel-2`)).body.mediciones[0].alertas).toEqual(['cobertura actualizada']);
    });

    test('rechaza fuente, fecha y estadísticas inválidas', async () => {
      const { agent, lot } = await prepararLote('invalid_satellite_user');
      expect((await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...medicionOptica, fuente: 'fake' })).body.error.code).toBe('INVALID_SOURCE');
      expect((await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...medicionOptica, observedAt: '16/08/2026' })).body.error.code).toBe('INVALID_DATE');
      expect((await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...medicionOptica, ndvi: { mediana: 'no-numero' } })).body.error.code).toBe('INVALID_NUMBER');
    });
  });

  describe('clima y transacciones', () => {
    test('guarda consulta y días con forecast y valores meteorológicos', async () => {
      const { agent, lot } = await prepararLote('climate_user');
      const response = await agent.post(`/api/lotes/${lot.id}/clima`).send(clima());
      expect(response.status).toBe(201);
      const rows = await pool.query('SELECT c.id, d.fecha, d.es_pronostico, d.lluvia_mm FROM consultas_clima c JOIN dias_clima d ON d.consulta_clima_id = c.id WHERE c.lote_id = $1 ORDER BY d.fecha', [lot.id]);
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows.map((row) => row.es_pronostico)).toEqual([false, true]);
      expect(rows.rows[0].lluvia_mm).toBe(2.5);
    });

    test('revierte consulta y días si un día inválido falla dentro de la transacción', async () => {
      const { agent, lot } = await prepararLote('climate_transaction_user');
      const payload = clima();
      payload.dias.push({ fecha: '2026-08-22', lluviaMm: 1, tempMin: 10, tempMax: 20, esPronostico: 'no' as never });
      expect((await agent.post(`/api/lotes/${lot.id}/clima`).send(payload)).status).toBe(400);
      expect((await pool.query('SELECT COUNT(*)::int AS count FROM consultas_clima WHERE lote_id = $1', [lot.id])).rows[0].count).toBe(0);
      expect((await pool.query('SELECT COUNT(*)::int AS count FROM dias_clima')).rows[0].count).toBe(0);
    });

    test('deduplica automático reciente y conserva snapshots manuales', async () => {
      const { agent, lot } = await prepararLote('climate_origin_user');
      const automatic = clima('automatico');
      expect((await agent.post(`/api/lotes/${lot.id}/clima`).send(automatic)).status).toBe(201);
      const repeated = await agent.post(`/api/lotes/${lot.id}/clima`).send({ ...automatic, lluviaUltimos7Dias: 99 });
      expect(repeated.status).toBe(200);
      expect(repeated.body.omitido).toBe('reciente');
      expect((await agent.post(`/api/lotes/${lot.id}/clima`).send(clima())).status).toBe(201);
      expect((await agent.post(`/api/lotes/${lot.id}/clima`).send(clima())).status).toBe(201);
      expect((await pool.query('SELECT COUNT(*)::int AS count FROM consultas_clima WHERE lote_id = $1', [lot.id])).rows[0].count).toBe(3);
    });
  });

  describe('usos e historial consolidado', () => {
    test('conserva usos múltiples y los ordena por fecha descendente', async () => {
      const { agent, lot } = await prepararLote('usage_user');
      await agent.post(`/api/lotes/${lot.id}/usos`).send({ fecha: '2026-08-14' });
      await agent.post(`/api/lotes/${lot.id}/usos`).send({ fecha: '2026-08-20' });
      const response = await agent.get(`/api/lotes/${lot.id}/usos`);
      expect(response.status).toBe(200);
      expect(response.body.usos.map((item: { fecha: string }) => item.fecha)).toEqual(['2026-08-20', '2026-08-14']);
      expect(response.body.usos[0].createdAt).toMatch(/T/);
      expect((await pool.query('SELECT COUNT(*)::int AS count FROM usos_lote WHERE lote_id = $1', [lot.id])).rows[0].count).toBe(2);
    });

    test('historial devuelve satélite, clima y usos únicamente del lote pedido', async () => {
      const { agent, lot } = await prepararLote('history_user');
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send(medicionRadar);
      await agent.post(`/api/lotes/${lot.id}/clima`).send(clima());
      await agent.post(`/api/lotes/${lot.id}/usos`).send({ fecha: '2026-08-20' });
      const history = await agent.get(`/api/lotes/${lot.id}/historial`);
      expect(history.status).toBe(200);
      expect(history.body.satelite).toHaveLength(1);
      expect(history.body.clima).toHaveLength(1);
      expect(history.body.usos).toHaveLength(1);
      expect(history.body.satelite[0].fuente).toBe('sentinel-1');
    });
  });

  describe('paginación y filtros de historial', () => {
    test('pagina mediciones con total y hayMas, y filtra por fuente y fechas', async () => {
      const { agent, lot } = await prepararLote('pagination_satellite_user');
      for (const [fuente, fechas] of [['sentinel-2', ['2026-08-16', '2026-08-17', '2026-08-18']], ['sentinel-1', ['2026-08-10']]] as const) {
        for (const observedAt of fechas) await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...(fuente === 'sentinel-2' ? medicionOptica : medicionRadar), fuente, observedAt });
      }
      const primera = await agent.get(`/api/lotes/${lot.id}/mediciones-satelitales?limit=2&offset=0`);
      expect(primera.body.mediciones).toHaveLength(2);
      expect(primera.body.mediciones.map((item: { observedAt: string }) => item.observedAt)).toEqual(['2026-08-18', '2026-08-17']);
      expect(primera.body.paginacion).toEqual({ limit: 2, offset: 0, total: 4, hayMas: true });
      const segunda = await agent.get(`/api/lotes/${lot.id}/mediciones-satelitales?limit=2&offset=2`);
      expect(segunda.body.mediciones).toHaveLength(2);
      const soloRadar = await agent.get(`/api/lotes/${lot.id}/mediciones-satelitales?fuente=sentinel-1&desde=2026-08-09&hasta=2026-08-11`);
      expect(soloRadar.body.mediciones).toHaveLength(1);
      expect(soloRadar.body.mediciones[0].fuente).toBe('sentinel-1');
    });

    test('pagina y filtra usos y clima sin cambiar sus fechas calendario', async () => {
      const { agent, lot } = await prepararLote('pagination_history_user');
      for (const fecha of ['2026-08-14', '2026-08-15', '2026-08-16']) await agent.post(`/api/lotes/${lot.id}/usos`).send({ fecha });
      const usos = await agent.get(`/api/lotes/${lot.id}/usos?limit=2&offset=0&desde=2026-08-14&hasta=2026-08-16`);
      expect(usos.body.usos.map((item: { fecha: string }) => item.fecha)).toEqual(['2026-08-16', '2026-08-15']);
      expect(usos.body.paginacion).toEqual({ limit: 2, offset: 0, total: 3, hayMas: true });
      for (const [dia, lluvia] of [['2026-08-16', 1], ['2026-08-17', 2], ['2026-08-18', 3]] as const) {
        await agent.post(`/api/lotes/${lot.id}/clima`).send({ ...clima('manual'), consultedAt: `${dia}T12:00:00.000Z`, dias: [{ fecha: dia, lluviaMm: lluvia, tempMin: 8, tempMax: 20, esPronostico: false }] });
      }
      const climaPage = await agent.get(`/api/lotes/${lot.id}/clima?limit=2&offset=1&desde=2026-08-17&hasta=2026-08-18`);
      expect(climaPage.body.consultas).toHaveLength(1);
      expect(climaPage.body.paginacion.total).toBe(2);
      expect(climaPage.body.consultas[0].dias[0].fecha).toMatch(/^2026-08-/);
    });

    test('rechaza parámetros de paginación, fechas y fuente inválidos', async () => {
      const { agent, lot } = await prepararLote('invalid_query_user');
      for (const query of ['limit=0', 'limit=-1', 'limit=abc', 'limit=101', 'offset=-1', 'desde=2026-02-30', 'hasta=2026-01-01&desde=2026-01-02', 'fuente=landsat']) {
        expect((await agent.get(`/api/lotes/${lot.id}/mediciones-satelitales?${query}`)).status).toBe(400);
      }
    });
  });

  describe('estado actual consolidado', () => {
    test('devuelve sólo la medición óptica, radar, clima y uso más recientes', async () => {
      const { agent, lot } = await prepararLote('state_user');
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...medicionOptica, observedAt: '2026-08-10' });
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...medicionOptica, observedAt: '2026-08-18', puntaje: 90 });
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...medicionRadar, observedAt: '2026-08-11' });
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send({ ...medicionRadar, observedAt: '2026-08-19' });
      await agent.post(`/api/lotes/${lot.id}/clima`).send({ ...clima('manual'), consultedAt: '2026-08-10T12:00:00.000Z' });
      await agent.post(`/api/lotes/${lot.id}/clima`).send({ ...clima('manual'), consultedAt: '2026-08-19T12:00:00.000Z' });
      await agent.post(`/api/lotes/${lot.id}/usos`).send({ fecha: '2026-08-14' });
      await agent.post(`/api/lotes/${lot.id}/usos`).send({ fecha: '2026-08-19' });
      const response = await agent.get(`/api/lotes/${lot.id}/estado`);
      expect(response.status).toBe(200);
      expect(response.body.satelite.optico.observedAt).toBe('2026-08-18');
      expect(response.body.satelite.optico.puntaje).toBe(90);
      expect(response.body.satelite.radar.observedAt).toBe('2026-08-19');
      expect(response.body.satelite.radar).not.toHaveProperty('puntaje');
      expect(response.body.clima.consultedAt).toBe('2026-08-19T12:00:00.000Z');
      expect(response.body.uso.ultimoUso).toEqual({ fecha: '2026-08-19', origen: 'manual' });
      expect(response.body.uso.diasDescanso).toBeGreaterThanOrEqual(0);
    });

    test('representa correctamente un lote sin historial', async () => {
      const { agent, lot } = await prepararLote('empty_state_user');
      const response = await agent.get(`/api/lotes/${lot.id}/estado`);
      expect(response.body.satelite).toEqual({ optico: null, radar: null });
      expect(response.body.clima).toBeNull();
      expect(response.body.uso).toEqual({ ultimoUso: null, diasDescanso: null });
    });

    test('devuelve todos los lotes activos ordenados y conserva datos separados por lote', async () => {
      const agent = await registrar('bulk_state_user');
      await crearEstablecimiento(agent);
      const lote1 = await crearLote(agent, 1, 2);
      const lote2 = await crearLote(agent, 3, 4);
      const lote3 = await crearLote(agent, 5, 6);
      await agent.post(`/api/lotes/${lote1.id}/mediciones-satelitales`).send({ ...medicionOptica, ndvi: { ...medicionOptica.ndvi, mediana: 0.2 } });
      await agent.post(`/api/lotes/${lote1.id}/clima`).send(clima('manual'));
      await agent.post(`/api/lotes/${lote1.id}/usos`).send({ fecha: '2026-08-19' });
      await agent.post(`/api/lotes/${lote2.id}/mediciones-satelitales`).send({ ...medicionOptica, ndvi: { ...medicionOptica.ndvi, mediana: 0.8 } });
      const response = await agent.get('/api/lotes/estado');
      expect(response.status).toBe(200);
      expect(response.body.lotes.map((item: { lote: { numero: number } }) => item.lote.numero)).toEqual([1, 2, 3]);
      expect(response.body.lotes[0].satelite.optico.ndvi.mediana).toBe(0.2);
      expect(response.body.lotes[1].satelite.optico.ndvi.mediana).toBe(0.8);
      expect(response.body.lotes[1].clima).toBeNull();
      expect(response.body.lotes[2].satelite).toEqual({ optico: null, radar: null });
      expect(response.body.lotes[2].clima).toBeNull();
      expect(response.body.lotes[2].uso).toEqual({ ultimoUso: null, diasDescanso: null });
      expect(lote3.id).toBe(response.body.lotes[2].lote.id);
    });

    test('filtra inactivos y nunca devuelve soft-deleted', async () => {
      const agent = await registrar('bulk_inactive_user');
      await crearEstablecimiento(agent);
      const activo = await crearLote(agent, 1, 2);
      const inactivo = await crearLote(agent, 3, 4);
      await agent.patch(`/api/lotes/${inactivo.id}`).send({ activo: false });
      expect((await agent.get('/api/lotes/estado')).body.lotes.map((item: { lote: { id: string } }) => item.lote.id)).toEqual([activo.id]);
      const ambos = await agent.get('/api/lotes/estado?incluirInactivos=true');
      expect(ambos.body.lotes.map((item: { lote: { id: string } }) => item.lote.id)).toEqual([activo.id, inactivo.id]);
      await agent.delete(`/api/lotes/${inactivo.id}`);
      expect((await agent.get('/api/lotes/estado?incluirInactivos=true')).body.lotes.map((item: { lote: { id: string } }) => item.lote.id)).toEqual([activo.id]);
    });

    test('aísla el estado consolidado entre usuarios y valida incluirInactivos', async () => {
      const owner = await prepararLote('bulk_owner_user');
      const other = await prepararLote('bulk_other_user');
      const foreign = await other.agent.get('/api/lotes/estado');
      expect(foreign.body.lotes).toHaveLength(1);
      expect(foreign.body.lotes[0].lote.id).toBe(other.lot.id);
      expect(foreign.body.lotes[0].lote.id).not.toBe(owner.lot.id);
      expect((await owner.agent.get('/api/lotes/estado?incluirInactivos=hola')).status).toBe(400);
    });

    test('mantiene consistencia conceptual entre estado individual y colección', async () => {
      const { agent, lot } = await prepararLote('bulk_consistency_user');
      await agent.post(`/api/lotes/${lot.id}/mediciones-satelitales`).send(medicionRadar);
      const individual = await agent.get(`/api/lotes/${lot.id}/estado`);
      const collection = await agent.get('/api/lotes/estado');
      const item = collection.body.lotes.find((estado: { lote: { id: string } }) => estado.lote.id === lot.id);
      expect(item).toBeDefined();
      expect(item.lote).toEqual(individual.body.lote);
      expect(item.satelite.radar.observedAt).toBe(individual.body.satelite.radar.observedAt);
      expect(item.satelite.radar.rvi).toEqual(individual.body.satelite.radar.rvi);
      expect(item.clima).toEqual(individual.body.clima);
      expect(item.uso).toEqual(individual.body.uso);
    });
  });
});
