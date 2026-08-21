import { ApiError, pedir } from "../api/client";
import type { Lote } from "../types";
import type { ResultadoClimaLote } from "./types";

/** Consulta el backend, que valida los lotes y habla con Open-Meteo. */
export async function consultarClimaLotes(lotes: Lote[]): Promise<Record<string, ResultadoClimaLote>> {
  if (lotes.length === 0) return {};

  try {
    const body = await pedir<{ resultados: Record<string, ResultadoClimaLote> }>("/api/clima/consultar", {
      method: "POST",
      body: JSON.stringify({ loteIds: lotes.map((lote) => lote.id) }),
    });
    return body.resultados;
  } catch (error) {
    const mensaje = error instanceof ApiError ? error.message : "No se pudo contactar al servicio meteorológico.";
    return Object.fromEntries(
      lotes.map((lote) => [lote.id, { estado: "error", loteId: lote.id, mensaje } as const]),
    );
  }
}
