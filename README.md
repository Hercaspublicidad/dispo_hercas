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

## Verificación

`node --test tests/*.test.mjs` y `npm run build`. La compilación de producción se guarda en `.next`, como espera Vercel; el desarrollo usa `.next-dev`. El importador inicial reanudable es `node scripts/upload_catalog_initial.mjs --upload "D:\Aliados exteriores\Fichas_HERCAS_2026\_migracion_supabase\preparado.json"`; registra el avance en `subida_avance.json`. Al finalizar, `node scripts/verify_catalog_cloud.mjs` comprueba códigos, tipos de archivo y tamaños registrados.
