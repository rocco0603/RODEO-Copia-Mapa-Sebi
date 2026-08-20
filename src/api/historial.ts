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
