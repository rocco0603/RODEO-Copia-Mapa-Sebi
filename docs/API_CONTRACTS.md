# Contratos iniciales de API

Este documento define la forma esperada de la API para que frontend y backend puedan evolucionar sin acoplarse a `localStorage`.

Las rutas son una propuesta inicial. Si durante implementación se cambia una, actualizar este archivo en el mismo commit.

## Convenciones

- prefijo: `/api`;
- JSON para requests/responses;
- endpoints privados requieren sesión autenticada;
- nunca aceptar `user_id` como autoridad enviada por el frontend: el backend obtiene el usuario desde la sesión;
- errores con status HTTP correcto + mensaje legible;
- no devolver `password_hash`.

## Auth

### `POST /api/auth/register`

Request:

```json
{
  "username": "rocco",
  "password": "..."
}
```

Respuesta `201`:

```json
{
  "user": {
    "id": "uuid",
    "username": "rocco",
    "onboardingCompleted": false
  }
}
```

Errores esperables:

- `400`: datos inválidos;
- `409`: username ocupado.

### `POST /api/auth/login`

Request igual al registro.

Respuesta `200`:

```json
{
  "user": {
    "id": "uuid",
    "username": "rocco",
    "onboardingCompleted": true
  }
}
```

### `POST /api/auth/logout`

Invalida la sesión.

### `GET /api/auth/me`

Devuelve usuario actual y estado de onboarding.

## Establecimiento

### `GET /api/establecimiento`

Devuelve el establecimiento del usuario o `null` si todavía no existe.

```json
{
  "establecimiento": {
    "id": "uuid",
    "nombre": "Campo Altieri",
    "polygon": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [] }, "properties": {} },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### `POST /api/establecimiento`

Crea el único establecimiento del usuario.

Request:

```json
{
  "nombre": "Campo Altieri",
  "polygon": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [] }, "properties": {} }
}
```

Debe fallar si el usuario ya tiene uno.

### `PATCH /api/establecimiento`

Permite cambiar nombre y/o polígono.

Si cambia el polígono, el backend valida que todos los lotes no eliminados sigan contenidos. Si alguno queda afuera, responde error y no guarda la nueva geometría.

## Lotes

### `GET /api/lotes`

Por defecto devuelve lotes no eliminados. Puede incluir activos e inactivos.

### `POST /api/lotes`

Request:

```json
{
  "apodo": "Molino",
  "polygon": { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [] }, "properties": {} }
}
```

El backend asigna `numero` automáticamente.

Validaciones:

- usuario debe tener establecimiento;
- lote completamente dentro del establecimiento;
- no superponer área con lote no eliminado;
- si es el primer lote y el onboarding estaba pendiente, completar `onboarding_completed_at`.

### `PATCH /api/lotes/:id`

Permite como mínimo:

- cambiar apodo;
- activar/desactivar;
- cambiar geometría; el backend vuelve a validar contención y no solapamiento.

La geometría vuelve a validarse.

### `DELETE /api/lotes/:id`

No hace hard delete.

Implementación:

```text
deleted_at = NOW()
```

Respuesta puede ser `204`.

## Satélite

Hay dos capas posibles durante la migración:

1. conservar temporalmente la consulta actual desde frontend y agregar un endpoint para persistir resultados;
2. objetivo final: backend consulta Copernicus, persiste y responde.

Se prefiere llegar a la opción 2.

### `POST /api/lotes/:id/condicion/actualizar`

Objetivo final:

- consultar Copernicus para ese lote;
- guardar observaciones nuevas sin duplicar;
- calcular/devolver condición actual;
- respetar la separación Sentinel-2 / Sentinel-1.

### `GET /api/lotes/:id/condicion`

Devuelve la condición más reciente disponible y el historial necesario para gráficos.

### `GET /api/lotes/:id/mediciones-satelitales`

Devuelve historial, con filtros opcionales por fecha/fuente más adelante.

## Clima

### `POST /api/lotes/clima/actualizar`

Puede actualizar todos los lotes activos del establecimiento, conservando la optimización actual de una consulta multi-coordenada a Open-Meteo.

Debe persistir:

- una fila en `consultas_clima` por lote;
- sus filas asociadas en `dias_clima`.

### `GET /api/lotes/:id/clima`

Devuelve último snapshot + días.

### `GET /api/lotes/:id/clima/historial`

Devuelve snapshots anteriores cuando la UI de historial los necesite.

## Notificaciones

### `GET /api/notificaciones`

Devuelve notificaciones del usuario ordenadas por fecha descendente.

### `PATCH /api/notificaciones/:id/leida`

Marca `read_at`.

### `PATCH /api/notificaciones/leidas`

Opcional: marcar todas como leídas.

Los tipos exactos de notificación siguen abiertos.

### Contrato implementado de notificaciones

`GET /api/notificaciones` ordena por `created_at DESC, id DESC`, acepta
`limit` (default 20, mÃ¡ximo 100), `offset` y
`soloNoLeidas=true|false`. Devuelve la colecciÃ³n, `noLeidas` global y
`paginacion` con `total` y `hayMas`.

`PATCH /api/notificaciones/:id/leida` es idempotente y devuelve el DTO
actualizado. `PATCH /api/notificaciones/leidas` devuelve
`{ "actualizadas": N }` y conserva los timestamps previos. Todos los endpoints
usan el usuario de sesiÃ³n; no existe endpoint HTTP de creaciÃ³n.

## Respuesta de errores

Formato recomendado:

```json
{
  "error": {
    "code": "LOT_OUTSIDE_ESTABLISHMENT",
    "message": "El lote debe quedar completamente dentro del establecimiento."
  }
}
```

Códigos legibles ayudan al frontend a decidir cómo mostrar el error sin depender sólo del texto.

## Estado de implementación

Auth, Establecimiento y Lotes ya están implementados en el backend. La sesión
usa la cookie HttpOnly `rodeo_session` y los errores usan `{ "error": { "code",
"message" } }`. Satélite, clima y notificaciones siguen siendo contratos
futuros.

## Compatibilidad frontend

## Historial implementado

El backend expone, siempre con sesión autenticada y validando pertenencia del
lote:

- `POST/GET /api/lotes/:id/mediciones-satelitales`;
- `POST/GET /api/lotes/:id/clima`;
- `POST/GET /api/lotes/:id/usos`;
- `GET /api/lotes/:id/historial`.

Las mediciones satelitales usan upsert por `(lote_id, fuente, observed_at)`.
Sentinel-1 y Sentinel-2 se guardan en filas separadas y los campos que no
corresponden quedan `NULL`. Sólo se persisten resultados exitosos. Las
consultas de clima y sus días se insertan en una transacción.

## Estado real de integración

El estado actual ya conecta estos contratos al mapa: establecimiento y lotes
se cargan desde Neon y las mutaciones esperan el DTO devuelto por el backend.
`localStorage` no se usa como fallback y sus datos antiguos no se importan.

El frontend ya está conectado a `auth/me`, registro, login y logout. En cambio,
el mapa obtiene establecimiento y lotes desde estos contratos privados de API;
`localStorage` no participa en esa carga.

Los DTOs deberían mantener nombres y estructuras cercanas a los tipos existentes (`Establecimiento`, `Lote`, `ResultadoLote`, `ResultadoClimaLote`) para minimizar cambios en componentes de mapa y paneles.

## Consumo desde la ficha del lote

## Gateway Copernicus

`GET /api/copernicus/estado` y `POST /api/copernicus/statistics` requieren
sesiÃ³n autenticada. El primero devuelve `{ "configurado": boolean }`. El
segundo reenvÃ­a el body JSON a la Statistical API y conserva respuestas como
429. Sin credenciales devuelve 503 con `COPERNICUS_NOT_CONFIGURED`.

La ruta frontend `/lotes/:id` carga el estado consolidado y, en paralelo, los
tres listados paginados existentes con 20 elementos por pÃ¡gina. Las
actualizaciones desde la ficha reutilizan los POST existentes y vuelven a
cargar estado e historial; no agregan endpoints ni modifican el contrato del
backend.

## `POST /api/clima/consultar`

Requiere autenticaciÃ³n y recibe `{ "loteIds": ["uuid", "uuid"] }`. Los IDs
deben pertenecer al usuario y corresponder a lotes no eliminados; de lo
contrario devuelve `LOT_NOT_FOUND` sin revelar datos ajenos. La respuesta es
`{ "resultados": { "<loteId>": ResultadoClimaLote } }`. Express consulta
Open-Meteo una sola vez por request multi-lote y devuelve el clima ya
interpretado; la persistencia histÃ³rica sigue usando `POST /api/lotes/:id/clima`.

## Contratos actuales de historial

Los endpoints `GET /api/lotes/:id/mediciones-satelitales`,
`GET /api/lotes/:id/clima` y `GET /api/lotes/:id/usos` aceptan `limit` (1 a
100, default 50), `offset` (default 0), `desde` y `hasta` como fechas
`YYYY-MM-DD`, con `desde <= hasta`. Satélite acepta además
`fuente=sentinel-1|sentinel-2`.

Las respuestas conservan sus colecciones (`mediciones`, `consultas`, `usos`)
y agregan metadata consistente:

```json
{ "paginacion": { "limit": 50, "offset": 0, "total": 0, "hayMas": false } }
```

El filtro temporal de clima usa `consulted_at` como instante UTC; los filtros
de satélite y usos usan columnas `DATE`. El historial consolidado conserva las
colecciones para compatibilidad con la ficha actual, limitadas a las últimas
50 entradas por colección.

## `GET /api/lotes/:id/estado`

Este endpoint autenticado devuelve en una respuesta los datos persistidos más
recientes del lote:

```json
{
  "lote": { "id": "...", "numero": 3, "apodo": null, "activo": true },
  "satelite": { "optico": null, "radar": null },
  "clima": null,
  "uso": { "ultimoUso": null, "diasDescanso": null }
}
```

Cuando existen datos, óptica y radar se seleccionan por separado y exponen
sus estadísticas existentes junto con la edad objetiva de la observación.
Clima expone la consulta más reciente, `horasDesdeConsulta` y el día actual
sólo si existe en `dias_clima`. El descanso es una diferencia de fechas
calendario; sin uso es `null`.

`/estado` no llama Copernicus ni Open-Meteo, no combina Sentinel-1 con
Sentinel-2, no calcula un score nuevo y no es un modelo ni una recomendación.

## `GET /api/lotes/estado`

Devuelve `{ "lotes": [...] }` usando el mismo elemento de estado que el
endpoint individual. Por defecto incluye sólo lotes activos; acepta
`incluirInactivos=true|false` y nunca incluye soft-deleted. Los elementos se
ordenan por `lote.numero ASC`. Esta colección no se pagina todavía: se eligió
una respuesta completa porque un establecimiento tiene una cantidad razonable
de lotes y será una entrada futura del motor de decisión, no el motor mismo.
