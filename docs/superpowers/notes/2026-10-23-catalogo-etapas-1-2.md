# Avance de las etapas 1 y 2

## Esquema aplicado

- Proyecto: `hercas-platform-dev` (`mmstapaovlvflbiiqgxv`).
- Migración `aliados_catalogo` aplicada el 23 de octubre de 2026.
- Cinco tablas `aliados_` con RLS y dos buckets privados verificados.
- Consulta simulada con usuario autorizado: 549 filas visibles. Usuario sin permisos: 0 filas.
- El asesor de seguridad no reportó hallazgos nuevos de estas tablas; los avisos corresponden a funciones y configuración preexistentes.

## Datos importados

- 549 códigos únicos cargados en `aliados_vallas`.
- Estados remotos: 467 `completo`, 41 `revision_fuente`, 41 `duplicado_confirmado`.
- 508 registros no duplicados.
- Preparación local: 468 fotos, 468 vistas y 468 fichas; 1.404 archivos y 4.071.007.917 bytes; 0 rutas faltantes.
- Archivo de preparación: `D:\Aliados exteriores\Fichas_HERCAS_2026\_migracion_supabase\preparado.json`.
- Sin archivos subidos aún; `aliados_valla_archivos` tiene 0 filas.

## Límite para cerrar etapa 2

La organización está en plan Free, con 1 GB de Storage para toda la organización. El material local ocupa aproximadamente 4,07 GB. Se solicitó elegir entre ampliar el plan de Supabase o almacenar los archivos en otro servicio. La transferencia completa empezará cuando esté decidida y habilitada la capacidad. El importador local requiere una clave de servicio guardada en `.env.upload.local` sin prefijo `NEXT_PUBLIC_`; nunca se debe pegar la clave en un archivo del repositorio.

## Verificación local

`node --test tests/catalog-migration.test.mjs tests/catalog-schema.test.mjs`: 3/3 pruebas aprobadas.
