import type { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { ApiError } from '../http/errors.js';
import { openMeteo } from '../services/open-meteo.js';

function usuarioId(req: Request): string {
  if (!req.usuario) throw new ApiError(401, 'UNAUTHENTICATED', 'Necesitás iniciar sesión.');
  return req.usuario.id;
}

export async function consultarClima(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown> | null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!body || !Array.isArray(body.loteIds) || body.loteIds.length === 0 || body.loteIds.length > 100 || body.loteIds.some((id) => typeof id !== 'string' || !uuid.test(id))) {
    throw new ApiError(400, 'INVALID_LOT_IDS', 'loteIds debe ser un arreglo no vacío de IDs válidos.');
  }
  const ids = [...new Set(body.loteIds as string[])];
  const result = await pool.query<{ id: string; polygon: unknown }>(
    `SELECT l.id, l.polygon FROM lotes l JOIN establecimientos e ON e.id = l.establecimiento_id
     WHERE l.id = ANY($1::uuid[]) AND e.user_id = $2 AND l.deleted_at IS NULL`,
    [ids, usuarioId(req)],
  );
  if (result.rows.length !== ids.length) throw new ApiError(404, 'LOT_NOT_FOUND', 'Lote inexistente.');
  const lotes = ids.map((id) => {
    const row = result.rows.find((item) => item.id === id);
    return { id, polygon: row?.polygon as never };
  });
  res.json({ resultados: await openMeteo.consultar(lotes) });
}
