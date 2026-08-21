import { Router } from 'express';
import { requiereAutenticacion } from '../auth/middleware.js';
import { consultarClima } from '../controllers/clima.js';
import { asyncHandler } from '../http/async-handler.js';

export const climaRouter = Router();
climaRouter.use(requiereAutenticacion);

climaRouter.post('/consultar', asyncHandler(consultarClima));
