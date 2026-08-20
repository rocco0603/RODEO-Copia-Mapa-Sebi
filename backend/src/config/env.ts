import 'dotenv/config';

const isTest = process.env.NODE_ENV === 'test';
const databaseUrl = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
const authJwtSecret = process.env.AUTH_JWT_SECRET;

if (!databaseUrl) {
  throw new Error(isTest ? 'Falta la variable de entorno TEST_DATABASE_URL para ejecutar tests de integraciÃ³n.' : 'Falta la variable de entorno DATABASE_URL.');
}

if (isTest && process.env.DATABASE_URL && databaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL no puede ser igual a DATABASE_URL.');
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
