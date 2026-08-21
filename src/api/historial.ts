import { pedir } from "./client";
import type { EstadisticaIndice, ResultadoLote } from "../copernicus/types";
import type { ResultadoClimaLote } from "../clima/types";

export interface MedicionSatelital {
  id: string;
  fuente: "sentinel-1" | "sentinel-2";
  observedAt: string;
  consultedAt: string;
  coberturaValida: number | null;
  ndvi: EstadisticaIndiceNullable;
  ndmi: EstadisticaIndiceNullable;
  ndwi: EstadisticaIndiceNullable;
  evi: EstadisticaIndiceNullable;
  rvi: EstadisticaIndiceNullable;
  puntaje: number | null;
  categoria: string | null;
}

export type EstadisticaIndiceNullable = Partial<EstadisticaIndice> & {
  media: number | null;
  mediana: number | null;
  min: number | null;
  max: number | null;
  desvio: number | null;
};

export interface ConsultaClimaHistorial {
  id: string;
  consultedAt: string;
  lluviaUltimos7Dias: number | null;
  lluviaProximosDias: number | null;
  categoria: string | null;
  dias: { fecha: string; lluviaMm: number | null; tempMin: number | null; tempMax: number | null; esPronostico: boolean }[];
}

export interface UsoLote {
  id: string;
  loteId: string;
  fecha: string;
  origen: string;
  createdAt: string;
}

export interface HistorialLote {
  satelite: MedicionSatelital[];
  clima: ConsultaClimaHistorial[];
  usos: UsoLote[];
}

export interface PaginacionHistorial {
  limit: number;
  offset: number;
  total: number;
  hayMas: boolean;
}

export interface EstadoLoteApi {
  lote: { id: string; numero: number; apodo: string | null; activo: boolean };
  satelite: {
    optico: EstadoSateliteOptico | null;
    radar: EstadoSateliteRadar | null;
  };
  clima: EstadoClima | null;
  uso: { ultimoUso: { fecha: string; origen: string } | null; diasDescanso: number | null };
}

interface EstadoSateliteBase {
  id: string;
  observedAt: string;
  consultedAt: string;
  diasDesdeObservacion: number;
}

export interface EstadoSateliteOptico extends EstadoSateliteBase {
  coberturaValida: number | null;
  ndvi: EstadisticaIndiceNullable;
  ndmi: EstadisticaIndiceNullable;
  ndwi: EstadisticaIndiceNullable;
  evi: EstadisticaIndiceNullable;
  puntaje: number | null;
  categoria: string | null;
}

export interface EstadoSateliteRadar extends EstadoSateliteBase {
  rvi: EstadisticaIndiceNullable;
}

export interface EstadoClima {
  consultedAt: string;
  horasDesdeConsulta: number;
  lluviaUltimos7Dias: number | null;
  lluviaProximosDias: number | null;
  categoria: string | null;
  hoy: { fecha: string; lluviaMm: number | null; tempMin: number | null; tempMax: number | null; esPronostico: boolean } | null;
}

export interface HistorialPaginado<T> {
  items: T;
  paginacion: PaginacionHistorial;
}

export interface OpcionesHistorial {
  limit?: number;
  offset?: number;
  desde?: string;
  hasta?: string;
  fuente?: "sentinel-1" | "sentinel-2";
}

export interface MedicionSatelitalPayload {
  fuente: "sentinel-1" | "sentinel-2";
  observedAt: string;
  consultedAt: number;
  coberturaValida?: number;
  ndvi?: EstadisticaIndice;
  ndmi?: EstadisticaIndice;
  ndwi?: EstadisticaIndice;
  evi?: EstadisticaIndice;
  rvi?: EstadisticaIndice;
  puntaje?: number;
  categoria?: string;
  alertas?: string[];
}

export type OrigenConsultaClima = "automatico" | "manual";

export async function guardarMedicionSatelital(loteId: string, payload: MedicionSatelitalPayload): Promise<void> {
  await pedir(`/api/lotes/${loteId}/mediciones-satelitales`, { method: "POST", body: JSON.stringify(payload) });
}

export async function guardarConsultaClima(loteId: string, resultado: Extract<ResultadoClimaLote, { estado: "ok" }>, origen: OrigenConsultaClima): Promise<void> {
  await pedir(`/api/lotes/${loteId}/clima`, {
    method: "POST",
    body: JSON.stringify({
      origen,
      consultedAt: resultado.clima.consultadoEn,
      lluviaUltimos7Dias: resultado.clima.lluviaUltimos7Dias,
      lluviaProximosDias: resultado.clima.lluviaProximosDias,
      categoria: resultado.categoria,
      dias: resultado.clima.dias,
    }),
  });
}

export async function obtenerHistorialLote(loteId: string): Promise<HistorialLote> {
  return pedir<HistorialLote>(`/api/lotes/${loteId}/historial`);
}

function queryHistorial(opciones: OpcionesHistorial = {}): string {
  const query = new URLSearchParams();
  Object.entries(opciones).forEach(([clave, valor]) => { if (valor !== undefined) query.set(clave, String(valor)); });
  const texto = query.toString();
  return texto ? `?${texto}` : "";
}

export async function obtenerEstadoLote(loteId: string): Promise<EstadoLoteApi> {
  return pedir<EstadoLoteApi>(`/api/lotes/${loteId}/estado`);
}

export async function obtenerMedicionesSatelitales(loteId: string, opciones: OpcionesHistorial = {}): Promise<HistorialPaginado<MedicionSatelital[]>> {
  const respuesta = await pedir<{ mediciones: MedicionSatelital[]; paginacion: PaginacionHistorial }>(`/api/lotes/${loteId}/mediciones-satelitales${queryHistorial(opciones)}`);
  return { items: respuesta.mediciones, paginacion: respuesta.paginacion };
}

export async function obtenerConsultasClima(loteId: string, opciones: OpcionesHistorial = {}): Promise<HistorialPaginado<ConsultaClimaHistorial[]>> {
  const respuesta = await pedir<{ consultas: ConsultaClimaHistorial[]; paginacion: PaginacionHistorial }>(`/api/lotes/${loteId}/clima${queryHistorial(opciones)}`);
  return { items: respuesta.consultas, paginacion: respuesta.paginacion };
}

export async function obtenerUsosLote(loteId: string, opciones: OpcionesHistorial = {}): Promise<HistorialPaginado<UsoLote[]>> {
  const respuesta = await pedir<{ usos: UsoLote[]; paginacion: PaginacionHistorial }>(`/api/lotes/${loteId}/usos${queryHistorial(opciones)}`);
  return { items: respuesta.usos, paginacion: respuesta.paginacion };
}

export async function registrarUsoLote(loteId: string, fecha: string): Promise<UsoLote> {
  return (await pedir<{ uso: UsoLote }>(`/api/lotes/${loteId}/usos`, {
    method: "POST", body: JSON.stringify({ fecha, origen: "manual" }),
  })).uso;
}

export function medicionDesdeResultado(resultado: Extract<ResultadoLote, { estado: "ok" } | { estado: "radar" }>, consultadoEn: number): MedicionSatelitalPayload[] {
  if (resultado.estado === "ok") {
    return [{ fuente: "sentinel-2", observedAt: resultado.condicion.fecha, consultedAt: consultadoEn, coberturaValida: resultado.condicion.coberturaValida, ndvi: resultado.condicion.ndvi, ndmi: resultado.condicion.ndmi, ndwi: resultado.condicion.ndwi, evi: resultado.condicion.evi, puntaje: resultado.condicion.puntaje, categoria: resultado.condicion.categoria, alertas: resultado.condicion.alertas }];
  }
  const mediciones: MedicionSatelitalPayload[] = [{ fuente: "sentinel-1", observedAt: resultado.condicion.fecha, consultedAt: consultadoEn, rvi: resultado.condicion.rvi }];
  if (resultado.optico) mediciones.push({ fuente: "sentinel-2", observedAt: resultado.optico.fecha, consultedAt: consultadoEn, coberturaValida: resultado.optico.coberturaValida, ndvi: resultado.optico.ndvi, ndmi: resultado.optico.ndmi, ndwi: resultado.optico.ndwi, evi: resultado.optico.evi, puntaje: resultado.optico.puntaje, categoria: resultado.optico.categoria, alertas: resultado.optico.alertas });
  return mediciones;
}
