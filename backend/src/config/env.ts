import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Falta la variable de entorno DATABASE_URL.');
}

export const env = {
  databaseUrl,
  port: Number(process.env.PORT ?? 3001),
};
