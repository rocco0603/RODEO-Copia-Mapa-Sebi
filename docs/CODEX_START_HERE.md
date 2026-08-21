# Codex — empezar acá

Este archivo no reemplaza `AGENTS.md`: primero leer `AGENTS.md` y toda la documentación indicada allí.

## Contexto

El frontend actual funciona y no debe reescribirse. La tarea es agregar backend y persistencia real de manera incremental.

## Estado frontend actual

El gateway de Copernicus ya vive en Express y Vite sÃ³lo lo proxifica. Las
credenciales se configuran manualmente en `backend/.env`; el frontend no las
lee.

El onboarding visual, la persistencia de establecimiento/lotes y la ficha
completa `/lotes/:id` ya están implementados. Mantener el mapa y no reintroducir
`localStorage` como fuente de verdad.

## Estado de integraciones externas

Copernicus y Open-Meteo se consumen mediante Express; Vite sÃ³lo proxifica sus
endpoints. Open-Meteo no requiere API key y el frontend conserva fachadas
compatibles para el mapa y la ficha.

## Primera tarea recomendada

## Estado vigente del repositorio

Las instrucciones de esta sección son el contexto histórico de bootstrap. La
primera tarea ya fue completada y también se implementaron autenticación,
sesión persistente, APIs privadas de establecimiento/lotes y la integración de
auth en el frontend. La siguiente etapa es el onboarding visual real y la
migración gradual de establecimiento/lotes desde `localStorage` hacia Neon.

Implementar únicamente la base técnica del backend y el esquema PostgreSQL. No tocar todavía Copernicus, Open-Meteo ni la lógica del mapa salvo que sea necesario para compilar.

### Entregables de la primera tarea

1. Crear carpeta `backend/` con proyecto Node.js + TypeScript.
2. Agregar servidor HTTP sencillo con Express.
3. Agregar `GET /api/health` que responda JSON.
4. Preparar conexión a PostgreSQL mediante variable `DATABASE_URL`.
5. Crear `.env.example` sin secretos reales.
6. Crear mecanismo de schema/migraciones versionado en el repo.
7. Implementar las tablas de `docs/DATABASE_MODEL.md`.
8. Agregar índices y constraints básicos.
9. No conectar todavía Neon directamente si no existe `DATABASE_URL` real; el SQL debe estar listo para ejecutarse cuando se conecte.
10. Agregar comandos claros para:
   - instalar dependencias;
   - iniciar backend en desarrollo;
   - aplicar schema/migraciones;
   - ejecutar checks de TypeScript.
11. Actualizar README/documentación con esos comandos.

## Reglas de implementación

- No usar SQLite como sustituto: el objetivo es PostgreSQL.
- No hardcodear credenciales.
- No crear datos simulados permanentes en tablas productivas.
- No agregar animales/GPS.
- No agregar ML.
- No agregar roles.
- No borrar `localStorage` todavía; esa migración viene después.
- No modificar el mapa actual en esta primera tarea.
- Mantener nombres y comentarios en español cuando sea razonable.

## Esquema esperado

Tablas:

```text
usuarios
establecimientos
lotes
mediciones_satelitales
consultas_clima
dias_clima
notificaciones
```

Leer `docs/DATABASE_MODEL.md` antes de escribir SQL.

## Después de esta primera tarea

No continuar automáticamente con auth sin revisar el resultado. La siguiente fase será:

- registro/login;
- sesión;
- onboarding;
- endpoints de establecimiento/lotes;
- migración de persistencia desde localStorage.

## Validación

Al terminar informar:

- archivos creados/modificados;
- decisiones técnicas tomadas y por qué;
- comandos ejecutados;
- resultado de build/typecheck;
- cualquier desviación de la documentación;
- preguntas que requieran decisión del equipo.
