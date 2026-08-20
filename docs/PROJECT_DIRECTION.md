# Dirección actual de RODEO

## Objetivo de esta etapa

El repositorio ya tiene un frontend funcional para dibujar un establecimiento y sus lotes, consultar condición satelital real y consultar clima real. La siguiente etapa agrega la capa que faltaba: usuarios, backend, base de datos y persistencia histórica.

No se debe rehacer el mapa. Se debe conservar la arquitectura actual y conectarla a persistencia real.

## Qué ya existe y se conserva

- React + TypeScript + Vite.
- Leaflet / React-Leaflet.
- Leaflet Draw para dibujar y editar polígonos.
- Turf para validaciones geométricas.
- Un único establecimiento en el estado actual.
- Lotes numerados automáticamente.
- Apodo opcional para lotes.
- Nombre obligatorio del establecimiento.
- Activar/desactivar lotes.
- Cálculo de hectáreas.
- Copernicus Data Space con Sentinel-2 L2A.
- Sentinel-1 GRD como respaldo de radar.
- NDVI, NDMI, NDWI, EVI y RVI.
- Puntaje 0–100 para la condición óptica actual.
- Alertas de condición.
- Tendencia de últimas observaciones despejadas.
- Open-Meteo por centroide de lote.
- Lluvia de últimos 7 días, pronóstico y temperatura.

## Qué deja de ser definitivo

Actualmente establecimiento y lotes se guardan en `localStorage`. Eso fue correcto mientras no existía backend, pero deja de ser la fuente definitiva de verdad.

La fuente definitiva será PostgreSQL. `localStorage` puede mantenerse temporalmente como compatibilidad/migración durante la implementación, pero el objetivo es que un usuario pueda iniciar sesión desde otro dispositivo y recuperar su establecimiento, lotes e historial desde el backend.

## Nueva arquitectura objetivo

```text
Frontend React
    |
    v
API HTTP
    |
    v
Backend Node.js
    |
    +--> PostgreSQL / Neon
    |
    +--> Copernicus
    |
    +--> Open-Meteo (puede migrarse gradualmente al backend)
```

En la primera etapa no hace falta mover todas las integraciones externas de golpe si eso pone en riesgo el frontend. La migración debe ser progresiva.

## Decisiones cerradas

### Usuarios

- registro con `username` + contraseña;
- `username` único;
- contraseña guardada exclusivamente como hash;
- sin roles todavía;
- sin email obligatorio por ahora.

### Establecimiento

- un usuario puede tener sólo un establecimiento en esta versión;
- el nombre del establecimiento sigue siendo obligatorio;
- el establecimiento se dibuja con el mapa actual;
- su polígono se guarda en PostgreSQL como GeoJSON `JSONB`.

### Lotes

- un establecimiento tiene muchos lotes;
- número automático por establecimiento;
- apodo opcional;
- activo/inactivo;
- soft delete para conservar historia;
- un lote eliminado deja de mostrarse como normal, pero sus datos históricos siguen existiendo.

### Onboarding

Para terminar el onboarding deben existir:

1. una cuenta registrada;
2. un establecimiento;
3. al menos un lote creado.

Al completarse se guarda `onboarding_completed_at`.

Una vez completado, no se revierte automáticamente aunque el usuario después desactive o elimine todos los lotes.

Si el usuario cierra sesión antes de completar el onboarding, el siguiente login debe devolverlo al flujo de onboarding.

### Geometría

Mantener el mapa actual y el mismo formato GeoJSON.

Reglas:

- lote completamente contenido en establecimiento;
- lotes no eliminados sin superposición de área;
- al editar el establecimiento no se puede guardar una geometría que deje algún lote no eliminado afuera;
- una edición inválida se rechaza y se restaura/conserva el límite anterior.

### Datos satelitales

Guardar cada observación real recuperada, no sólo el último valor.

No sobrescribir una medición anterior con una nueva.

Sentinel-1 y Sentinel-2 permanecen diferenciados.

### Clima

Guardar cada consulta de clima y los días que devolvió esa consulta. Esto conserva tanto observaciones pasadas como la evolución del pronóstico a través del tiempo.

### Notificaciones

Preparar modelo y endpoints base aunque el diseño final de UI y los tipos definitivos todavía no estén cerrados.

### Fuera de alcance inmediato

Todavía no implementar:

- vacas;
- dispositivos GPS;
- posiciones GPS;
- jornadas de pastoreo;
- planificación automática multi-día definitiva;
- machine learning;
- roles/permisos entre usuarios.

Esas capas se incorporarán después de tener sólida la base de usuarios, establecimiento, lotes e historial.