# Catálogo HERCAS

Aplicación Next.js para consultar las 549 vallas de aliados desde el proyecto Supabase `hercas-platform-dev`. La misma instancia autentica usuarios y guarda el catálogo en tablas `aliados_` y buckets privados. Las tablas de la web principal no se modifican.

## Acceso y despliegue

Copiar `.env.example` a `.env.local` para desarrollo. Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en los tres entornos de Vercel. Configurar `SUPABASE_SECRET_KEY` **solo como variable de servidor** en Vercel para guardar las propuestas compuestas. Nunca poner esta clave en una variable `NEXT_PUBLIC_` ni en Git. `npm run build` verifica la compilación y `npm run dev` sirve la app local.

Los usuarios con `cotizador.availability.read` pueden consultar el catálogo y componer propuestas. El permiso `cotizador.availability.manage` permite subir y aplicar disponibilidades semanales. Fotos, fichas y catálogos permanecen en Storage privado. La API entrega enlaces temporales después de validar la sesión.

## Consulta y propuestas

Buscar por código, ciudad, dirección, proveedor o formato. Filtrar por disponibilidad y seleccionar una valla o todas las visibles después de filtrar. La selección exige foto HERCAS y ficha editable; la disponibilidad puede estar «Por confirmar», por lo que debe consultarse al aliado antes de contratar. El mapa agrupa por ciudad las vallas sin coordenadas verificadas.

La descarga masiva crea un PowerPoint con portada «Vallas disponibles», un separador con fotografía urbana por cada ciudad seleccionada y una diapositiva por valla. Los precios son texto editable. El archivo se guarda en `aliados-catalogos/propuestas/` y se descarga mediante URL temporal.

## Actualización semanal

Quien tenga permiso de gestión selecciona aliado y archivo PPTX, PDF, XLSX o CSV. El navegador carga el archivo directamente al bucket privado; los archivos mayores de 6 MB usan carga reanudable. El servidor compara códigos y ubicación con las vallas de ese aliado. La interfaz muestra coincidencias únicas y casos para revisar. Solo al pulsar «Aplicar coincidencias seguras» se generan eventos históricos en `aliados_disponibilidad_eventos`. Una disponibilidad con más de ocho días se muestra «Por confirmar». Una lista completa solo pone las ausentes «Por confirmar» si al menos tres coincidencias son seguras y cubren 80 % de las entradas identificadas. Las vallas nuevas quedan en `aliados_importacion_filas` hasta verificar foto y ubicación; no se fabrican fichas automáticamente.

Los PPTX o PDF formados solo por imágenes requieren OCR o revisión manual. Se conserva el original en Storage y el archivo local `D:\Aliados exteriores\Fichas_HERCAS_2026` como respaldo de la migración.

## Administración de vallas

El panel `/admin` está reservado al rol activo `systems_admin` (Administrador de plataforma). Permite crear, buscar, editar, eliminar del catálogo y restaurar vallas. Las operaciones se protegen en middleware, página, API y función SQL. No basta con tener permiso de gestión de disponibilidad.

Aplicar `supabase/migrations/20261029160000_aliados_admin_crud.sql` antes de usar el guardado. La función solo es ejecutable por `service_role`, comprueba el rol del usuario y guarda metadatos y registro de foto en una transacción con control de edición concurrente. Requiere la variable de servidor `SUPABASE_SECRET_KEY` ya usada por las propuestas. No requiere cambios en roles ni permisos existentes.

El formulario acepta JPG, PNG y WebP de hasta 4 MB y 40 megapíxeles. El servidor verifica la imagen, corrige orientación, limita dimensiones a 2400 × 1800 y guarda WebP con calidad 85 en el bucket privado. Los PNG existentes se conservan hasta reemplazarlos. Se conserva la procedencia del registro y sus archivos anteriores. Eliminar significa archivar; el código permanece reservado y se puede restaurar desde el panel.

Tras editar una valla, su ficha individual se genera con los datos y la foto actuales, utilizando el mismo diseño que la propuesta masiva. Los PowerPoint descargados anteriormente conservan su contenido. La disponibilidad continúa gestionándose con los archivos semanales. La importación masiva de metadatos o ZIP de fotos todavía no está incluida.

Pruebas: `node --test --test-isolation=none tests/*.test.mjs`. Las comprobaciones de base de datos están en `tests/valla-admin-transaction.sql`; se ejecutan en una transacción que termina con `rollback`.

## Verificación del catálogo

`node --test tests/*.test.mjs` y `npm run build`. La compilación de producción se guarda en `.next`, como espera Vercel; el desarrollo usa `.next-dev`. El importador inicial reanudable es `node scripts/upload_catalog_initial.mjs --upload "D:\Aliados exteriores\Fichas_HERCAS_2026\_migracion_supabase\preparado.json"`; registra el avance en `subida_avance.json`. Al finalizar, `node scripts/verify_catalog_cloud.mjs` comprueba códigos, tipos de archivo y tamaños registrados.

## Fichas al descargar y precios opcionales

Todas las vallas con foto generan su ficha individual al descargar usando el diseño HERCAS actual. El catálogo y las propuestas ya no requieren un PowerPoint guardado por valla. Las fichas y propuestas se generan sin precio de forma predeterminada. Cualquier usuario con acceso al catálogo puede marcar «Incluir precios en las fichas y presentaciones»; no requiere un rol administrativo. La API masiva recibe `includePrices: true`; la individual acepta `?includePrices=true`. Sin esa selección se omiten tarifa y condiciones comerciales para que estas no introduzcan precios en la descarga. El precio continúa visible en la consulta del catálogo y en administración.

El buscador del catálogo y el de administración incluyen el código del aliado (`datos_fuente.codigo_proveedor`), además del código HERCAS, ubicación, ciudad, proveedor y formato.

Después de desplegar esta versión, el administrador puede abrir «PowerPoint antiguos», revisar el listado y eliminar las fichas individuales de Supabase. La limpieza solo considera archivos `.pptx` bajo `<codigo>/ficha/` del bucket `aliados-vallas` con una foto registrada. Conserva fotos, vistas, propuestas y fichas sin foto o con rutas distintas. Elimina mediante la API de Storage y después borra las referencias confirmadas; no requiere una migración SQL. No ejecutar la limpieza desde una versión anterior del sitio.

Para obtener un inventario sin modificar Supabase: `node --env-file=.env.local scripts/inspect_legacy_fiches.mjs`. El listado se guarda fuera de Git en `_trabajo_fondos/limpieza_fichas/inventario.json`. La carga de una plantilla personalizada desde administración queda pendiente.
