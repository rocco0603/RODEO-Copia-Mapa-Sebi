import type { Lote } from "../types";
import type { ResultadoClimaLote } from "./types";

/** Consulta el backend, que valida los lotes y habla con Open-Meteo. */
export async function consultarClimaLotes(lotes: Lote[]): Promise<Record<string, ResultadoClimaLote>> {
  if (lotes.length === 0) return {};
  try {
    const response = await fetch("/api/clima/consultar", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loteIds: lotes.map((lote) => lote.id) }),
    });
    const body = (await response.json().catch(() => null)) as { resultados?: Record<string, ResultadoClimaLote>; error?: { message?: string } } | null;
    if (!response.ok || !body?.resultados) {
      const mensaje = body?.error?.message ?? "No se pudo contactar al servicio meteorológico.";
      return Object.fromEntries(lotes.map((lote) => [lote.id, { estado: "error", loteId: lote.id, mensaje } as const]));
    }
    return body.resultados;
  } catch {
    return Object.fromEntries(lotes.map((lote) => [lote.id, { estado: "error", loteId: lote.id, mensaje: "No se pudo contactar al servicio meteorológico." } as const]));
  }
}
