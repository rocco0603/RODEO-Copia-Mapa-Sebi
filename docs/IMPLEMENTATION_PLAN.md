# Plan de implementación

Objetivo: agregar backend y persistencia sin romper el frontend que ya funciona.

## Principio de trabajo

No hacer una refactorización grande de mapa + auth + datos externos en un solo cambio.

Trabajar por capas, verificando que el proyecto siga compilando y que el mapa conserve comportamiento.

## Fase 0 — documentación y baseline

- leer `AGENTS.md` y toda la carpeta `docs/`;
- levantar frontend actual;
- correr `npx tsc --noEmit`;
- correr `npm run build`;
- no modificar funcionalidad hasta confirmar baseline.

## Fase 1 — backend mínimo

Crear backend Node.js separado del frontend dentro del mismo repositorio, por ejemplo:

```text
backend/
  src/
  package.json
  .env.example
```

Requisitos:

- Express o estructura equivalente simple;
- `GET /api/health`;
- lectura de variables de entorno;
- conexión PostgreSQL preparada;
- migraciones/schema versionado en repo;
- errores JSON consistentes.

No conectar secretos reales al Git.

## Fase 2 — esquema PostgreSQL

Implementar las siete tablas definidas en `DATABASE_MODEL.md`:

1. usuarios;
2. establecimientos;
3. lotes;
4. mediciones_satelitales;
5. consultas_clima;
6. dias_clima;
7. notificaciones.

Agregar constraints, índices y foreign keys.

Primero debe poder ejecutarse contra PostgreSQL local o una URL de DB de entorno. Después se usará Neon.

## Fase 3 — autenticación

Implementar:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Requisitos:

- username único;
- hash seguro de contraseña;
- sesión segura;
- endpoints privados protegidos;
- nunca devolver `password_hash`.

Frontend:

- pantalla registro;
- pantalla login;
- carga inicial de sesión;
- logout.

## Fase 4 — onboarding

Después del registro:

- ir al mapa;
- ocultar/bloquear navegación no necesaria;
- usuario dibuja y nombra establecimiento;
- guardar establecimiento vía API;
- usuario crea primer lote;
- guardar lote vía API;
- backend marca `onboarding_completed_at`;
- desbloquear app.

Si cierra antes de terminar, el siguiente login vuelve al onboarding.

Una vez completado, nunca relock automático por quedarse sin lotes.

## Fase 5 — reemplazar `localStorage`

Migrar gradualmente:

- cargar establecimiento desde API;
- cargar lotes desde API;
- crear/renombrar/activar/desactivar/eliminar vía API;
- mantener los componentes visuales existentes tanto como sea posible.

Cuando la API sea la fuente definitiva, retirar `storage.ts` o dejar únicamente una migración explícita si todavía hace falta importar datos locales antiguos.

## Fase 6 — corrección de edición de establecimiento

Actualmente una edición puede guardarse aunque deje lotes afuera. Cambiar regla:

- validar todos los lotes no eliminados;
- si alguno queda afuera, no persistir la edición;
- restaurar/conservar polígono anterior en UI;
- mostrar mensaje claro.

Validar tanto frontend como backend.

## Fase 7 — soft delete

Cambiar eliminación de lote:

- frontend sigue mostrando acción “Eliminar”;
- backend actualiza `deleted_at`;
- listados normales omiten eliminados;
- historial permanece intacto;
- no reutilizar automáticamente números antiguos.

## Fase 8 — persistencia satelital

Objetivo final: la consulta a Copernicus pasa por backend.

Pasos seguros:

1. mover credenciales al entorno del backend;
2. reutilizar la lógica existente de request/parsing/scoring, no reescribirla sin necesidad;
3. consultar observaciones;
4. insertar sólo observaciones nuevas;
5. devolver condición actual + tendencia al frontend;
6. mantener Sentinel-1 separado de Sentinel-2.

El `vite-plugin-copernicus.ts` actual puede coexistir temporalmente durante la migración, pero el objetivo es retirarlo cuando el backend cubra su función.

## Fase 9 — persistencia de clima

Mover o encapsular la consulta de Open-Meteo en backend manteniendo la optimización actual de múltiples coordenadas por request.

Por cada actualización:

- crear snapshot por lote;
- guardar resumen;
- guardar cada día asociado;
- devolver DTO compatible al frontend.

## Fase 10 — notificaciones base

Crear:

- endpoint de listado;
- marcar una/todas como leídas;
- icono/campana o entrada visible provisional en frontend;
- página/panel simple de notificaciones.

No inventar todavía una taxonomía compleja de alertas. Los tipos concretos se agregan cuando el equipo los defina.

## Fase 11 — historial UI

Con la DB ya llena, recién entonces construir una vista Historial real que pueda mostrar:

- evolución satelital guardada;
- evolución de consultas de clima;
- eventualmente recomendaciones y uso real cuando existan.

## No hacer en estas fases

- vacas;
- GPS;
- batería;
- rutas de animales;
- jornadas;
- recomendaciones multi-día definitivas;
- ML;
- roles de usuarios;
- múltiples establecimientos por usuario.

## Definition of done por fase

Cada fase debe:

- compilar;
- no romper el mapa existente;
- actualizar documentación si cambió contrato/modelo;
- dejar pasos claros de ejecución;
- evitar secretos en Git;
- incluir una prueba manual mínima o test automatizado cuando corresponda.