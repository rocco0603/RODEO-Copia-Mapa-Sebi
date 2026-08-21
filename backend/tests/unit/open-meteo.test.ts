import { describe, expect, test } from 'vitest';
import { lote } from '../helpers/fixtures.js';
import { OpenMeteoClient, type RespuestaOpenMeteo } from '../../src/services/open-meteo.js';

function respuesta(json: unknown, ok = true, status = 200): RespuestaOpenMeteo {
  return { ok, status, json: async () => json };
}

const dias = Array.from({ length: 12 }, (_, i) => ({ fecha: `2026-08-${String(i + 10).padStart(2, '0')}`, lluvia: i === 7 ? 8 : 1, max: 20 + i, min: 5 + i }));
const registro = (offset = 0) => ({ daily: { time: dias.map((dia) => dia.fecha), precipitation_sum: dias.map((dia) => dia.lluvia + offset), temperature_2m_max: dias.map((dia) => dia.max), temperature_2m_min: dias.map((dia) => dia.min) } });

describe('cliente backend de Open-Meteo', () => {
  test('consulta un lote y conserva hoy en el índice 7', async () => {
    const client = new OpenMeteoClient(async () => respuesta(registro()));
    const resultado = await client.consultar([{ id: 'lote-1', polygon: lote(1, 2) }]);
    expect(resultado['lote-1'].estado).toBe('ok');
    if (resultado['lote-1'].estado === 'ok') {
      expect(resultado['lote-1'].clima.hoy?.fecha).toBe('2026-08-17');
      expect(resultado['lote-1'].clima.dias[7].esPronostico).toBe(true);
    }
  });

  test('asocia respuestas array a cada lote y conserva sumas de 7 y 5 dÃ­as', async () => {
    const client = new OpenMeteoClient(async (url) => {
      expect(new URL(url).searchParams.get('latitude')?.split(',')).toHaveLength(2);
      return respuesta([registro(), registro(2)]);
    });
    const resultados = await client.consultar([{ id: 'lote-1', polygon: lote(1, 2) }, { id: 'lote-2', polygon: lote(3, 4) }]);
    expect(resultados['lote-1'].estado).toBe('ok');
    expect(resultados['lote-2'].estado).toBe('ok');
    if (resultados['lote-1'].estado === 'ok') expect(resultados['lote-1'].clima.lluviaUltimos7Dias).toBe(7);
    if (resultados['lote-2'].estado === 'ok') expect(resultados['lote-2'].clima.lluviaProximosDias).toBe(22);
  });

  test('mantiene null como cero y controla HTTP 500 y JSON invÃ¡lido', async () => {
    const nullClient = new OpenMeteoClient(async () => respuesta({ daily: { time: dias.map((dia) => dia.fecha), precipitation_sum: dias.map(() => null) } }));
    const nullResult = await nullClient.consultar([{ id: 'lote-1', polygon: lote(1, 2) }]);
    if (nullResult['lote-1'].estado === 'ok') expect(nullResult['lote-1'].clima.lluviaUltimos7Dias).toBe(0);
    const httpResult = await new OpenMeteoClient(async () => respuesta({}, false, 500)).consultar([{ id: 'lote-1', polygon: lote(1, 2) }]);
    expect(httpResult['lote-1']).toMatchObject({ estado: 'error', mensaje: 'Open-Meteo respondiÃ³ HTTP 500.' });
    const jsonResult = await new OpenMeteoClient(async () => ({ ok: true, status: 200, json: async () => { throw new Error('json'); } })).consultar([{ id: 'lote-1', polygon: lote(1, 2) }]);
    expect(jsonResult['lote-1']).toMatchObject({ estado: 'error' });
  });
});
