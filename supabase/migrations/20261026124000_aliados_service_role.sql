-- La clave secreta usa service_role; RLS se omite, pero necesita privilegios SQL.
grant select, insert, update, delete on public.aliados_vallas to service_role;
grant select, insert, update, delete on public.aliados_valla_archivos to service_role;
grant select, insert, update, delete on public.aliados_catalogos to service_role;
grant select, insert, update, delete on public.aliados_importacion_filas to service_role;
grant select, insert, update, delete on public.aliados_disponibilidad_eventos to service_role;
