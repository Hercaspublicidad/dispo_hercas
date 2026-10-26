# Catálogo HERCAS en Supabase A y Vercel

## Objetivo

Usar `hercas-platform-dev` como fuente central para que el despliegue de Vercel muestre el inventario de vallas, fotos y fichas desde cualquier computador. Se conserva el login y los permisos actuales.

## Estado actual

- `lib/catalog.js` lee `avance.json`, disponibilidad y archivos de `D:\Aliados exteriores\Fichas_HERCAS_2026`. Vercel no tiene esa ruta.
- El manifiesto contiene 549 registros: 467 completos, 41 en revisión de fuente y 41 duplicados confirmados. En la vista se muestran 508 no duplicados; 468 tienen foto HERCAS y PowerPoint, y 40 carecen de alguno de esos archivos.
- El proyecto Supabase A contiene tablas de la web (`inventory_assets`, `availability_entries`, `user_roles`, `role_permissions`, entre otras); no tiene buckets de Storage. Esas tablas y sus filas no se reemplazan.
- Las fotos, vistas previas y fichas locales suman aproximadamente 3,8 GB.
- La aplicación local genera presentaciones e interpreta catálogos con Python en una ruta de Windows. Esos procesos requieren una solución aparte en la nube.

## Diseño aprobado por la conversación

- Un solo proyecto: `hercas-platform-dev`. El usuario ya verificó las variables de Vercel; no se repite esa comprobación.
- Cinco tablas nuevas con prefijo `aliados_`: `aliados_vallas`, `aliados_valla_archivos`, `aliados_catalogos`, `aliados_importacion_filas` y `aliados_disponibilidad_eventos`.
- Dos buckets privados: `aliados-vallas` y `aliados-catalogos`. En Postgres se guardan rutas y metadatos; los binarios viven en Storage.
- Se conservan los códigos proveedor-ciudad-consecutivo y los estados de revisión/duplicado. No se cambian carpetas ni códigos por una discrepancia no confirmada.
- Lectura autorizada por `cotizador.availability.read` o `cotizador.availability.manage`; escritura solo por `cotizador.availability.manage`. Políticas RLS y grants explícitos para tablas y Storage.
- Ningún archivo privado se publica en `public/` de Next.js. La app entrega enlaces temporales de Storage después de comprobar la sesión.

## Entregas por etapas

1. **Esquema y seguridad:** migración revisada, tablas y buckets privados; login y datos existentes intactos.
2. **Carga inicial:** 549 filas y archivos disponibles subidos con control de reintentos, tamaños y códigos; sin publicar registros incompletos como completos.
3. **Catálogo en Vercel:** buscador, filtros, mapa, fotos, estados y descarga de ficha individual. Primer despliegue de Vercel en que el usuario puede ver información y catálogo reales.
4. **PowerPoint masivo:** selección y presentación con portada, separadores por ciudad, fotos y precios editables. La generación y entrega de archivos grandes evita el límite de respuesta de Vercel.
5. **Actualización semanal:** carga directa de catálogos a Storage, extracción, revisión de coincidencias, historial y cambio de disponibilidad.

## Criterios para el primer despliegue útil

- Una sesión autorizada ve 508 vallas no duplicadas; 468 muestran foto y ficha; 40 permanecen identificadas como incompletas. Los 41 duplicados confirmados quedan conservados en la base, fuera de la vista normal.
- Cali, Barranquilla y las demás ciudades aparecen en los filtros y el mapa según sus datos; las referencias de ciudad no se presentan como coordenadas exactas.
- La foto y la ficha individual se abren desde Storage privado sin depender de `D:\` ni de un servidor local.
- Una sesión sin permiso no lee los datos ni recibe enlaces de archivos.
- La aplicación local y las tablas existentes de la web continúan funcionando durante el cambio.

## Límites y liberación

- No se publicará como operativa una descarga masiva hasta completar la etapa 4; el primer despliegue útil es de consulta y ficha individual.
- Las disponibilidades vencidas siguen como «Por confirmar»; una foto y ficha no equivalen a cupo confirmado.
- El despliegue se prueba antes de promoverse a producción. Una reversión de la app no elimina las nuevas tablas ni objetos; el inventario local sigue como respaldo.
- Los límites y uso de Storage del plan de Supabase se revisan antes de transferir 3,8 GB.
