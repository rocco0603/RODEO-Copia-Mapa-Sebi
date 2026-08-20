import type { ParsedQs } from 'qs';
import { ApiError } from './errors.js';
import { esFechaCalendario } from '../date.js';

export interface Paginacion {
  limit: number;
  offset: number;
}

export interface RangoCalendario {
  desde?: string;
  hasta?: string;
}

function texto(query: ParsedQs, nombre: string): string | undefined {
  const value = query[nombre];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_QUERY_PARAM', `${nombre} debe ser un valor único.`);
  return value;
}

function entero(query: ParsedQs, nombre: string, defecto: number, minimo: number, maximo?: number): number {
  const value = texto(query, nombre);
  if (value === undefined || value === '') return defecto;
  if (!/^\d+$/.test(value)) throw new ApiError(400, `INVALID_${nombre.toUpperCase()}`, `${nombre} debe ser un entero válido.`);
  const numero = Number(value);
  if (!Number.isSafeInteger(numero) || numero < minimo || (maximo !== undefined && numero > maximo)) {
    throw new ApiError(400, `INVALID_${nombre.toUpperCase()}`, `${nombre} está fuera de rango.`);
  }
  return numero;
}

function fecha(query: ParsedQs, nombre: 'desde' | 'hasta'): string | undefined {
  const value = texto(query, nombre);
  if (value === undefined) return undefined;
  if (!esFechaCalendario(value)) throw new ApiError(400, 'INVALID_DATE', `${nombre} debe tener formato YYYY-MM-DD y ser válida.`);
  return value;
}

export function leerPaginacion(query: ParsedQs): Paginacion {
  return { limit: entero(query, 'limit', 50, 1, 100), offset: entero(query, 'offset', 0, 0) };
}

export function leerRangoCalendario(query: ParsedQs): RangoCalendario {
  const desde = fecha(query, 'desde');
  const hasta = fecha(query, 'hasta');
  if (desde && hasta && desde > hasta) throw new ApiError(400, 'INVALID_DATE_RANGE', 'desde no puede ser posterior a hasta.');
  return { desde, hasta };
}
