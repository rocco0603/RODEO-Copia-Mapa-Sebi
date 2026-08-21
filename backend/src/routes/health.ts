import { Router, type Request, type Response } from 'express';
import { pool } from '../db/pool.js';

export const healthRouter = Router();

async function readiness(_req: Request, res: Response) {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
}

healthRouter.get('/', readiness);
healthRouter.get('/live', (_req, res) => { res.json({ status: 'ok' }); });
healthRouter.get('/ready', readiness);
