import express from 'express';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { establecimientoRouter } from './routes/establecimiento.js';
import { lotesRouter } from './routes/lotes.js';
import { historialRouter } from './routes/historial.js';
import { ApiError, errorResponse } from './http/errors.js';
import { copernicusRouter } from './routes/copernicus.js';

export const app = express();

app.use(express.json());
app.use('/api/health', healthRouter);
app.use('/api/copernicus', copernicusRouter);
app.use('/api/auth', authRouter);
app.use('/api/establecimiento', establecimientoRouter);
app.use('/api/lotes', lotesRouter);
app.use('/api/lotes', historialRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Ruta no encontrada.',
    },
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (!(error instanceof ApiError)) {
    console.error('[api] Error interno:', error instanceof Error ? error.stack ?? error.message : error);
  }
  const response = errorResponse(error);
  res.status(response.status).json(response.body);
});
