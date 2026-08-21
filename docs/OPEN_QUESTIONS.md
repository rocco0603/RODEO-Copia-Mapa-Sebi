# Preguntas abiertas

Este archivo existe para evitar que un agente invente decisiones que el equipo todavía no tomó.

## Autenticación

Pendiente definir:

- longitud mínima de username;
- longitud mínima de contraseña;
- mecanismo exacto de sesión (preferencia técnica: cookie HTTP-only si encaja bien con el entorno);
- duración de sesión.

Decidido:

- username único;
- username + contraseña solamente por ahora;
- contraseña hasheada;
- sin roles por ahora;
- sin email obligatorio por ahora.

## Notificaciones

## Decisiones cerradas desde la implementación actual

- La sesión usa JWT en cookie HttpOnly `rodeo_session`.
- La sesión dura 7 días; `SameSite=Lax` en desarrollo y `Secure` en producción.
- La contraseña exige al menos 8 caracteres; el username debe ser único.
- PostgreSQL remoto es Neon para el estado actual.
- Copernicus es opcional en desarrollo y usa `COPERNICUS_CLIENT_ID`/
  `COPERNICUS_CLIENT_SECRET` sin exponer secretos al navegador.
- La autenticación y los datos de mapa ya usan Neon mediante APIs privadas.

Lo que sigue abierto es el deployment final, incluyendo dominio, CORS y
atributos definitivos de cookies.

Pendiente:

- diseño final (campana, panel, página o combinación);
- lista final de tipos;
- cuáles generan notificación persistente y cuáles son sólo alertas de pantalla;
- política de deduplicación.

Decidido:

- debe existir backend/modelo de notificaciones;
- habrá una entrada visual de notificaciones en la aplicación;
- se preparará una página/panel aunque el diseño sea provisional.

## Datos agronómicos / scoring

Pendiente entrevista con productor para validar importancia y pesos de variables.

Los pesos actuales de NDVI/NDMI/EVI y umbrales de lluvia siguen siendo puntos de partida técnicos, no una calibración agronómica definitiva.

No presentar el puntaje actual como “IA” ni como probabilidad.

### Estado implementado de notificaciones

Ya existen API privada, paginaciÃ³n, conteo global de no leÃ­das, marcado
individual/masivo y panel base en Sidebar. No hay generaciÃ³n automÃ¡tica ni
endpoint pÃºblico de creaciÃ³n. Siguen abiertos los tipos finales,
deduplicaciÃ³n y reglas de producto.

## Historial

Decidido:

- no sobrescribir observaciones satelitales;
- guardar cada observación real;
- guardar cada consulta de clima y su detalle diario;
- soft delete de lotes para no perder historia.

Pendiente:

- diseño final de la pantalla Historial;
- cuánto historial mostrar por defecto;
- filtros por fecha/fuente.

## Geometría

Decidido:

- conservar GeoJSON y mapa actual;
- almacenar geometría como JSONB en primera versión;
- no PostGIS todavía;
- edición de establecimiento inválida si deja un lote no eliminado afuera.

Pendiente:

- edición geométrica directa de lotes ya implementada mediante `PATCH /api/lotes/:id`;
- si se agregará historial de cambios geométricos en una etapa futura.

## Lotes

Decidido:

- número automático;
- apodo opcional;
- activo/inactivo;
- soft delete;
- números no se reutilizan automáticamente.

Pendiente:

- si un lote eliminado podrá restaurarse desde UI;
- si en el futuro se permitirá archivar en lugar de eliminar.

## Backend / despliegue

Decidido:

- Node.js;
- PostgreSQL;
- Neon como PostgreSQL remoto del estado actual;
- secretos sólo en entorno servidor.

Pendiente:

- proveedor/entorno de despliegue del backend;
- dominio/URL final;
- configuración final de CORS/cookies según despliegue;
- CI/CD.

## Historial y estado actual

Decidido: los listados de historial usan `limit`/`offset` con límite máximo
100; `/api/lotes/:id/historial` conserva compatibilidad y devuelve como máximo
50 elementos por colección. `GET /api/lotes/:id/estado` es una capa de datos
objetiva y no representa el futuro modelo/recomendador.

Pendiente: definir, en una etapa posterior, qué reglas agronómicas consumirán
este DTO y cómo se calibrarán sin confundirlo con el scoring provisional.

Implementado: `GET /api/lotes/estado` devuelve la colección completa de lotes
activos, con opción explícita de incluir inactivos no eliminados. No se pagina
por ahora debido al límite conceptual actual de lotes por establecimiento.

## Ficha completa de lote

La integraciÃ³n de Copernicus ya fue trasladada al backend Express. Queda como
decisiÃ³n posterior mover tambiÃ©n el parsing/scoring y la persistencia fuera del
frontend; esta etapa sÃ³lo mueve el gateway seguro.

Implementada en `/lotes/:id`, con historial paginado y deep link. Siguen
pendientes las notificaciones UI y mover las consultas de Copernicus/Open-Meteo
al backend; esta ficha no introduce recomendaciones ni cambios de modelo.

## Clima externo

Open-Meteo ya estÃ¡ centralizado detrÃ¡s de Express. No requiere API key; la
persistencia histÃ³rica sigue separada y no se fusiona con la consulta externa.

## Ganado y GPS

## Decisiones cerradas de la etapa actual

- La persistencia de mediciones y clima ocurre después de una respuesta exitosa
  de los servicios externos; un error o `sin-datos` no crea historial falso.
- La próxima pasada óptica se muestra sólo como estimación aproximada de ~5
  días, nunca como fecha garantizada.
- El uso manual conserva todos los registros y el descanso se deriva del uso
  más reciente.

- El establecimiento y los lotes del usuario autenticado se cargan desde Neon.
- `localStorage` ya no es fuente ni fallback para esos datos.
- No se migran automáticamente datos locales antiguos.
- El onboarding visual reutiliza el mapa y recupera el paso pendiente si ya
  existe establecimiento.
- La eliminación de establecimiento queda deshabilitada hasta definir una
  semántica backend que preserve relaciones e historial.

Fuera de alcance por ahora.

Cuando se retome, habrá que definir:

- dispositivo comercial exacto;
- ID externo;
- frecuencia de posición;
- asignación dispositivo-animal;
- batería;
- precisión;
- reglas de alerta;
- cantidad de vacas monitoreadas.

No crear tablas o endpoints definitivos de esta parte hasta que el equipo la destrabe.
