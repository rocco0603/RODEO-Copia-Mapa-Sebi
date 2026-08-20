export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

interface ErrorResponse {
  error?: { code?: string; message?: string };
}

export async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Verificá que el backend esté funcionando.");
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as T | ErrorResponse | null;
  if (!response.ok) {
    const error = body as ErrorResponse | null;
    throw new ApiError(response.status, error?.error?.message ?? "No se pudo completar la operación.", error?.error?.code);
  }
  return body as T;
}
