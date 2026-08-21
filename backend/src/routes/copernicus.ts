import { Router } from 'express';
import { requiereAutenticacion } from '../auth/middleware.js';
import { copernicus } from '../services/copernicus.js';

export const copernicusRouter = Router();
copernicusRouter.use(requiereAutenticacion);
copernicusRouter.get('/estado', (_req, res) => { res.json({ configurado: copernicus.credencialesConfiguradas() }); });
