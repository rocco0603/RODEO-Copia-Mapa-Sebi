import { Router, type Request } from 'express';
import { pool } from '../db/pool.js';
import { requiereAutenticacion } from '../auth/middleware.js';
import { asyncHandler } from '../http/async-handler.js';
import { ApiError } from '../http/errors.js';

export const historialRouter = Router();
historialRouter.use(requiereAutenticacion);

type Estadistica = { media?: number | null; mediana?: number | null; min?: number | null; max?: number | null; desvio?: number | null };

function userId(req: Request): string {
  if (!req.usuario) throw new ApiError(401, 'UNAUTHENTICATED', 'Necesitás iniciar sesión.');
  return req.usuario.id;
}

async function loteDelUsuario(req: Request): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `SELECT l.id FROM lotes l JOIN establecimientos e ON e.id = l.establecimiento_id
     WHERE l.id = $1 AND e.user_id = $2 AND l.deleted_at IS NULL`,
    [req.params.id, userId(req)],
  );
  if (!result.rows[0]) throw new ApiError(404, 'LOT_NOT_FOUND', 'Lote inexistente.');
  return result.rows[0].id;
}

function fechaCalendario(value: unknown, campo: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, 'INVALID_DATE', `${campo} debe tener formato YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(400, 'INVALID_DATE', `${campo} no es una fecha válida.`);
  return value;
}

function timestamp(value: unknown, campo: string): Date {
  const date = new Date(typeof value === 'number' ? value : String(value ?? ''));
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'INVALID_TIMESTAMP', `${campo} no es válido.`);
  return date;
}

function nullableNumber(value: unknown, campo: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiError(400, 'INVALID_NUMBER', `${campo} debe ser numérico.`);
  return value;
}

function statistic(value: unknown, campo: string): Estadistica {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object') throw new ApiError(400, 'INVALID_STATISTICS', `${campo} no es válido.`);
  const item = value as Record<string, unknown>;
  return {
    media: nullableNumber(item.media, `${campo}.media`),
    mediana: nullableNumber(item.mediana, `${campo}.mediana`),
    min: nullableNumber(item.min, `${campo}.min`),
    max: nullableNumber(item.max, `${campo}.max`),
    desvio: nullableNumber(item.desvio, `${campo}.desvio`),
  };
}

function measurementDto(row: Record<string, unknown>) {
  return {
    id: row.id, fuente: row.fuente, observedAt: row.observed_at, consultedAt: row.consulted_at,
    coberturaValida: row.cobertura_valida,
    ndvi: { media: row.ndvi_media, mediana: row.ndvi_mediana, min: row.ndvi_min, max: row.ndvi_max, desvio: row.ndvi_desvio },
    ndmi: { media: row.ndmi_media, mediana: row.ndmi_mediana, min: row.ndmi_min, max: row.ndmi_max, desvio: row.ndmi_desvio },
    ndwi: { media: row.ndwi_media, mediana: row.ndwi_mediana, min: row.ndwi_min, max: row.ndwi_max, desvio: row.ndwi_desvio },
    evi: { media: row.evi_media, mediana: row.evi_mediana, min: row.evi_min, max: row.evi_max, desvio: row.evi_desvio },
    rvi: { media: row.rvi_media, mediana: row.rvi_mediana, min: row.rvi_min, max: row.rvi_max, desvio: row.rvi_desvio },
    puntaje: row.puntaje, categoria: row.categoria, alertas: row.alertas, rawMetadata: row.raw_metadata,
  };
}

historialRouter.post('/:id/mediciones-satelitales', asyncHandler(async (req, res) => {
  const loteId = await loteDelUsuario(req);
  const body = req.body as Record<string, unknown>;
  if (body.fuente !== 'sentinel-1' && body.fuente !== 'sentinel-2') throw new ApiError(400, 'INVALID_SOURCE', 'La fuente satelital no es válida.');
  const observedAt = fechaCalendario(body.observedAt, 'observedAt');
  const consultedAt = timestamp(body.consultedAt, 'consultedAt');
  const ndvi = statistic(body.ndvi, 'ndvi'); const ndmi = statistic(body.ndmi, 'ndmi');
  const ndwi = statistic(body.ndwi, 'ndwi'); const evi = statistic(body.evi, 'evi'); const rvi = statistic(body.rvi, 'rvi');
  const puntaje = body.puntaje === undefined || body.puntaje === null ? null : nullableNumber(body.puntaje, 'puntaje');
  if (puntaje !== null && !Number.isInteger(puntaje)) throw new ApiError(400, 'INVALID_SCORE', 'puntaje debe ser entero.');
  const categoria = body.categoria === undefined || body.categoria === null ? null : typeof body.categoria === 'string' ? body.categoria : (() => { throw new ApiError(400, 'INVALID_CATEGORY', 'categoria debe ser texto.'); })();
  const values = [loteId, body.fuente, observedAt, consultedAt, nullableNumber(body.coberturaValida, 'coberturaValida'), ndvi.media, ndvi.mediana, ndvi.min, ndvi.max, ndvi.desvio, ndmi.media, ndmi.mediana, ndmi.min, ndmi.max, ndmi.desvio, ndwi.media, ndwi.mediana, ndwi.min, ndwi.max, ndwi.desvio, evi.media, evi.mediana, evi.min, evi.max, evi.desvio, rvi.media, rvi.mediana, rvi.min, rvi.max, rvi.desvio, puntaje, categoria, body.alertas ?? null, body.rawMetadata ?? null];
  const result = await pool.query(
    `INSERT INTO mediciones_satelitales (lote_id, fuente, observed_at, consulted_at, cobertura_valida,
      ndvi_media, ndvi_mediana, ndvi_min, ndvi_max, ndvi_desvio, ndmi_media, ndmi_mediana, ndmi_min, ndmi_max, ndmi_desvio,
      ndwi_media, ndwi_mediana, ndwi_min, ndwi_max, ndwi_desvio, evi_media, evi_mediana, evi_min, evi_max, evi_desvio,
      rvi_media, rvi_mediana, rvi_min, rvi_max, rvi_desvio, puntaje, categoria, alertas, raw_metadata)
     VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})
     ON CONFLICT (lote_id, fuente, observed_at) DO UPDATE SET
      consulted_at = EXCLUDED.consulted_at, cobertura_valida = EXCLUDED.cobertura_valida,
      ndvi_media = EXCLUDED.ndvi_media, ndvi_mediana = EXCLUDED.ndvi_mediana, ndvi_min = EXCLUDED.ndvi_min, ndvi_max = EXCLUDED.ndvi_max, ndvi_desvio = EXCLUDED.ndvi_desvio,
      ndmi_media = EXCLUDED.ndmi_media, ndmi_mediana = EXCLUDED.ndmi_mediana, ndmi_min = EXCLUDED.ndmi_min, ndmi_max = EXCLUDED.ndmi_max, ndmi_desvio = EXCLUDED.ndmi_desvio,
      ndwi_media = EXCLUDED.ndwi_media, ndwi_mediana = EXCLUDED.ndwi_mediana, ndwi_min = EXCLUDED.ndwi_min, ndwi_max = EXCLUDED.ndwi_max, ndwi_desvio = EXCLUDED.ndwi_desvio,
      evi_media = EXCLUDED.evi_media, evi_mediana = EXCLUDED.evi_mediana, evi_min = EXCLUDED.evi_min, evi_max = EXCLUDED.evi_max, evi_desvio = EXCLUDED.evi_desvio,
      rvi_media = EXCLUDED.rvi_media, rvi_mediana = EXCLUDED.rvi_mediana, rvi_min = EXCLUDED.rvi_min, rvi_max = EXCLUDED.rvi_max, rvi_desvio = EXCLUDED.rvi_desvio,
      puntaje = EXCLUDED.puntaje, categoria = EXCLUDED.categoria, alertas = EXCLUDED.alertas, raw_metadata = EXCLUDED.raw_metadata
     RETURNING *`, values,
  );
  res.status(201).json({ medicion: measurementDto(result.rows[0]) });
}));

historialRouter.get('/:id/mediciones-satelitales', asyncHandler(async (req, res) => {
  const loteId = await loteDelUsuario(req);
  const result = await pool.query('SELECT * FROM mediciones_satelitales WHERE lote_id = $1 ORDER BY observed_at DESC, fuente', [loteId]);
  res.json({ mediciones: result.rows.map(measurementDto) });
}));

historialRouter.post('/:id/clima', asyncHandler(async (req, res) => {
  const loteId = await loteDelUsuario(req); const body = req.body as Record<string, unknown>;
  if (!Array.isArray(body.dias)) throw new ApiError(400, 'INVALID_DAYS', 'dias debe ser un arreglo.');
  if (body.origen !== 'automatico' && body.origen !== 'manual') throw new ApiError(400, 'INVALID_CLIMATE_ORIGIN', 'origen debe ser automatico o manual.');
  if (body.origen === 'automatico') {
    const reciente = await pool.query("SELECT id FROM consultas_clima WHERE lote_id = $1 AND created_at >= NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 1", [loteId]);
    if (reciente.rows[0]) {
      res.json({ consultaId: reciente.rows[0].id, guardado: false, omitido: 'reciente' });
      return;
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const consulta = await client.query(`INSERT INTO consultas_clima (lote_id, consulted_at, lluvia_ultimos_7_dias, lluvia_proximos_dias, categoria, raw_metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [loteId, timestamp(body.consultedAt, 'consultedAt'), nullableNumber(body.lluviaUltimos7Dias, 'lluviaUltimos7Dias'), nullableNumber(body.lluviaProximosDias, 'lluviaProximosDias'), typeof body.categoria === 'string' ? body.categoria : null, body.rawMetadata ?? null]);
    for (const value of body.dias) {
      const dia = value as Record<string, unknown>;
      if (typeof dia.esPronostico !== 'boolean') throw new ApiError(400, 'INVALID_FORECAST_FLAG', 'esPronostico debe ser booleano.');
      await client.query('INSERT INTO dias_clima (consulta_clima_id, fecha, lluvia_mm, temp_min, temp_max, es_pronostico) VALUES ($1, $2, $3, $4, $5, $6)', [consulta.rows[0].id, fechaCalendario(dia.fecha, 'fecha'), nullableNumber(dia.lluviaMm, 'lluviaMm'), nullableNumber(dia.tempMin, 'tempMin'), nullableNumber(dia.tempMax, 'tempMax'), dia.esPronostico]);
    }
    await client.query('COMMIT'); res.status(201).json({ consultaId: consulta.rows[0].id });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));

async function consultasClima(loteId: string) {
  const consultas = await pool.query('SELECT * FROM consultas_clima WHERE lote_id = $1 ORDER BY consulted_at DESC', [loteId]);
  const result = [];
  for (const consulta of consultas.rows) {
    const dias = await pool.query('SELECT fecha, lluvia_mm, temp_min, temp_max, es_pronostico FROM dias_clima WHERE consulta_clima_id = $1 ORDER BY fecha', [consulta.id]);
    result.push({ id: consulta.id, consultedAt: consulta.consulted_at, lluviaUltimos7Dias: consulta.lluvia_ultimos_7_dias, lluviaProximosDias: consulta.lluvia_proximos_dias, categoria: consulta.categoria, dias: dias.rows.map((dia) => ({ fecha: dia.fecha, lluviaMm: dia.lluvia_mm, tempMin: dia.temp_min, tempMax: dia.temp_max, esPronostico: dia.es_pronostico })) });
  }
  return result;
}

historialRouter.get('/:id/clima', asyncHandler(async (req, res) => { res.json({ consultas: await consultasClima(await loteDelUsuario(req)) }); }));

historialRouter.post('/:id/usos', asyncHandler(async (req, res) => {
  const loteId = await loteDelUsuario(req); const body = req.body as Record<string, unknown>;
  const result = await pool.query('INSERT INTO usos_lote (lote_id, fecha, origen) VALUES ($1, $2, $3) RETURNING id, lote_id, fecha, origen, created_at', [loteId, fechaCalendario(body.fecha, 'fecha'), typeof body.origen === 'string' ? body.origen : 'manual']);
  const uso = result.rows[0]; res.status(201).json({ uso: { id: uso.id, loteId: uso.lote_id, fecha: uso.fecha, origen: uso.origen, createdAt: uso.created_at } });
}));

historialRouter.get('/:id/usos', asyncHandler(async (req, res) => {
  const loteId = await loteDelUsuario(req); const result = await pool.query('SELECT id, lote_id, fecha, origen, created_at FROM usos_lote WHERE lote_id = $1 ORDER BY fecha DESC, created_at DESC', [loteId]);
  res.json({ usos: result.rows.map((uso) => ({ id: uso.id, loteId: uso.lote_id, fecha: uso.fecha, origen: uso.origen, createdAt: uso.created_at })) });
}));

historialRouter.get('/:id/historial', asyncHandler(async (req, res) => {
  const loteId = await loteDelUsuario(req);
  const mediciones = await pool.query('SELECT * FROM mediciones_satelitales WHERE lote_id = $1 ORDER BY observed_at DESC, fuente', [loteId]);
  const usos = await pool.query('SELECT id, lote_id, fecha, origen, created_at FROM usos_lote WHERE lote_id = $1 ORDER BY fecha DESC, created_at DESC', [loteId]);
  const clima = await consultasClima(loteId);
  res.json({ satelite: mediciones.rows.map(measurementDto), clima, usos: usos.rows.map((uso) => ({ id: uso.id, loteId: uso.lote_id, fecha: uso.fecha, origen: uso.origen, createdAt: uso.created_at })) });
}));
