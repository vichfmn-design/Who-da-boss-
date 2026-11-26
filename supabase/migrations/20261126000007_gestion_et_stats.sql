-- Gestion des duos et groupes + tableau de bord du profil (appliquée le 26 novembre 2026).
create or replace function public.delete_connection(p_connection uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from connections where id = p_connection and auth.uid() in (user_a, user_b);
  if not found then raise exception 'Duo introuvable'; end if;
end $$;

create or replace function public.leave_group(p_group uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_next uuid;
begin
  delete from group_members where group_id = p_group and user_id = auth.uid();
  if not found then raise exception 'Tu n''es pas dans ce groupe'; end if;
  select user_id into v_next from group_members where group_id = p_group order by joined_at limit 1;
  if v_next is null then
    delete from groups where id = p_group;
  else
    update groups set created_by = v_next where id = p_group and (created_by = auth.uid() or created_by is null);
  end if;
end $$;

create or replace function public.remove_from_group(p_group uuid, p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = p_group and created_by = auth.uid()) then
    raise exception 'Seul le créateur du groupe peut retirer quelqu''un';
  end if;
  if p_user = auth.uid() then raise exception 'Pour toi, utilise « Quitter le groupe »'; end if;
  delete from group_members where group_id = p_group and user_id = p_user;
end $$;

create or replace function public.delete_group(p_group uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from groups where id = p_group and created_by = auth.uid();
  if not found then raise exception 'Seul le créateur du groupe peut le supprimer'; end if;
end $$;

-- my_stats() : voir la migration « my_stats_dashboard » appliquée sur le projet.
-- Renvoie played, wins, losses, forfeits, season_points, best_game, answered, correct,
-- sure_total, sure_correct, avg_ms_correct, fastest_ms, mines_placed, mines_triggered,
-- mines_hit, boosts_played, boosts_won, bonus_earned, cards_won, best_streak,
-- themes[] (slug, name, answered, correct), favorite_rival, nemesis, victim.

revoke execute on function public.delete_connection(uuid) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.remove_from_group(uuid, uuid) from public, anon;
revoke execute on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_connection(uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_from_group(uuid, uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
