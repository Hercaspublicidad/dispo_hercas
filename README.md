# Catálogo HERCAS (local)

Aplicación Next.js para consultar las vallas producidas en D:\Aliados exteriores\Fichas_HERCAS_2026.

## Abrir
Ejecutar Iniciar_catalogo_HERCAS.cmd y abrir http://127.0.0.1:3000.
La ventana del servidor debe permanecer abierta. Las fotos y fichas se leen localmente.

## Acceso
El catálogo usa el mismo proyecto de Supabase que la página principal de Hercas. Se ingresa con la misma cuenta y contraseña, si el usuario tiene un rol activo con `cotizador.availability.read` o `cotizador.availability.manage`, los permisos que usa la web para consultar disponibilidad. La pantalla `/login` utiliza el mismo diseño de la web; recuperación de contraseña y activación de invitaciones se abren en hercaspublicidad.com. El botón «Cerrar sesión» termina la sesión local del catálogo.

La URL y la clave publicable de Supabase están en `.env.local`. Este archivo no debe compartirse con el código fuente; `.env.example` documenta los nombres requeridos. Al instalar en otro computador, se necesitan el mismo `.env.local` y acceso a los archivos del inventario. Todas las rutas del catálogo y sus API requieren sesión válida.

## Buscar
- Buscar por código, dirección, ciudad, proveedor o formato.
- Filtrar por ciudad y aliado.
- Abrir la foto HERCAS y descargar la ficha PowerPoint con precio editable.
- El mapa solo coloca puntos con coordenadas válidas; las demás vallas se encuentran por ciudad y dirección.
- Una disponibilidad con fuente de más de 14 días aparece «Por confirmar».

## Actualizar disponibilidades
1. Abrir «Actualizar catálogo».
2. Elegir aliado y cargar XLSX, CSV, PPTX o PDF con texto seleccionable.
3. Revisar coincidencias. Solo se aplican cambios explícitos con coincidencia única y alta confianza.
4. Pulsar «Aplicar coincidencias seguras». Los casos dudosos quedan en catalogo_nuevas_pendientes.json.
5. El archivo original se conserva en _catalogos_entrantes.

No se borra una valla por ausencia en un catálogo semanal. Los PPTX o PDF hechos solo de imágenes requieren OCR o revisión manual.

## Fuente y almacenamiento
- Inventario base: avance.json (549 registros).
- Cambios de disponibilidad: catalogo_disponibilidad.json.
- Archivos y análisis: _catalogos_entrantes.
- Nuevas vallas o coincidencias dudosas: catalogo_nuevas_pendientes.json.

Las fotos HERCAS y fichas de vallas nuevas requieren confirmar la foto fuente, ubicación y creatividad. No se publican como terminadas automáticamente.

## Presentación con varias vallas

En «Explorar vallas», marca las fichas que quieres incluir. El botón «Seleccionar resultados» añade todas las fichas completas que cumplen los filtros visibles de ciudad, aliado y búsqueda. Pulsa «Descargar PowerPoint».

La presentación resultante contiene:
1. Portada «Vallas disponibles».
2. Una separación con el nombre de cada ciudad.
3. Las fichas de esa ciudad, con el precio editable.

Si seleccionas varias ciudades, se agrupan alfabéticamente y cada grupo comienza con su ciudad. La disponibilidad debe confirmarse antes de ofrecer; el inventario histórico no equivale a cupo vigente.

## Acceso desde otros computadores

Los datos y archivos siguen en este computador. La versión actual escucha solo en 127.0.0.1 y por eso aún no admite conexiones de los otros dos equipos. Se necesita definir si estarán en la misma red o en otras sedes y configurar acceso privado antes de habilitarlo.
