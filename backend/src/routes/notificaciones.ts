import { Router, type Request } from 'express';
import { pool } from '../db/pool.js';
import { requiereAutenticacion } from '../auth/middleware.js';
import { asyncHandler } from '../http/async-handler.js';
import { ApiError } from '../http/errors.js';
import { leerBooleano, leerPaginacion } from '../http/query.js';

export const notificacionesRouter = Router();
notificacionesRouter.use(requiereAutenticacion);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function usuarioId(req: Request): string {
  if (!req.usuario) throw new ApiError(401, 'UNAUTHENTICATED', 'NecesitÃ¡s iniciar sesiÃ³n.');
  return req.usuario.id;
}

function dto(row: Record<string, unknown>) {
  return {
    id: row.id,
    loteId: row.lote_id,
    tipo: row.tipo,
    titulo: row.titulo,
    mensaje: row.mensaje,
    leida: row.read_at !== null,
    readAt: row.read_at,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

notificacionesRouter.get('/', asyncHandler(async (req, res) => {
  const userId = usuarioId(req);
  const paginacion = leerPaginacion(req.query, 20);
  const soloNoLeidas = leerBooleano(req.query, 'soloNoLeidas');
  const filtro = soloNoLeidas === true ? ' AND read_at IS NULL' : '';
  const [items, total, noLeidas] = await Promise.all([
    pool.query(`SELECT id, lote_id, tipo, titulo, mensaje, read_at, metadata, created_at FROM notificaciones WHERE user_id = $1${filtro} ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`, [userId, paginacion.limit, paginacion.offset]),
    pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM notificaciones WHERE user_id = $1${filtro}`, [userId]),
    pool.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM notificaciones WHERE user_id = $1 AND read_at IS NULL', [userId]),
  ]);
  const totalNumber = Number(total.rows[0].total);
  res.json({
    notificaciones: items.rows.map(dto),
    noLeidas: Number(noLeidas.rows[0].total),
    paginacion: { ...paginacion, total: totalNumber, hayMas: paginacion.offset + items.rows.length < totalNumber },
  });
}));

notificacionesRouter.patch('/leidas', asyncHandler(async (req, res) => {
  const result = await pool.query('UPDATE notificaciones SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [usuarioId(req)]);
  res.json({ actualizadas: result.rowCount ?? 0 });
}));

notificacionesRouter.patch('/:id/leida', asyncHandler(async (req, res) => {
  if (!UUID.test(req.params.id)) throw new ApiError(400, 'INVALID_NOTIFICATION_ID', 'El ID de notificaciÃ³n no es vÃ¡lido.');
  const result = await pool.query(
    `UPDATE notificaciones SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2
     RETURNING id, lote_id, tipo, titulo, mensaje, read_at, metadata, created_at`,
    [req.params.id, usuarioId(req)],
  );
  if (!result.rows[0]) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'NotificaciÃ³n inexistente.');
  res.json({ notificacion: dto(result.rows[0]) });
}));
