# RODEO

Este repositorio contiene el frontend React/Vite existente y el backend real
Node.js/Express/PostgreSQL. El backend ya incluye autenticación, sesiones por
cookie HttpOnly y APIs privadas de establecimiento y lotes. El texto histórico
del frontend que aparece más abajo conserva contexto de la arquitectura
original, pero el backend ya no está fuera de alcance.

Front de gestión de establecimiento y lotes para ganadería, con condición de
pastoreo (satelital) y clima por lote. Es un proyecto grupal: este repo es
El backend de este mismo repositorio ya es la base oficial de persistencia y
autenticación; GPS y ganado continúan fuera de alcance.

Este documento existe para que quien retome el proyecto —humano o asistente
de IA, en otra máquina, sin el historial de chat previo— entienda el estado
real, las decisiones ya tomadas y **por qué**, sin tener que redescubrirlas.

## Estado actual (qué hace hoy)

- Dibujás el límite de un establecimiento y sus lotes sobre un mapa (Leaflet).
- Por cada lote activo, "Analizar" trae la condición de pastoreo real desde
  Sentinel-2/Sentinel-1 (Copernicus), con puntaje 0–100, alertas y un
  gráfico de tendencia de los últimos días despejados.
- Por cada lote activo, el clima (Open-Meteo) muestra lluvia de los últimos
  7 días + pronóstico a 5, con una etiqueta corta (Seco / Normal / Lluvia en
  camino / Piso pesado).
- Todo dato mostrado es real — nunca simulado ni inventado. Ver "Principio
  rector" más abajo; es la regla de diseño más importante del proyecto.
- El sidebar tiene 4 pestañas: Establecimiento, Lotes, Clima, Condición.

## Para volver a levantarlo

```bash
npm install          # reinstala node_modules (no viene en esta copia)
npm run certs        # sólo en Windows con red corporativa (ver abajo)
npm run dev
```

Copernicus es opcional para levantar el frontend. Si querés usar el análisis
satelital, creá `.env.local` en la raíz a partir de `.env.example` y completá
`COPERNICUS_CLIENT_ID` y `COPERNICUS_CLIENT_SECRET` con credenciales de
https://dataspace.copernicus.eu. No uses prefijo `VITE_`: esas variables las
lee únicamente el proceso Node de Vite.

El clima (Open-Meteo) no necesita ninguna credencial ni configuración.

## Estado real de cierre de etapa

### IMPLEMENTADO

- Frontend React/Vite con mapa Leaflet, dibujo actual, Turf, Copernicus Sentinel-1/Sentinel-2 y Open-Meteo.
- Backend Node.js + TypeScript + Express con PostgreSQL real en Neon.
- `GET /api/health`.
- Registro, login, logout y `GET /api/auth/me`, con bcrypt, JWT en cookie HttpOnly y sesión persistente.
- APIs privadas de establecimiento y lotes, validaciones geométricas, lotes contenidos, no solapamiento, soft delete, numeración histórica no reutilizable y `onboarding_completed_at` irreversible.
- Frontend conectado a autenticación real: loading inicial, login, registro, usuario visible, logout y separación `App`/`RodeoApp` para conservar el orden de hooks del mapa.
- Proxy Vite para el backend.
- Copernicus es opcional para levantar Vite. Sus credenciales se leen únicamente en Node/Vite desde `COPERNICUS_CLIENT_ID` y `COPERNICUS_CLIENT_SECRET`; sin ellas, estado responde `configurado:false` y las estadísticas responden indisponibilidad controlada. No se usa prefijo `VITE_`.

### ESTADO TEMPORAL IMPORTANTE

La autenticación, el onboarding y los datos de establecimiento/lotes usan el
backend/PostgreSQL de Neon. No se consulta `localStorage` para esos datos.

### EN IMPLEMENTACIÓN / SIGUIENTE ETAPA

- persistencia backend de Copernicus/Open-Meteo;
- historial y notificaciones en UI;
- deploy y configuración final de CORS/cookies, manteniendo el mapa actual.

### PENDIENTE Y FUERA DE ALCANCE

Google OAuth, persistencia backend de Copernicus/Open-Meteo, notificaciones e historial en UI, deploy, CORS/cookies finales según deployment y Vercel (posible a futuro, no decidido). Ganado, GPS, jornadas, recomendaciones y ML siguen fuera de alcance.

## Backend actual

El backend vive en `backend/` y usa Node.js, TypeScript, Express y PostgreSQL
mediante `pg`. Para configurarlo, copiá `backend/.env.example` como
`backend/.env` y completá `DATABASE_URL` localmente; ese archivo no se debe
versionar.

```bash
cd backend
npm install
npm run db:migrate
npm run dev
```

El health check queda disponible en `http://localhost:3001/api/health` y no
expone la cadena de conexión. Para verificar tipos o generar el build:

```bash
npm run typecheck
npm run build
```

La migración inicial crea las siete tablas de dominio y sus índices básicos.
La autenticación y la conexión del frontend ya están implementadas. La
migración del establecimiento y los lotes desde `localStorage` hacia estas
APIs queda como siguiente etapa.

## Qué NO viene en esta copia (y cómo se recupera)

| Carpeta / archivo | Cómo vuelve |
|---|---|
| `node_modules/` | `npm install` |
| `certs/` | `npm run certs` |
| `dist/`, `.tsbuild/` | `npm run build` |
| `.env.local` | credenciales opcionales de Copernicus (nunca se commitea, ver `.gitignore`) |

## Sobre `npm run certs`

Si tu red hace inspección TLS (típico en redes corporativas), Node no confía en
la CA interna y toda llamada a Copernicus falla con `SELF_SIGNED_CERT_IN_CHAIN`.
`npm run certs` exporta el almacén de certificados de Windows a `certs/corp-ca.pem`,
que el plugin de Vite levanta solo. Es específico de cada máquina: hay que
correrlo de nuevo en cada PC.

En una red sin inspección TLS no hace falta.

## Principio rector: nunca inventar un dato

Esta es la regla de diseño más importante y aparece en varios lugares del
código (`api.ts`, `evalscript.ts`, `scoring.ts`): si no hay un dato real
disponible, se muestra "sin datos" — nunca un número fabricado para rellenar
un hueco visual. Ejemplos concretos:

- Si una pasada de Sentinel-2 salió `"NaN"` (nublada), se descarta la fecha
  entera en vez de mostrar un promedio parcial engañoso.
- El radar (Sentinel-1) nunca se combina/promedia con la óptica: son físicas
  distintas (reflectancia vs. backscatter) sin calibración cruzada real, así
  que se muestran por separado y rotulados.
- Los rangos de puntaje (`RANGOS` en `scoring.ts`) y las categorías de lluvia
  (`interpretacion.ts`) están marcados explícitamente como puntos de partida
  razonables, **no calibraciones agronómicas**. Si en algún momento hay datos
  reales para calibrar contra (cortes de forraje, registros de campo), hay
  que ajustar esas constantes contra esos datos — no antes.

Cualquier feature nueva debe seguir esta misma regla.

## Frontend autenticado

Al abrir el frontend se consulta `/api/auth/me` antes de renderizar el mapa.
Una sesión válida con onboarding completo ve la aplicación actual; una sesión
pendiente ve la pantalla temporal de configuración inicial; sin sesión se ve
login/registro. Las cookies se envían con `credentials: "include"`.

En desarrollo Vite proxye únicamente `/api/auth`, `/api/establecimiento`,
`/api/lotes` y `/api/health` hacia `localhost:3001`. `/api/copernicus` sigue
siendo atendido exclusivamente por su plugin actual. Google OAuth y el
onboarding visual completo quedan para etapas posteriores.

## Arquitectura

```
vite-plugin-copernicus.ts   proxy de Node para Sentinel Hub (Copernicus)
.env.local                  credenciales opcionales de CDSE (gitignored)
scripts/exportar-ca.mjs     exporta CAs de Windows para redes corporativas

src/
  types.ts, geo.ts, api/rodeo.ts  estado y persistencia API del establecimiento/lotes
  App.tsx                        raíz: estado, orquesta condición + clima
  components/
    MapView.tsx, MapEngine.tsx   mapa Leaflet, dibujo/edición de polígonos
    Sidebar.tsx                  navegación por pestañas
    CondicionPanel.tsx           ranking de condición satelital por lote
    TendenciaChart.tsx           gráfico SVG de NDVI/NDMI/EVI/NDWI históricos
    ClimaPanel.tsx               ranking de lluvia por lote
    PromptModal.tsx, ConfirmModal.tsx

  copernicus/
    api.ts        consulta óptica (S2) + radar (S1) en paralelo, por lote
    evalscript.ts EVALSCRIPT_INDICES (NDVI/NDMI/EVI/NDWI) y EVALSCRIPT_RADAR (RVI4S1)
    scoring.ts     puntaje 0–100, categorías, alertas — NO calibrado agronómicamente
    types.ts

  clima/
    api.ts             consulta Open-Meteo, un request para todos los lotes activos
    interpretacion.ts  categoriza la lluvia en una palabra — NO calibrado agronómicamente
    types.ts
```

Ningún archivo tiene JSDoc largo ni comentarios explicando "qué hace" el
código (los nombres ya lo dicen); los comentarios que hay explican el
**por qué** de una decisión no obvia. Vale la pena preservar ese estilo.

## Fuentes de datos: qué se usa y por qué

### Sentinel-2 + Sentinel-1 (Copernicus Data Space Ecosystem)

- **Sentinel-2 L2A** (óptico, 10–20 m, ~5 días de revisita): NDVI, NDMI, EVI,
  NDWI por píxel vía la Statistical API, enmascarando nubes/sombra con la
  banda SCL. Ventana de búsqueda de 45 días, exige ≥35% del lote despejado.
- **Sentinel-1 GRD** (radar banda C, ~6 días de revisita, no lo tapan las
  nubes): RVI4S1 como respaldo. Se consulta **siempre en paralelo** con la
  óptica (no sólo cuando la óptica está vieja) — medido contra la cuenta real
  del proyecto, las dos consultas combinadas salen ~0.2 PU por lote, contra
  una cuota gratuita de CDSE de 10.000 PU/mes y 300 PU/min. Sobra margen
  para no arriesgar el funcionamiento. Se usa **sólo** cuando resulta
  genuinamente más reciente que la óptica; nunca se mezcla en el mismo
  puntaje (ver "Principio rector").
- Autenticación: OAuth client-credentials contra CDSE, con el secret
  guardado del lado de Node (`vite-plugin-copernicus.ts`) — nunca llega al
  navegador. El endpoint de token no manda CORS, por eso hace falta el
  proxy (a diferencia de Open-Meteo, que sí tiene CORS).
- Cuenta gratuita, hace falta registrarse en https://dataspace.copernicus.eu.

### Open-Meteo (clima)

Elegido sobre OpenWeatherMap después de comparar ambos: sin API key, sin
cuenta, `access-control-allow-origin: *` confirmado en vivo (por eso el
front lo llama directo desde el navegador, sin pasar por el proxy de Node,
a diferencia de Copernicus). Mezcla de modelos regionales de alta
resolución (`best_match`).

Se pide **una sola petición HTTP para todos los lotes activos**: Open-Meteo
acepta listas de lat/lng separadas por coma y devuelve un arreglo en el
mismo orden. Se usa el centroide de cada lote, no el del establecimiento —
lotes cercanos entre sí suelen caer en la misma celda del modelo y salir con
el mismo número (es lo esperable, no un bug), pero en establecimientos
grandes los lotes más alejados sí pueden diferir, y eso ya se validó con
datos reales.

### Qué se evaluó y se descartó (para no re-investigarlo)

| Fuente | Por qué no |
|---|---|
| **OneSoil** | App gratuita sin API. La API que sí existe es B2B paga (a cotizar por hectárea) y devuelve una imagen renderizada, no estadísticas — habría que reprocesar píxeles a mano. Además usa sólo Sentinel-2, mismo dato que ya tenemos. |
| **MODIS** | Gratis y con API real (NASA AppEEARS), pero 250 m de resolución — un lote de 20–50 ha queda en 2–3 píxeles. El producto de vegetación "bueno" (MOD13Q1) tampoco es diario: compuesto de 16 días. |
| **Copernicus Global Land Service (NDVI 300m)** | Mismo problema de resolución que MODIS. |
| **NASA HLS / Landsat** | Daría más chances de una pasada óptica despejada (revisita ~2 días combinando Landsat+Sentinel-2), pero vive fuera de Copernicus: necesita cuenta de NASA Earthdata aparte (no se puede generar sin que el usuario la cree), y no tiene un endpoint tipo "mandá el polígono, recibí el promedio" — hay que leer tiles crudos (COG) y calcular estadística zonal a mano, con riesgo real de bug de proyección/CRS. Quedó evaluado pero **no implementado**; candidato a futuro si hace falta más frescura óptica. |
| **INTA (Índice Verde / Sistema de Información Clima y Agua)** | No es una API, es un visor web, y usa MODIS (mismo problema de resolución/frecuencia). Sirve como referencia manual para calibrar `RANGOS` contra la zona real, no como fuente en vivo. |
| **Modelo de Machine Learning** | Decisión explícita del equipo: no todavía. No hay datos etiquetados (cortes de forraje reales, condición observada a campo) para entrenar nada — sin eso, un modelo sería una caja negra con los mismos supuestos no calibrados que ya tiene `RANGOS`, pero menos auditable. Se retoma si en algún momento se empieza a loguear condición real observada por lote. |

## Roadmap y bloqueos (contexto de equipo)

Este es un proyecto grupal; estos puntos están explícitamente pausados, no
olvidados:

1. **Ganado en el modelo** (cabezas, categoría, peso) — pausado hasta que el
   grupo consiga y configure el **dispositivo GPS**. Es el cambio de mayor
   impacto: hoy la app dice "este lote está bien", no "entran tantos
   animales por tantos días".
2. **Historial de ocupación / rotación de pastoreo** — depende del punto 1.
   Más adelante se evalúa un modelo de ML para sugerir cuánto descansar cada
   lote (ver por qué el ML está pausado arriba).
3. **Persistencia real / multi-dispositivo** — establecimiento y lotes ya viven
   en PostgreSQL/Neon y se cargan por API autenticada. La persistencia histórica
   de satélite y clima todavía queda para etapas posteriores.
4. **Alertas / análisis programado** — considerado irrelevante hasta que
   exista la persistencia y autenticación del backend; la automatización de
   chequeos periódicos queda para una etapa posterior.

## Convenciones del proyecto

- Todo el código (variables, comentarios, texto de UI) está en **español**.
- Comentarios sólo cuando explican un **porqué** no obvio (un umbral, una
  decisión, una limitación de la API); nunca describiendo qué hace el código.
- Sin dependencias nuevas si se puede evitar: los gráficos (`TendenciaChart`,
  `ClimaPanel`) son SVG a mano, sin librería de charts.
- Paleta de colores de los gráficos: se siguió el skill de dataviz del
  workspace (paleta categórica validada contra daltonismo/contraste) para
  las 4 líneas de índices — no son colores elegidos a ojo.
- Este entorno de desarrollo **no tiene herramienta de automatización de
  navegador** (no hay Playwright/chromium-cli disponible). La validación de
  cada feature se hizo con `npx tsc --noEmit`, `npm run build`, y scripts
  Node/PowerShell puntuales que le pegan directo a las APIs reales
  (Copernicus, Open-Meteo) para confirmar que los datos que vuelven son
  reales y se parsean bien — no hay captura de pantalla real de la UI
  todavía. Si en algún momento se habilita esa herramienta, vale la pena
  revisar el detalle visual con calma.
## Autenticación y pruebas del backend

## Estado implementado: onboarding y datos del mapa

El onboarding visual ahora reutiliza el mapa existente en dos pasos: creación
del establecimiento y creación del primer lote. Cada operación se guarda en
PostgreSQL/Neon mediante APIs autenticadas; el backend asigna IDs y número de
lote.

El frontend autenticado carga `GET /api/establecimiento` y, si corresponde,
`GET /api/lotes` antes de montar la aplicación. Ya no usa `loadState()` ni
`saveState()` como fuente ni migra automáticamente datos viejos de
`localStorage`. Renombrar, activar/desactivar, borrar lotes y editar el
establecimiento esperan la respuesta del backend.

La eliminación de establecimientos está deshabilitada porque todavía no hay
una semántica backend segura para esa operación.

El backend actual usa `AUTH_JWT_SECRET` en `backend/.env`, JWT en cookie
HttpOnly `rodeo_session`, y APIs privadas de establecimiento y lotes. El
frontend ya está conectado a la autenticación; `localStorage` sólo continúa
temporalmente para los datos del mapa.

La guía de pruebas manuales está en [docs/INSOMNIA_TESTING.md](docs/INSOMNIA_TESTING.md).
