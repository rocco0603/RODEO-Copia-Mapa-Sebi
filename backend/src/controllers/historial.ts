import type { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { esFechaCalendario } from '../date.js';
import { ApiError } from '../http/errors.js';
import { leerPaginacion, leerRangoCalendario, type Paginacion, type RangoCalendario } from '../http/query.js';
import { obtenerEstadosDeLotes } from '../services/estado-lotes.js';
import { guardarMedicionSatelital } from '../services/mediciones-satelitales.js';

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
  if (!esFechaCalendario(value)) throw new ApiError(400, 'INVALID_DATE', `${campo} debe tener formato YYYY-MM-DD y ser válida.`);
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

function jsonb(value: unknown, campo: string): string | null {
  if (value === undefined || value === null) return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error('undefined JSON');
    return serialized;
  } catch {
    throw new ApiError(400, 'INVALID_JSON', `${campo} debe ser un valor JSON válido.`);
  }
}

function alertasValidas(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ApiError(400, 'INVALID_ALERTS', 'alertas debe ser un arreglo de textos.');
  }
  return value;
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

export async function crearMedicionSatelital(req: Request, res: Response): Promise<void> {
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
  const row = await guardarMedicionSatelital(pool, loteId, {
    fuente: body.fuente,
    observedAt,
    consultedAt,
    coberturaValida: nullableNumber(body.coberturaValida, 'coberturaValida'),
    ndvi, ndmi, ndwi, evi, rvi, puntaje, categoria,
    alertas: alertasValidas(body.alertas),
    rawMetadata: body.rawMetadata === undefined ? undefined : JSON.parse(jsonb(body.rawMetadata, 'rawMetadata') ?? 'null') as unknown,
  });
  res.status(201).json({ medicion: measurementDto(row) });
}

export async function obtenerMedicionesSatelitales(req: Request, res: Response): Promise<void> {
  const loteId = await loteDelUsuario(req);
  const paginacion = leerPaginacion(req.query);
  const rango = leerRangoCalendario(req.query);
  const fuente = req.query.fuente;
  if (fuente !== undefined && (typeof fuente !== 'string' || (fuente !== 'sentinel-1' && fuente !== 'sentinel-2'))) {
    throw new ApiError(400, 'INVALID_SOURCE', 'La fuente satelital no es válida.');
  }
  const condiciones = ['lote_id = $1'];
  const valores: unknown[] = [loteId];
  if (fuente) { valores.push(fuente); condiciones.push(`fuente = $${valores.length}`); }
  if (rango.desde) { valores.push(rango.desde); condiciones.push(`observed_at >= $${valores.length}::date`); }
  if (rango.hasta) { valores.push(rango.hasta); condiciones.push(`observed_at <= $${valores.length}::date`); }
  const where = condiciones.join(' AND ');
  const total = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM mediciones_satelitales WHERE ${where}`, valores);
  const limitIndex = valores.push(paginacion.limit);
  const offsetIndex = valores.push(paginacion.offset);
  const result = await pool.query(`SELECT * FROM mediciones_satelitales WHERE ${where} ORDER BY observed_at DESC, fuente ASC, id ASC LIMIT $${limitIndex} OFFSET $${offsetIndex}`, valores);
  const totalNumber = Number(total.rows[0].total);
  res.json({ mediciones: result.rows.map(measurementDto), paginacion: { ...paginacion, total: totalNumber, hayMas: paginacion.offset + result.rows.length < totalNumber } });
}

export async function crearConsultaClima(req: Request, res: Response): Promise<void> {
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
    const consulta = await client.query(`INSERT INTO consultas_clima (lote_id, consulted_at, lluvia_ultimos_7_dias, lluvia_proximos_dias, categoria, raw_metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [loteId, timestamp(body.consultedAt, 'consultedAt'), nullableNumber(body.lluviaUltimos7Dias, 'lluviaUltimos7Dias'), nullableNumber(body.lluviaProximosDias, 'lluviaProximosDias'), typeof body.categoria === 'string' ? body.categoria : null, jsonb(body.rawMetadata, 'rawMetadata')]);
    for (const value of body.dias) {
      const dia = value as Record<string, unknown>;
      if (typeof dia.esPronostico !== 'boolean') throw new ApiError(400, 'INVALID_FORECAST_FLAG', 'esPronostico debe ser booleano.');
      await client.query('INSERT INTO dias_clima (consulta_clima_id, fecha, lluvia_mm, temp_min, temp_max, es_pronostico) VALUES ($1, $2, $3, $4, $5, $6)', [consulta.rows[0].id, fechaCalendario(dia.fecha, 'fecha'), nullableNumber(dia.lluviaMm, 'lluviaMm'), nullableNumber(dia.tempMin, 'tempMin'), nullableNumber(dia.tempMax, 'tempMax'), dia.esPronostico]);
    }
    await client.query('COMMIT'); res.status(201).json({ consultaId: consulta.rows[0].id });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function consultasClima(loteId: string, paginacion: Paginacion, rango: RangoCalendario) {
  const condiciones = ['lote_id = $1'];
  const valores: unknown[] = [loteId];
  if (rango.desde) { valores.push(rango.desde); condiciones.push(`consulted_at >= ($${valores.length}::date AT TIME ZONE 'UTC')`); }
  if (rango.hasta) { valores.push(rango.hasta); condiciones.push(`consulted_at < (($${valores.length}::date + INTERVAL '1 day') AT TIME ZONE 'UTC')`); }
  const where = condiciones.join(' AND ');
  const total = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM consultas_clima WHERE ${where}`, valores);
  const limitIndex = valores.push(paginacion.limit);
  const offsetIndex = valores.push(paginacion.offset);
  const consultas = await pool.query(`SELECT * FROM consultas_clima WHERE ${where} ORDER BY consulted_at DESC, id ASC LIMIT $${limitIndex} OFFSET $${offsetIndex}`, valores);
  const ids = consultas.rows.map((consulta) => consulta.id as string);
  const dias = ids.length === 0 ? { rows: [] } : await pool.query('SELECT consulta_clima_id, fecha, lluvia_mm, temp_min, temp_max, es_pronostico FROM dias_clima WHERE consulta_clima_id = ANY($1::uuid[]) ORDER BY fecha', [ids]);
  const diasPorConsulta = new Map<string, Array<Record<string, unknown>>>();
  for (const dia of dias.rows) {
    const lista = diasPorConsulta.get(dia.consulta_clima_id) ?? [];
    lista.push({ fecha: dia.fecha, lluviaMm: dia.lluvia_mm, tempMin: dia.temp_min, tempMax: dia.temp_max, esPronostico: dia.es_pronostico });
    diasPorConsulta.set(dia.consulta_clima_id, lista);
  }
  const items = consultas.rows.map((consulta) => ({ id: consulta.id, consultedAt: consulta.consulted_at, lluviaUltimos7Dias: consulta.lluvia_ultimos_7_dias, lluviaProximosDias: consulta.lluvia_proximos_dias, categoria: consulta.categoria, dias: diasPorConsulta.get(consulta.id) ?? [] }));
  const totalNumber = Number(total.rows[0].total);
  return { items, paginacion: { ...paginacion, total: totalNumber, hayMas: paginacion.offset + items.length < totalNumber } };
}

export async function obtenerConsultasClima(req: Request, res: Response): Promise<void> {
  const paginacion = leerPaginacion(req.query);
  const rango = leerRangoCalendario(req.query);
  const resultado = await consultasClima(await loteDelUsuario(req), paginacion, rango);
  res.json({ consultas: resultado.items, paginacion: resultado.paginacion });
}

export async function crearUsoLote(req: Request, res: Response): Promise<void> {
  const loteId = await loteDelUsuario(req); const body = req.body as Record<string, unknown>;
  const result = await pool.query('INSERT INTO usos_lote (lote_id, fecha, origen) VALUES ($1, $2, $3) RETURNING id, lote_id, fecha, origen, created_at', [loteId, fechaCalendario(body.fecha, 'fecha'), typeof body.origen === 'string' ? body.origen : 'manual']);
  const uso = result.rows[0]; res.status(201).json({ uso: { id: uso.id, loteId: uso.lote_id, fecha: uso.fecha, origen: uso.origen, createdAt: uso.created_at } });
}

export async function obtenerUsosLote(req: Request, res: Response): Promise<void> {
  const loteId = await loteDelUsuario(req);
  const paginacion = leerPaginacion(req.query);
  const rango = leerRangoCalendario(req.query);
  const condiciones = ['lote_id = $1'];
  const valores: unknown[] = [loteId];
  if (rango.desde) { valores.push(rango.desde); condiciones.push(`fecha >= $${valores.length}::date`); }
  if (rango.hasta) { valores.push(rango.hasta); condiciones.push(`fecha <= $${valores.length}::date`); }
  const where = condiciones.join(' AND ');
  const total = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM usos_lote WHERE ${where}`, valores);
  const limitIndex = valores.push(paginacion.limit);
  const offsetIndex = valores.push(paginacion.offset);
  const result = await pool.query(`SELECT id, lote_id, fecha, origen, created_at FROM usos_lote WHERE ${where} ORDER BY fecha DESC, created_at DESC, id ASC LIMIT $${limitIndex} OFFSET $${offsetIndex}`, valores);
  const totalNumber = Number(total.rows[0].total);
  res.json({ usos: result.rows.map((uso) => ({ id: uso.id, loteId: uso.lote_id, fecha: uso.fecha, origen: uso.origen, createdAt: uso.created_at })), paginacion: { ...paginacion, total: totalNumber, hayMas: paginacion.offset + result.rows.length < totalNumber } });
}

export async function obtenerEstadoLote(req: Request, res: Response): Promise<void> {
  const loteId = await loteDelUsuario(req);
  const [estado] = await obtenerEstadosDeLotes([loteId]);
  res.json(estado);
}

export async function obtenerHistorialLote(req: Request, res: Response): Promise<void> {
  const loteId = await loteDelUsuario(req);
  const mediciones = await pool.query('SELECT * FROM mediciones_satelitales WHERE lote_id = $1 ORDER BY observed_at DESC, fuente ASC, id ASC LIMIT 51', [loteId]);
  const usos = await pool.query('SELECT id, lote_id, fecha, origen, created_at FROM usos_lote WHERE lote_id = $1 ORDER BY fecha DESC, created_at DESC, id ASC LIMIT 51', [loteId]);
  const clima = await consultasClima(loteId, { limit: 50, offset: 0 }, {});
  res.json({ satelite: mediciones.rows.slice(0, 50).map(measurementDto), clima: clima.items, usos: usos.rows.slice(0, 50).map((uso) => ({ id: uso.id, loteId: uso.lote_id, fecha: uso.fecha, origen: uso.origen, createdAt: uso.created_at })), paginacion: { satelite: { limit: 50, offset: 0, hayMas: mediciones.rows.length > 50 }, clima: clima.paginacion, usos: { limit: 50, offset: 0, hayMas: usos.rows.length > 50 } } });
}
