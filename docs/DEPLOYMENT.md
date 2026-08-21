# Despliegue de RODEO

RODEO todavía no está desplegado ni atado a un proveedor. Esta guía describe
los requisitos de producción de forma independiente de la plataforma elegida.

## Topologías admitidas

La opción más simple es servir frontend y API bajo el mismo origen, manteniendo
las llamadas relativas a `/api`. También se admite separar los orígenes:

- el frontend define `VITE_API_BASE_URL=https://api.ejemplo.com` al construir;
- el backend incluye el origen público exacto del frontend en `CORS_ORIGINS`;
- todas las llamadas conservan `credentials: "include"`;
- si la cookie debe viajar entre sitios, se usa `COOKIE_SAME_SITE=none`, siempre
  con `NODE_ENV=production` y HTTPS.

No usar `VITE_` para secretos. `VITE_API_BASE_URL` es una URL pública que queda
incluida en el bundle; las credenciales de PostgreSQL, JWT y Copernicus existen
sólo en el entorno del backend.

## Variables de entorno

### Frontend, durante el build

| Variable | Requerida | Uso |
|---|---:|---|
| `VITE_API_BASE_URL` | No | URL pública del backend separado. Vacía conserva `/api` relativo. |

### Backend, durante ejecución

| Variable | Requerida | Uso |
|---|---:|---|
| `NODE_ENV` | Sí en producción | Debe ser `production`. |
| `PORT` | No | Puerto HTTP; por defecto `3001`. |
| `DATABASE_URL` | Sí | PostgreSQL de la aplicación. |
| `AUTH_JWT_SECRET` | Sí | Secreto aleatorio de al menos 32 caracteres. |
| `CORS_ORIGINS` | Según topología | Orígenes HTTP(S) exactos, separados por comas. No acepta `*` ni paths. |
| `TRUST_PROXY` | Según plataforma | Número de proxies confiables entre Internet y Express; vacío equivale a `false`. |
| `COOKIE_SAME_SITE` | No | `lax` por defecto; también `strict` o `none`. |
| `COPERNICUS_CLIENT_ID` | No | Activa Copernicus únicamente junto con el secret. |
| `COPERNICUS_CLIENT_SECRET` | No | Secreto server-side de Copernicus. |

`TEST_DATABASE_URL` es exclusiva de tests de integración. Debe apuntar a una
base separada y nunca puede ser igual a `DATABASE_URL`.

La aplicación falla al arrancar si una variable obligatoria o un formato de
seguridad es inválido. `COOKIE_SAME_SITE=none` sólo se acepta en producción,
donde la cookie incorpora `Secure`.

## Proxy, cookies y HTTPS

Configurá `TRUST_PROXY` con la cantidad real de saltos confiables indicada por
la plataforma. No lo habilites genéricamente: Express usa esa confianza para
determinar la IP cliente, que también alimenta el rate limit de autenticación.

El TLS debería terminar en el proxy o balanceador de la plataforma. La URL
pública debe usar HTTPS antes de habilitar cookies cross-site. El backend
mantiene la sesión en `rodeo_session`, HttpOnly, con siete días de duración.

El limitador de login/registro usa memoria del proceso. Es suficiente para una
primera instancia, pero un despliegue horizontal debe reemplazar el store por
uno compartido para que el límite sea global y sobreviva reinicios.

## Build, migración y arranque

Frontend:

```bash
npm ci
npx tsc --noEmit
npm run build
```

Backend:

```bash
cd backend
npm ci
npm run typecheck
npm run build
npm run db:migrate
npm start
```

La migración es un paso explícito previo al arranque; no se ejecuta
automáticamente desde el servidor. PostgreSQL es portable: Neon es el servicio
actual, pero cualquier PostgreSQL compatible puede usarse con `DATABASE_URL`.

El proceso responde a `SIGTERM` y `SIGINT`: deja de aceptar conexiones, espera
las requests en curso, cierra conexiones idle y finalmente cierra el pool de
PostgreSQL. La plataforma debe conceder hasta 75 segundos antes de forzar la
terminación, porque una consulta de Copernicus puede tardar cerca de 60.

El servidor usa `requestTimeout=90 s`, `headersTimeout=15 s` y
`keepAliveTimeout=5 s`: conserva margen sobre el timeout legítimo de Copernicus
sin mantener headers o conexiones idle indefinidamente. El pool PostgreSQL se
mantiene conservador (`max=10`, conexión 15 s, idle 30 s) para evitar esperas
sin límite sin hacer tuning específico de un proveedor.

## Health checks

- `GET /api/health/live`: confirma que el proceso HTTP está vivo; no consulta DB.
- `GET /api/health/ready`: confirma proceso y conectividad PostgreSQL; devuelve
  `503` si la base no está disponible.
- `GET /api/health`: alias compatible del readiness histórico.

Usá `/live` para liveness y `/ready` para readiness. Ninguno expone secretos.

## Smoke test de producción

Después de desplegar:

1. comprobar `/api/health/live` y `/api/health/ready`;
2. abrir el frontend y confirmar que las respuestas incluyen `X-Request-Id`;
3. registrar un usuario de prueba, cerrar sesión y volver a iniciar sesión;
4. verificar que la cookie sea HttpOnly y tenga los atributos esperados;
5. confirmar que un origen no permitido no recibe `Access-Control-Allow-Origin`;
6. crear establecimiento/lote en un entorno de prueba y recargar la página;
7. probar Open-Meteo y, sólo si hay credenciales, Copernicus;
8. revisar logs estructurados sin bodies, cookies ni secretos.

No ejecutar smoke tests destructivos contra datos reales de usuarios. El
proveedor, los dominios definitivos y el mecanismo de CI/CD de despliegue siguen
siendo decisiones abiertas.
