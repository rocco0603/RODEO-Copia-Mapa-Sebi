export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  if (error instanceof ApiError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } } };
}
