-- Una importación puede reintentarse sin duplicar eventos de una valla.
alter table public.aliados_disponibilidad_eventos
  add constraint aliados_disponibilidad_eventos_catalogo_codigo_key unique (catalogo_id, codigo);

update storage.buckets set file_size_limit = 209715200
where id = 'aliados-catalogos';
