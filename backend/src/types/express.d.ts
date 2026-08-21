import type { Usuario } from '../auth/types.js';

declare global {
  namespace Express {
    interface Request {
      usuario?: Usuario;
      requestId?: string;
    }
  }
}

export {};
