-- Run in the Supabase SQL editor. All test records are rolled back.
begin;
do $$
declare
  admin_id uuid;
  code text := 'QA-CRUD-' || upper(replace(gen_random_uuid()::text,'-',''));
  payload jsonb;
  created jsonb;
  edited jsonb;
  archived jsonb;
  rejected boolean;
begin
  select user_id into admin_id from public.user_roles
    where role = 'systems_admin' and revoked_at is null limit 1;
  if admin_id is null then raise exception 'No hay administrador activo para verificar.'; end if;
  payload := jsonb_build_object('codigo',code,'proveedor','QA temporal','ciudad','Bogotá',
    'ubicacion','Prueba transaccional','estado','revision_fuente','tarifa_mensual_cop',100,
    'datos_fuente',jsonb_build_object('gestion_admin',true));
  rejected := false;
  begin
    perform public.aliados_admin_save(null,code,payload,null,true,null);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Falló la protección de rol.'; end if;

  created := public.aliados_admin_save(admin_id,code,payload,null,true,null);
  if created->>'codigo' <> code then raise exception 'Falló la creación.'; end if;
  payload := jsonb_set(payload,'{tarifa_mensual_cop}','200');
  edited := public.aliados_admin_save(admin_id,code,payload,(created->>'actualizado_en')::timestamptz,false,null);
  if (edited->>'tarifa_mensual_cop')::numeric <> 200 then raise exception 'Falló la edición.'; end if;

  rejected := false;
  begin
    perform public.aliados_admin_save(admin_id,code,payload,(created->>'actualizado_en')::timestamptz,false,null);
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'Falló el control de concurrencia.'; end if;

  rejected := false;
  begin
    perform public.aliados_admin_save(admin_id,code,jsonb_set(payload,'{tarifa_mensual_cop}','999'),
      (edited->>'actualizado_en')::timestamptz,false,jsonb_build_object('ruta','incorrecta','mime','image/png'));
  exception when invalid_parameter_value then rejected := true; end;
  if not rejected or (select tarifa_mensual_cop from public.aliados_vallas where codigo=code) <> 200 then
    raise exception 'Falló la reversión de datos al rechazar una foto.';
  end if;

  payload := jsonb_set(payload,'{datos_fuente,archivado_en}',to_jsonb(now()::text));
  archived := public.aliados_admin_save(admin_id,code,payload,(edited->>'actualizado_en')::timestamptz,false,null);
  if archived->'datos_fuente'->>'archivado_en' is null then raise exception 'Falló la eliminación reversible.'; end if;
  payload := jsonb_set(payload,'{datos_fuente,archivado_en}','null');
  edited := public.aliados_admin_save(admin_id,code,payload,(archived->>'actualizado_en')::timestamptz,false,null);
  if edited->'datos_fuente'->>'archivado_en' is not null then raise exception 'Falló la restauración.'; end if;
  if has_function_privilege('anon','public.aliados_admin_save(uuid,text,jsonb,timestamptz,boolean,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.aliados_admin_save(uuid,text,jsonb,timestamptz,boolean,jsonb)','EXECUTE') then
    raise exception 'La función está expuesta a clientes.';
  end if;
end;
$$;
rollback;
select '7 comprobaciones correctas; sin registros de prueba guardados' as resultado;
