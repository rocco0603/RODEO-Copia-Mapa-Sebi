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
- La autenticación ya usa Neon, pero los datos de mapa aún usan `localStorage`
  hasta la siguiente etapa de conexión de establecimiento y lotes.

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

- edición geométrica directa de lotes: el mapa actual no la expone todavía de la misma forma que el límite del establecimiento;
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

## Ganado y GPS

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
