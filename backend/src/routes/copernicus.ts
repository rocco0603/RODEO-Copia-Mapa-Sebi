import { Router } from 'express';
import { requiereAutenticacion } from '../auth/middleware.js';
import { asyncHandler } from '../http/async-handler.js';
import { copernicus } from '../services/copernicus.js';

export const copernicusRouter = Router();
copernicusRouter.use(requiereAutenticacion);
copernicusRouter.get('/estado', (_req, res) => { res.json({ configurado: copernicus.credencialesConfiguradas() }); });
copernicusRouter.post('/statistics', asyncHandler(async (req, res) => {
  const respuesta = await copernicus.obtenerEstadisticas(JSON.stringify(req.body));
  res.status(respuesta.status).type('application/json').send(respuesta.texto);
}));
