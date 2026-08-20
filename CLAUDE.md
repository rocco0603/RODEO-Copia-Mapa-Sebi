# RODEO

Front de gestión de establecimiento y lotes para ganadería (React + Vite + TS), con condición de pastoreo satelital y clima por lote. El proyecto ahora entra en una nueva etapa: además del frontend existente, este repositorio incorporará backend, PostgreSQL, autenticación y persistencia histórica.

## Antes de tocar nada

Leé primero `AGENTS.md` y después los documentos que referencia.

En particular:

- `docs/PROJECT_DIRECTION.md`
- `docs/AUTH_ONBOARDING.md`
- `docs/DATABASE_MODEL.md`
- `docs/API_CONTRACTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/CODEX_START_HERE.md`

El `README.md` sigue conteniendo mucho contexto técnico valioso sobre el frontend, Copernicus y Open-Meteo, pero su antiguo bloqueo de “no construir backend” quedó superado por esta etapa nueva. La documentación en `docs/` y `AGENTS.md` manda para el rumbo actual.

## La regla que no se rompe

Nunca mostrar ni persistir un dato inventado. Si no hay dato real, es "sin datos" o un error explícito.

El radar Sentinel-1 nunca se mezcla con la óptica Sentinel-2 en el mismo puntaje: son físicas distintas sin calibración cruzada. Los rangos de `scoring.ts` e `interpretacion.ts` siguen siendo puntos de partida, no calibración agronómica.

## Qué sí está habilitado ahora

- backend Node.js;
- PostgreSQL;
- esquema/migraciones;
- registro/login;
- onboarding;
- persistencia de establecimiento y lotes;
- historial satelital;
- historial de clima;
- notificaciones base.

## Qué sigue pausado

- ganado/vacas;
- GPS/dispositivos;
- rotación definitiva;
- planes multi-día definitivos;
- machine learning;
- roles/membresías entre usuarios.

No implementar estas áreas sin que el equipo las destrabe.

## Mapa y geometría

El mapa actual funciona y se debe preservar. Mantener GeoJSON `Feature<Polygon>` y Turf.

Primera versión de DB: guardar polígonos como `JSONB`, no introducir PostGIS todavía.

Regla nueva importante: una edición del establecimiento no puede guardarse si deja algún lote no eliminado parcial o totalmente afuera. La edición debe rechazarse y conservar/restaurar el límite anterior.

## Persistencia

`localStorage` es provisional. La fuente definitiva será PostgreSQL. Migrar de forma incremental, no borrar de golpe la lógica actual antes de tener equivalencia funcional vía API.

Los lotes usan soft delete para conservar historial.

Cada observación satelital real y cada consulta de clima deben poder persistirse históricamente sin pisar datos anteriores.

## Seguridad

- username único;
- contraseñas hasheadas, nunca planas;
- secretos en servidor / `.env` gitignored;
- nunca enviar `COPERNICUS_CLIENT_SECRET` al browser;
- endpoints privados deben resolver usuario desde la sesión, no confiar en un `user_id` libre del frontend.

## Entorno y validación

Validar cambios con TypeScript y build. Cuando exista backend, validar también sus endpoints y su conexión/schema.

No hay que asumir que algo "debería" funcionar: comprobarlo y documentar cualquier decisión relevante.