import { Router } from 'express';
import { requiereAutenticacion } from '../auth/middleware.js';
import {
  crearConsultaClima,
  crearMedicionSatelital,
  crearUsoLote,
  obtenerConsultasClima,
  obtenerEstadoLote,
  obtenerHistorialLote,
  obtenerMedicionesSatelitales,
  obtenerUsosLote,
} from '../controllers/historial.js';
import { asyncHandler } from '../http/async-handler.js';

export const historialRouter = Router();
historialRouter.use(requiereAutenticacion);

historialRouter.post('/:id/mediciones-satelitales', asyncHandler(crearMedicionSatelital));
historialRouter.get('/:id/mediciones-satelitales', asyncHandler(obtenerMedicionesSatelitales));
historialRouter.post('/:id/clima', asyncHandler(crearConsultaClima));
historialRouter.get('/:id/clima', asyncHandler(obtenerConsultasClima));
historialRouter.post('/:id/usos', asyncHandler(crearUsoLote));
historialRouter.get('/:id/usos', asyncHandler(obtenerUsosLote));
historialRouter.get('/:id/estado', asyncHandler(obtenerEstadoLote));
historialRouter.get('/:id/historial', asyncHandler(obtenerHistorialLote));
