import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
const authJwtSecret = process.env.AUTH_JWT_SECRET;

if (!databaseUrl) {
  throw new Error('Falta la variable de entorno DATABASE_URL.');
}

if (!authJwtSecret || authJwtSecret.length < 32) {
  throw new Error('Falta AUTH_JWT_SECRET o es demasiado corto.');
}

export const env = {
  databaseUrl,
  authJwtSecret,
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
