export interface UsuarioAutenticado {
  id: string;
  username: string;
  onboardingCompleted: boolean;
}

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

async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Verificá que el backend esté funcionando.");
  }

  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as T | ErrorResponse | null;
  if (!response.ok) {
    const error = body as ErrorResponse | null;
    throw new ApiError(
      response.status,
      error?.error?.message ?? "No se pudo completar la operación.",
      error?.error?.code,
    );
  }
  return body as T;
}

function body(username: string, password: string): BodyInit {
  return JSON.stringify({ username, password });
}

export async function register(username: string, password: string): Promise<UsuarioAutenticado> {
  const result = await pedir<{ user: UsuarioAutenticado }>("/api/auth/register", {
    method: "POST",
    body: body(username, password),
  });
  return result.user;
}

export async function login(username: string, password: string): Promise<UsuarioAutenticado> {
  const result = await pedir<{ user: UsuarioAutenticado }>("/api/auth/login", {
    method: "POST",
    body: body(username, password),
  });
  return result.user;
}

export async function logout(): Promise<void> {
  await pedir<void>("/api/auth/logout", { method: "POST" });
}

export async function getCurrentUser(): Promise<UsuarioAutenticado | null> {
  try {
    const result = await pedir<{ user: UsuarioAutenticado }>("/api/auth/me");
    return result.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
