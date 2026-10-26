-- Catálogo de aliados: independiente del inventario de la web existente.
create table public.aliados_vallas (
  codigo text primary key,
  proveedor text not null,
  ciudad text not null,
  ubicacion text,
  categoria text,
  formato text,
  medidas text,
  latitud numeric,
  longitud numeric,
  tarifa_mensual_cop numeric,
  estado text not null check (estado in ('completo','revision_fuente','duplicado_confirmado')),
  duplicado_de text,
  fuente_local_id text,
  datos_fuente jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index aliados_vallas_ciudad_proveedor_idx on public.aliados_vallas (ciudad, proveedor);
create index aliados_vallas_estado_idx on public.aliados_vallas (estado);

create table public.aliados_valla_archivos (
  codigo text not null references public.aliados_vallas(codigo),
  tipo text not null check (tipo in ('foto','vista','ficha')),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bucket text not null default 'aliados-vallas' check (bucket = 'aliados-vallas'),
  ruta text not null unique,
  tamano_bytes bigint not null check (tamano_bytes > 0),
  mime text not null,
  nombre_original text,
  subido_en timestamptz not null default now(),
  primary key (codigo, tipo, sha256)
);
create index aliados_valla_archivos_codigo_tipo_idx on public.aliados_valla_archivos (codigo, tipo);

create table public.aliados_catalogos (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null,
  nombre_original text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  ruta text unique,
  estado text not null default 'recibido' check (estado in ('recibido','procesando','revisar','aplicado','error')),
  recibido_en timestamptz not null default now(),
  procesado_en timestamptz,
  notas text,
  unique (proveedor, sha256)
);

create table public.aliados_importacion_filas (
  id uuid primary key default gen_random_uuid(),
  catalogo_id uuid not null references public.aliados_catalogos(id),
  numero_fila integer not null check (numero_fila > 0),
  codigo_propuesto text references public.aliados_vallas(codigo),
  datos_fuente jsonb not null default '{}'::jsonb,
  resultado text not null default 'pendiente' check (resultado in ('pendiente','coincide','ambiguo','nuevo','aplicado','ignorado')),
  observacion text,
  unique (catalogo_id, numero_fila)
);
create index aliados_importacion_filas_codigo_idx on public.aliados_importacion_filas (codigo_propuesto);

create table public.aliados_disponibilidad_eventos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null references public.aliados_vallas(codigo),
  catalogo_id uuid references public.aliados_catalogos(id),
  disponibilidad text not null,
  fecha_fuente date,
  observado_en timestamptz not null default now(),
  fuente text,
  notas text
);
create index aliados_disponibilidad_codigo_fecha_idx on public.aliados_disponibilidad_eventos (codigo, observado_en desc);

alter table public.aliados_vallas enable row level security;
alter table public.aliados_valla_archivos enable row level security;
alter table public.aliados_catalogos enable row level security;
alter table public.aliados_importacion_filas enable row level security;
alter table public.aliados_disponibilidad_eventos enable row level security;

grant select on public.aliados_vallas to authenticated;
grant select on public.aliados_valla_archivos to authenticated;
grant select on public.aliados_catalogos to authenticated;
grant select on public.aliados_importacion_filas to authenticated;
grant select on public.aliados_disponibilidad_eventos to authenticated;
grant insert, update, delete on public.aliados_vallas, public.aliados_valla_archivos,
  public.aliados_catalogos, public.aliados_importacion_filas,
  public.aliados_disponibilidad_eventos to authenticated;

create policy aliados_vallas_read on public.aliados_vallas for select to authenticated
  using (private.has_permission('cotizador.availability.read') or private.has_permission('cotizador.availability.manage'));
create policy aliados_vallas_insert on public.aliados_vallas for insert to authenticated
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_vallas_update on public.aliados_vallas for update to authenticated
  using (private.has_permission('cotizador.availability.manage'))
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_vallas_delete on public.aliados_vallas for delete to authenticated
  using (private.has_permission('cotizador.availability.manage'));

create policy aliados_valla_archivos_read on public.aliados_valla_archivos for select to authenticated
  using (private.has_permission('cotizador.availability.read') or private.has_permission('cotizador.availability.manage'));
create policy aliados_valla_archivos_insert on public.aliados_valla_archivos for insert to authenticated
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_valla_archivos_update on public.aliados_valla_archivos for update to authenticated
  using (private.has_permission('cotizador.availability.manage'))
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_valla_archivos_delete on public.aliados_valla_archivos for delete to authenticated
  using (private.has_permission('cotizador.availability.manage'));

create policy aliados_catalogos_read on public.aliados_catalogos for select to authenticated
  using (private.has_permission('cotizador.availability.read') or private.has_permission('cotizador.availability.manage'));
create policy aliados_catalogos_insert on public.aliados_catalogos for insert to authenticated
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_catalogos_update on public.aliados_catalogos for update to authenticated
  using (private.has_permission('cotizador.availability.manage'))
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_catalogos_delete on public.aliados_catalogos for delete to authenticated
  using (private.has_permission('cotizador.availability.manage'));

create policy aliados_importacion_filas_read on public.aliados_importacion_filas for select to authenticated
  using (private.has_permission('cotizador.availability.read') or private.has_permission('cotizador.availability.manage'));
create policy aliados_importacion_filas_insert on public.aliados_importacion_filas for insert to authenticated
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_importacion_filas_update on public.aliados_importacion_filas for update to authenticated
  using (private.has_permission('cotizador.availability.manage'))
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_importacion_filas_delete on public.aliados_importacion_filas for delete to authenticated
  using (private.has_permission('cotizador.availability.manage'));

create policy aliados_disponibilidad_eventos_read on public.aliados_disponibilidad_eventos for select to authenticated
  using (private.has_permission('cotizador.availability.read') or private.has_permission('cotizador.availability.manage'));
create policy aliados_disponibilidad_eventos_insert on public.aliados_disponibilidad_eventos for insert to authenticated
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_disponibilidad_eventos_update on public.aliados_disponibilidad_eventos for update to authenticated
  using (private.has_permission('cotizador.availability.manage'))
  with check (private.has_permission('cotizador.availability.manage'));
create policy aliados_disponibilidad_eventos_delete on public.aliados_disponibilidad_eventos for delete to authenticated
  using (private.has_permission('cotizador.availability.manage'));

insert into storage.buckets (id, name, public)
values ('aliados-vallas','aliados-vallas',false), ('aliados-catalogos','aliados-catalogos',false);

create policy aliados_vallas_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'aliados-vallas' and
    (private.has_permission('cotizador.availability.read') or private.has_permission('cotizador.availability.manage')));
create policy aliados_vallas_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'aliados-vallas' and private.has_permission('cotizador.availability.manage'));
create policy aliados_vallas_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'aliados-vallas' and private.has_permission('cotizador.availability.manage'))
  with check (bucket_id = 'aliados-vallas' and private.has_permission('cotizador.availability.manage'));
create policy aliados_vallas_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'aliados-vallas' and private.has_permission('cotizador.availability.manage'));

create policy aliados_catalogos_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'aliados-catalogos' and
    (private.has_permission('cotizador.availability.read') or private.has_permission('cotizador.availability.manage')));
create policy aliados_catalogos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'aliados-catalogos' and private.has_permission('cotizador.availability.manage'));
create policy aliados_catalogos_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'aliados-catalogos' and private.has_permission('cotizador.availability.manage'))
  with check (bucket_id = 'aliados-catalogos' and private.has_permission('cotizador.availability.manage'));
create policy aliados_catalogos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'aliados-catalogos' and private.has_permission('cotizador.availability.manage'));
