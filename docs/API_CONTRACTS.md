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
- cambiar geometría cuando se implemente edición de lote.

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

Los DTOs deberían mantener nombres y estructuras cercanas a los tipos existentes (`Establecimiento`, `Lote`, `ResultadoLote`, `ResultadoClimaLote`) para minimizar cambios en componentes de mapa y paneles.
