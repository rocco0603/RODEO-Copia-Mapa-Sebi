import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const DIAS_PASADOS = 7;
const DIAS_PRONOSTICO = 5;
const TIMEOUT_MS = 20_000;

type PolygonFeature = Feature<Polygon>;
export type LoteClima = { id: string; polygon: PolygonFeature };
export type CategoriaLluvia = 'seco' | 'normal' | 'lluvia' | 'piso-pesado';
export interface DiaClima { fecha: string; lluviaMm: number; tempMin: number; tempMax: number; esPronostico: boolean; }
export interface Clima { consultadoEn: number; dias: DiaClima[]; lluviaUltimos7Dias: number; lluviaProximosDias: number; hoy: DiaClima | null; }
export type ResultadoClimaLote =
  | { estado: 'ok'; loteId: string; clima: Clima; categoria: CategoriaLluvia }
  | { estado: 'error'; loteId: string; mensaje: string };

interface RegistroOpenMeteo { daily?: { time: string[]; precipitation_sum?: (number | null)[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[] }; }
export interface RespuestaOpenMeteo { ok: boolean; status: number; json(): Promise<unknown>; }
export type TransporteOpenMeteo = (url: string, signal: AbortSignal) => Promise<RespuestaOpenMeteo>;

function aNumero(valor: number | null | undefined): number { return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0; }

function categorizarLluvia(clima: Clima): CategoriaLluvia {
  const { lluviaUltimos7Dias: semana, lluviaProximosDias: proximos } = clima;
  if (semana >= 40) return 'piso-pesado';
  if (proximos >= 15) return 'lluvia';
  if (semana < 5 && proximos < 5) return 'seco';
  return 'normal';
}

function centroidOf(polygon: PolygonFeature): [number, number] {
  const [lng, lat] = turf.centroid(polygon).geometry.coordinates;
  return [lat, lng];
}

function aClima(registro: RegistroOpenMeteo): Clima | null {
  const tiempos = registro.daily?.time ?? [];
  if (tiempos.length === 0) return null;
  const lluvias = registro.daily?.precipitation_sum ?? [];
  const tempsMax = registro.daily?.temperature_2m_max ?? [];
  const tempsMin = registro.daily?.temperature_2m_min ?? [];
  const dias = tiempos.map((fecha, i) => ({ fecha, lluviaMm: aNumero(lluvias[i]), tempMax: aNumero(tempsMax[i]), tempMin: aNumero(tempsMin[i]), esPronostico: i >= DIAS_PASADOS }));
  return { consultadoEn: Date.now(), dias, lluviaUltimos7Dias: dias.slice(0, DIAS_PASADOS).reduce((acc, dia) => acc + dia.lluviaMm, 0), lluviaProximosDias: dias.slice(DIAS_PASADOS).reduce((acc, dia) => acc + dia.lluviaMm, 0), hoy: dias[DIAS_PASADOS] ?? null };
}

const transporteFetch: TransporteOpenMeteo = async (url, signal) => fetch(url, { signal });

export class OpenMeteoClient {
  constructor(private transportar: TransporteOpenMeteo = transporteFetch) {}

  reemplazarTransporte(transportar: TransporteOpenMeteo): TransporteOpenMeteo {
    const anterior = this.transportar;
    this.transportar = transportar;
    return anterior;
  }

  async consultar(lotes: LoteClima[]): Promise<Record<string, ResultadoClimaLote>> {
    if (lotes.length === 0) return {};
    const centros = lotes.map((lote) => centroidOf(lote.polygon));
    const params = new URLSearchParams({
      latitude: centros.map(([lat]) => lat.toFixed(4)).join(','),
      longitude: centros.map(([, lng]) => lng.toFixed(4)).join(','),
      daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min',
      past_days: String(DIAS_PASADOS),
      forecast_days: String(DIAS_PRONOSTICO),
      timezone: 'auto',
    });
    const errorParaTodos = (mensaje: string) => Object.fromEntries(lotes.map((lote) => [lote.id, { estado: 'error', loteId: lote.id, mensaje } as const]));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let respuesta: RespuestaOpenMeteo;
    try {
      respuesta = await this.transportar(`${ENDPOINT}?${params.toString()}`, controller.signal);
    } catch {
      clearTimeout(timeout);
      return errorParaTodos('No se pudo contactar al servicio meteorológico (Open-Meteo).');
    }
    clearTimeout(timeout);
    if (!respuesta.ok) return errorParaTodos(`Open-Meteo respondió HTTP ${respuesta.status}.`);
    let json: unknown;
    try { json = await respuesta.json(); } catch { return errorParaTodos('Open-Meteo devolvió una respuesta que no se pudo interpretar.'); }
    const registros: RegistroOpenMeteo[] = Array.isArray(json) ? json as RegistroOpenMeteo[] : [json as RegistroOpenMeteo];
    const resultados: Record<string, ResultadoClimaLote> = {};
    lotes.forEach((lote, i) => {
      const clima = aClima(registros[i] ?? {});
      resultados[lote.id] = clima ? { estado: 'ok', loteId: lote.id, clima, categoria: categorizarLluvia(clima) } : { estado: 'error', loteId: lote.id, mensaje: 'Sin datos de Open-Meteo para este lote.' };
    });
    return resultados;
  }
}

export const openMeteo = new OpenMeteoClient();
