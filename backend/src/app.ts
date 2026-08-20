import express from 'express';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { establecimientoRouter } from './routes/establecimiento.js';
import { lotesRouter } from './routes/lotes.js';
import { historialRouter } from './routes/historial.js';
import { errorResponse } from './http/errors.js';

export const app = express();

app.use(express.json());
app.use('/api/health', healthRouter);
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
  const response = errorResponse(error);
  res.status(response.status).json(response.body);
});
