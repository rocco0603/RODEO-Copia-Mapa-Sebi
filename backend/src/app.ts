import express from 'express';
import { healthRouter } from './routes/health.js';

export const app = express();

app.use(express.json());
app.use('/api/health', healthRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Ruta no encontrada.',
    },
  });
});
