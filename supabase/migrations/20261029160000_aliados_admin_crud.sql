-- The server calls this transaction only after validating the current session.
-- The function also checks the active role. It never grants access to role tables.
create or replace function public.aliados_admin_save(
  p_user_id uuid, p_codigo text, p_payload jsonb,
  p_expected timestamptz, p_create boolean, p_photo jsonb default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_row public.aliados_vallas%rowtype;
  saved public.aliados_vallas%rowtype;
begin
  if not exists (select 1 from public.user_roles where user_id = p_user_id
    and role = 'systems_admin' and revoked_at is null) then
    raise exception 'Solo el administrador de plataforma puede gestionar vallas.' using errcode = '42501';
  end if;
  if p_codigo !~ '^[A-Z0-9]+(-[A-Z0-9]+)+$' or p_payload->>'codigo' is distinct from p_codigo then
    raise exception 'Código inválido.' using errcode = '22023';
  end if;
  if p_create then
    insert into public.aliados_vallas (codigo, proveedor, ciudad, estado)
      values (p_codigo, p_payload->>'proveedor', p_payload->>'ciudad', p_payload->>'estado');
  else
    select * into current_row from public.aliados_vallas where codigo = p_codigo for update;
    if not found then raise exception 'Valla no encontrada.' using errcode = 'P0002'; end if;
    if p_expected is null or current_row.actualizado_en is distinct from p_expected then
      raise exception 'La valla cambió desde que la abriste. Recarga antes de guardar.' using errcode = '40001';
    end if;
  end if;
  update public.aliados_vallas set
    proveedor = p_payload->>'proveedor', ciudad = p_payload->>'ciudad',
    ubicacion = p_payload->>'ubicacion', categoria = p_payload->>'categoria',
    formato = p_payload->>'formato', medidas = p_payload->>'medidas',
    tarifa_mensual_cop = (p_payload->>'tarifa_mensual_cop')::numeric,
    latitud = (p_payload->>'latitud')::numeric, longitud = (p_payload->>'longitud')::numeric,
    estado = p_payload->>'estado',
    datos_fuente = coalesce(p_payload->'datos_fuente', '{}'::jsonb)
      || jsonb_build_object('editado_por', p_user_id, 'gestion_admin', true),
    actualizado_en = clock_timestamp()
  where codigo = p_codigo returning * into saved;
  if p_photo is not null then
    if p_photo->>'ruta' not like p_codigo || '/foto/%' or p_photo->>'mime' <> 'image/webp' then
      raise exception 'Foto inválida.' using errcode = '22023';
    end if;
    insert into public.aliados_valla_archivos (codigo, tipo, sha256, bucket, ruta, tamano_bytes, mime, nombre_original)
      values (p_codigo, 'foto', p_photo->>'sha256', 'aliados-vallas', p_photo->>'ruta',
        (p_photo->>'tamano_bytes')::bigint, 'image/webp', p_photo->>'nombre_original')
      on conflict (codigo, tipo, sha256) do update set
        ruta = excluded.ruta, tamano_bytes = excluded.tamano_bytes,
        nombre_original = excluded.nombre_original, subido_en = clock_timestamp();
  end if;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.aliados_admin_save(uuid,text,jsonb,timestamptz,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.aliados_admin_save(uuid,text,jsonb,timestamptz,boolean,jsonb) to service_role;
