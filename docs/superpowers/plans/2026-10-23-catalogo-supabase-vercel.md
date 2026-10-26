# Catálogo HERCAS en Supabase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desplegar en Vercel un catálogo HERCAS que lee metadatos, fotos y fichas desde `hercas-platform-dev`, y después recuperar PowerPoint masivo y actualización semanal.

**Architecture:** Supabase A conserva Auth y las tablas existentes. Nuevas tablas `aliados_` guardan el inventario y el historial; buckets privados guardan binarios. Next.js consulta con sesión autorizada y redirige descargas a URLs temporales; un proceso separado realiza tareas Python pesadas.

**Tech Stack:** Next.js 15, React 19, `@supabase/ssr`, Supabase Postgres y Storage, Node.js, Python y `python-pptx`.

**Spec:** [2026-10-23-catalogo-supabase-vercel.md](../specs/2026-10-23-catalogo-supabase-vercel.md)

## Global Constraints

- Proyecto destino: `hercas-platform-dev`, ya confirmado por el usuario. No repetir la verificación de variables de Vercel.
- No cambiar `auth.users`, `user_roles`, `role_permissions`, `inventory_assets`, `availability_entries` ni sus filas.
- Conservar los 549 códigos y estados originales. Los 41 duplicados confirmados quedan en la base y fuera de la vista normal.
- Los buckets son privados. No poner fotos, fichas, claves ni el manifiesto en `public/`.
- Una carga semanal no debe declarar disponible una valla por el solo hecho de tener foto y ficha.
- No hacer `commit`, `push` ni cambiar ramas sin instrucción explícita del usuario.

## Review Focus

- Código duplicado o ausente en el manifiesto: el importador debe reportarlo y detener la publicación parcial del lote (tarea 2).
- Foto o PPTX faltante: el registro queda visible como incompleto y no ofrece un enlace roto (tareas 2 y 3).
- Usuario autenticado sin permiso: recibe 403 y no obtiene URL temporal (tareas 1 y 3).
- Subida interrumpida: el proceso reanuda por archivo sin crear objetos o filas duplicados (tarea 2).
- Disponibilidad vencida o ambigua: se muestra «Por confirmar» y se conserva la fuente/historial (tarea 5).

---

## Etapa 1: Esquema aislado y Storage privado

### Tarea 1: Migración, RLS y contratos de datos

**Files:**
- Create: `supabase/migrations/<timestamp>_aliados_catalogo.sql` mediante `supabase migration new aliados_catalogo`.
- Create: `tests/catalog-schema.test.mjs` para comprobar los nombres, claves y políticas del SQL generado.
- Modify: `.env.example` para documentar solo nombres de variables adicionales si son necesarios.

**Interfaces:** `aliados_vallas.codigo` identifica cada valla; `aliados_valla_archivos` referencia código, tipo (`foto`, `vista`, `ficha`), ruta, tamaño, checksum y versión; `aliados_catalogos` y `aliados_importacion_filas` describen lotes; `aliados_disponibilidad_eventos` registra cambios por código y fecha. Los buckets privados `aliados-vallas` y `aliados-catalogos` guardan los objetos.

- [ ] Escribir prueba que detecte ausencia de las cinco tablas, claves, índices por código/ciudad/proveedor, RLS, grants explícitos y buckets privados.
- [ ] Confirmar que falla antes de crear la migración.
- [ ] Crear la migración aditiva con políticas basadas en `cotizador.availability.read`/`manage`, sin modificar tablas actuales.
- [ ] Ejecutar la prueba; inspeccionar diff y advisors; probar acceso permitido y denegado con usuarios de prueba.
- [ ] Aplicar al proyecto A solo después de revisar el resultado de la migración y la capacidad de Storage.

**Salida verificable:** tablas vacías y buckets privados; login e inventario web existentes intactos.

## Etapa 2: Carga inicial de metadatos y archivos

### Tarea 2: Importador repetible de 549 registros

**Files:**
- Create: `scripts/prepare_catalog_migration.mjs` (`prepareCatalogMigration(manifestPath)` -> `{rows, assets, warnings}`).
- Create: `scripts/upload_catalog_initial.mjs` (subida por lote, avance local y reintentos por objeto).
- Create: `tests/catalog-migration.test.mjs` con manifiesto pequeño y rutas temporales.

- [ ] Probar 549 códigos únicos, estados conservados, conteos 467/41/41 y presencia de 468 juegos de foto+ficha; rechazar colisiones y rutas fuera de la carpeta de datos.
- [ ] Confirmar el fallo inicial de la prueba.
- [ ] Implementar preparación sin escribir a Supabase; generar reporte de tamaños, rutas Storage y casos incompletos.
- [ ] Implementar carga por objetos con registro de progreso, reintentos y verificación por tamaño/checksum. Guardar una ruta versionada por código y tipo. Usar S3 multipart o TUS para archivos grandes; no enrutar binarios por Vercel.
- [ ] Cargar primero una muestra de Cali, Barranquilla, Medellín y Bogotá, comprobar fotos y precios editables, luego completar el lote.
- [ ] Comparar conteos locales/remotos; registrar discrepancias sin marcarlas como completas.

**Salida verificable:** 549 filas, 468 fotos y fichas utilizables, 40 registros incompletos y 41 duplicados documentados.

## Etapa 3: Primer redepliegue con información y catálogo

### Tarea 3: Lectura de Supabase y enlaces privados

**Files:**
- Create: `lib/catalog-supabase.js` (`catalogFromSupabase(client)` -> `{records, pendingNew}`).
- Modify: `app/page.jsx`, `app/api/catalog/route.js`, `app/api/asset/[code]/[kind]/route.js`, `app/ui/CatalogClient.jsx`.
- Test: `tests/catalog-cloud.test.mjs` con cliente Supabase simulado y comprobación de permisos.

- [ ] Probar que el catálogo convierte filas remotas al contrato actual de `CatalogClient`, conserva filtros/estados y no devuelve objetos privados a usuarios sin permiso.
- [ ] Confirmar el fallo inicial.
- [ ] Implementar lectura paginada de los 549 registros y obtención de URLs temporales solo bajo sesión autorizada. La ruta de asset redirige a Storage; no envía PPTX a través del cuerpo de una función Vercel.
- [ ] Probar 508 visibles, 468 con archivos, 40 incompletos, búsqueda/filtros/mapa y ficha individual. Identificar en la interfaz que la composición masiva queda pendiente hasta la etapa 4, sin enviar solicitudes a la ruta Python local.
- [ ] Crear despliegue de vista previa en Vercel, abrirlo con usuario autorizado y otro sin permiso, validar imágenes y descargar una ficha; promoverlo a producción.

**Salida verificable:** el usuario puede entrar a Vercel y ver información real, fotos y fichas individuales sin depender del disco `D:`. La descarga masiva aún no se anuncia como operativa.

## Etapa 4: Selección y PowerPoint masivo

### Tarea 4: Generador de propuestas en proceso de fondo

**Files:**
- Modify: `app/api/proposal/route.js` para crear una solicitud de trabajo y entregar el resultado desde Storage.
- Create: `scripts/proposal_worker.py` o adaptar `scripts/make_proposal.py` para usar rutas Storage descargadas temporalmente.
- Test: `tests/proposal-cloud.test.mjs` y prueba de PPTX con dos ciudades.

- [ ] Probar selección individual/filtrada y orden por ciudad; comprobar portada, separador de cada ciudad, ausencia de «SIMULACIÓN DE PAUTA HERCAS» y precio editable.
- [ ] Confirmar el fallo inicial.
- [ ] Ejecutar Python fuera de la función que responde al navegador; subir el PPTX generado a Storage privado y devolver una URL temporal.
- [ ] Probar lotes pequeños y grandes, tiempos, tamaño, errores y reintento; habilitar la descarga masiva en Vercel.

**Salida verificable:** PowerPoint compuesto descargable para varias ciudades sin límite de respuesta de Vercel.

## Etapa 5: Actualización semanal de aliados

### Tarea 5: Carga, revisión y vigencia

**Files:**
- Modify: `app/api/import/route.js`, `app/api/import/apply/route.js`, `app/ui/CatalogClient.jsx`.
- Adapt: `scripts/scan_catalog.py` para procesar un objeto de Storage en el worker.
- Test: `tests/catalog-import-cloud.test.mjs` y `tests/test_scan_catalog.py`.

- [ ] Probar carga directa de PPTX/PDF/XLSX/CSV a Storage, coincidencia segura, caso ambiguo y nueva valla pendiente.
- [ ] Confirmar el fallo inicial.
- [ ] Guardar archivo original y filas leídas; aplicar únicamente coincidencias aprobadas; agregar evento de disponibilidad con fuente y fecha.
- [ ] Probar vencimiento a ocho días, lista completa parcial y reversión de una importación incorrecta.
- [ ] Verificar una actualización semanal real de un proveedor en Vercel.

**Salida verificable:** disponibilidad central y vigente sin sobrescribir evidencia ni inventar fotos/fichas nuevas.

## Verificación final

- Ejecutar `node --test tests/*.test.mjs`, pruebas Python y `pnpm build`.
- Revisar los conteos remotos contra `avance.json` y comprobar códigos en una muestra de cada proveedor/ciudad.
- Descargar una ficha individual y una presentación de varias ciudades; comprobar que los precios siguen editables.
- Mantener la carpeta local como respaldo hasta completar la comparación de datos y archivos.
