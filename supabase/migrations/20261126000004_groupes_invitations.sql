-- Groupes de 4 joueurs maximum, ajout direct d'un rival, partie lancée dès qu'un ami rejoint.
-- (Appliquée sur le projet Supabase le 26 novembre 2026.)
create or replace function public.accept_invite(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_inv invites%rowtype;
  v_a uuid; v_b uuid; v_conn uuid;
  v_name text;
begin
  select * into v_inv from invites where code = lower(trim(p_code)) for update;
  if v_inv.code is null then raise exception 'Invitation inconnue'; end if;
  if v_inv.inviter = auth.uid() then raise exception 'C''est ta propre invitation'; end if;

  if v_inv.group_id is not null then
    select name into v_name from groups where id = v_inv.group_id;
    if v_name is null then raise exception 'Ce groupe n''existe plus'; end if;
    if not exists (select 1 from group_members where group_id = v_inv.group_id and user_id = auth.uid()) then
      if (select count(*) from group_members where group_id = v_inv.group_id) >= 4 then
        raise exception 'Ce groupe est complet (4 joueurs maximum)';
      end if;
      insert into group_members (group_id, user_id) values (v_inv.group_id, auth.uid());
      perform public.open_due_matches();
    end if;
    return jsonb_build_object('group_id', v_inv.group_id, 'group_name', v_name);
  end if;

  if v_inv.used_by is not null and v_inv.used_by <> auth.uid() then raise exception 'Invitation déjà utilisée'; end if;
  v_a := least(v_inv.inviter, auth.uid());
  v_b := greatest(v_inv.inviter, auth.uid());
  insert into connections (user_a, user_b) values (v_a, v_b)
  on conflict (user_a, user_b) do update set user_a = excluded.user_a
  returning id into v_conn;
  update invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  perform public.open_due_matches();
  return jsonb_build_object('connection_id', v_conn);
end $$;

create or replace function public.add_to_group(p_group uuid, p_user uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare v_pseudo text;
begin
  if not public.is_group_member(p_group) then raise exception 'Groupe inconnu'; end if;
  if not exists (select 1 from connections
                 where (user_a = auth.uid() and user_b = p_user) or (user_b = auth.uid() and user_a = p_user)) then
    raise exception 'Tu peux ajouter seulement un de tes rivaux';
  end if;
  if exists (select 1 from group_members where group_id = p_group and user_id = p_user) then
    raise exception 'Déjà dans le groupe';
  end if;
  if (select count(*) from group_members where group_id = p_group) >= 4 then
    raise exception 'Ce groupe est complet (4 joueurs maximum)';
  end if;
  insert into group_members (group_id, user_id) values (p_group, p_user);
  perform public.open_due_matches();
  select pseudo into v_pseudo from profiles where id = p_user;
  return v_pseudo;
end $$;
revoke execute on function public.add_to_group(uuid, uuid) from public, anon;
grant execute on function public.add_to_group(uuid, uuid) to authenticated;
