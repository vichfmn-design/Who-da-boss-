-- Who da Boss ? — règles du jeu côté serveur.
-- Mêmes règles que src/engine/rules.ts : si tu en changes une, change l'autre.
--   Réponse normale : +1 / −1        « Sûr ! » : +3 / −3
--   Mine : pertes ×2 (×n si n mines, ×2 au minimum), seulement sur les autres
--   Carte Who da Boss ? : tout ×2       Pas de réponse en 15 s = fausse
--   Forfait : 0 point          Joker : 1 par semaine, jusqu'à midi le lendemain

-- ------------------------------------------------------------------
-- Outils
-- ------------------------------------------------------------------
create or replace function public.local_midnight(p_tz text) returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone p_tz) at time zone p_tz;
$$;

create or replace function public.mine_multiplier(p_mines bigint) returns int
language sql immutable as $$
  select case when p_mines <= 0 then 1 else greatest(2, p_mines)::int end;
$$;

-- ------------------------------------------------------------------
-- Création des parties
-- ------------------------------------------------------------------
create or replace function public.pick_theme(p_players uuid[]) returns text
language sql volatile security definer set search_path = public as $$
  select t.slug
  from themes t
  where t.active
    and (select count(*) from questions q where q.theme_slug = t.slug and q.active) >= 5
  order by exists (select 1 from user_themes ut
                   where ut.theme_slug = t.slug and ut.user_id = any(p_players)) desc,
           random()
  limit 1;
$$;

create or replace function public.pick_questions(
  p_theme text, p_players uuid[], p_connection uuid, p_group uuid
) returns uuid[]
language plpgsql volatile security definer set search_path = public as $$
declare v uuid[];
begin
  -- Questions jamais vues par ce duo / ce groupe depuis 6 mois
  select array_agg(id) into v from (
    select q.id from questions q
    where q.theme_slug = p_theme and q.active
      and (q.lang_only is null or not exists (
            select 1 from profiles p where p.id = any(p_players) and p.lang <> q.lang_only))
      and not exists (
            select 1 from matches m
            where q.id = any(m.question_ids)
              and (m.connection_id = p_connection or m.group_id = p_group)
              and m.created_at > now() - interval '180 days')
    order by random() limit 5) s;

  -- Pas assez de questions neuves : on autorise les répétitions
  if coalesce(array_length(v, 1), 0) < 5 then
    select array_agg(id) into v from (
      select q.id from questions q
      where q.theme_slug = p_theme and q.active
        and (q.lang_only is null or not exists (
              select 1 from profiles p where p.id = any(p_players) and p.lang <> q.lang_only))
      order by random() limit 5) s;
  end if;
  return v;
end $$;

create or replace function public.create_match(
  p_kind public.match_kind, p_connection uuid, p_group uuid,
  p_opens timestamptz, p_closes timestamptz,
  p_theme text default null, p_multiplier int default 1, p_challenger uuid default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_players uuid[];
  v_theme   text;
  v_qs      uuid[];
  v_id      uuid;
begin
  if p_connection is not null then
    select array[user_a, user_b] into v_players from connections where id = p_connection;
  else
    select array_agg(user_id) into v_players from group_members where group_id = p_group;
  end if;
  if coalesce(array_length(v_players, 1), 0) < 2 then
    return null;
  end if;

  v_theme := coalesce(p_theme, public.pick_theme(v_players));
  if v_theme is null then
    raise exception 'Aucun thème ne contient au moins 5 questions actives';
  end if;
  v_qs := public.pick_questions(v_theme, v_players, p_connection, p_group);
  if coalesce(array_length(v_qs, 1), 0) < 5 then
    raise exception 'Pas assez de questions dans le thème %', v_theme;
  end if;

  insert into matches (kind, connection_id, group_id, theme_slug, question_ids,
                       opens_at, closes_at, card_multiplier, challenger)
  values (p_kind, p_connection, p_group, v_theme, v_qs, p_opens, p_closes, p_multiplier, p_challenger)
  returning id into v_id;

  insert into match_players (match_id, user_id)
  select v_id, unnest(v_players);
  return v_id;
end $$;

-- Ouvre la partie du jour (ou de la période) de chaque duo et groupe.
create or replace function public.open_due_matches() returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  c record;
  g record;
  v_opens timestamptz;
  v_count int := 0;
begin
  for c in
    select co.id, co.rhythm_days, p.timezone,
           (select max(m.closes_at) from matches m where m.connection_id = co.id and m.kind = 'duo') as last_close
    from connections co join profiles p on p.id = co.user_a
  loop
    continue when exists (select 1 from matches m
                          where m.connection_id = c.id and m.kind = 'duo' and m.closes_at > now());
    v_opens := greatest(public.local_midnight(c.timezone), coalesce(c.last_close, '-infinity'::timestamptz));
    continue when v_opens > now();
    perform public.create_match('duo', c.id, null, v_opens, v_opens + make_interval(days => c.rhythm_days));
    v_count := v_count + 1;
  end loop;

  for g in
    select gr.id, gr.rhythm_days, coalesce(p.timezone, 'Europe/Paris') as timezone,
           (select max(m.closes_at) from matches m where m.group_id = gr.id and m.kind = 'group') as last_close
    from groups gr left join profiles p on p.id = gr.created_by
  loop
    continue when exists (select 1 from matches m
                          where m.group_id = g.id and m.kind = 'group' and m.closes_at > now());
    continue when (select count(*) from group_members where group_id = g.id) < 2;
    v_opens := greatest(public.local_midnight(g.timezone), coalesce(g.last_close, '-infinity'::timestamptz));
    continue when v_opens > now();
    perform public.create_match('group', null, g.id, v_opens, v_opens + make_interval(days => g.rhythm_days));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ------------------------------------------------------------------
-- Pendant la partie (appelées par l'app)
-- ------------------------------------------------------------------

-- Mes parties en cours et récentes.
create or replace function public.get_my_matches() returns table (
  match_id uuid, kind public.match_kind, status text, opens_at timestamptz, closes_at timestamptz,
  theme_name text, opponents text, connection_id uuid, group_id uuid, card_multiplier int,
  i_finished boolean, players_total int, players_finished int, my_points int, my_rank int
)
language sql stable security definer set search_path = public as $$
  select m.id, m.kind, m.status, m.opens_at, m.closes_at,
         case when me_p.lang = 'en' then t.name_en else t.name_fr end,
         (select string_agg(p.pseudo, ', ' order by p.pseudo)
            from match_players o join profiles p on p.id = o.user_id
           where o.match_id = m.id and o.user_id <> auth.uid()),
         m.connection_id, m.group_id, m.card_multiplier,
         me.finished_at is not null,
         (select count(*)::int from match_players x where x.match_id = m.id),
         (select count(*)::int from match_players x where x.match_id = m.id and x.finished_at is not null),
         me.points, me.rank
  from match_players me
  join matches m on m.id = me.match_id
  join themes t on t.slug = m.theme_slug
  join profiles me_p on me_p.id = me.user_id
  where me.user_id = auth.uid()
    and (m.status = 'open' or m.closes_at > now() - interval '7 days')
  order by m.status desc, m.closes_at;
$$;

-- Les 5 questions, sans la bonne réponse, dans la langue du joueur.
create or replace function public.get_match_questions(p_match uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_lang text;
  v_match matches%rowtype;
  v_result jsonb;
begin
  if not public.is_match_player(p_match) then raise exception 'Tu ne joues pas cette partie'; end if;
  select * into v_match from matches where id = p_match;
  select lang into v_lang from profiles where id = auth.uid();

  update match_players set started_at = coalesce(started_at, now())
  where match_id = p_match and user_id = auth.uid();

  select jsonb_build_object(
    'match_id', v_match.id,
    'status', v_match.status,
    'closes_at', v_match.closes_at,
    'card_multiplier', v_match.card_multiplier,
    'theme', (select case when v_lang = 'en' then name_en else name_fr end from themes where slug = v_match.theme_slug),
    'questions', (
      select jsonb_agg(jsonb_build_object(
               'index', ord - 1,
               'prompt', case when v_lang = 'en' then q.prompt_en else q.prompt_fr end,
               'choices', to_jsonb(case when v_lang = 'en' then q.choices_en else q.choices_fr end))
             order by ord)
      from unnest(v_match.question_ids) with ordinality as u(qid, ord)
      join questions q on q.id = u.qid),
    'answered', (select coalesce(jsonb_agg(question_index order by question_index), '[]'::jsonb)
                 from answers where match_id = p_match and user_id = auth.uid()),
    'my_mine', (select question_index from mines where match_id = p_match and user_id = auth.uid())
  ) into v_result;
  return v_result;
end $$;

create or replace function public.can_play_now(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select m.status = 'open'
     and now() >= m.opens_at
     and (now() < m.closes_at or (mp.joker_used and now() < m.closes_at + interval '12 hours'))
     and mp.finished_at is null
  from matches m join match_players mp on mp.match_id = m.id and mp.user_id = auth.uid()
  where m.id = p_match;
$$;

create or replace function public.submit_answer(
  p_match uuid, p_index int, p_choice int, p_sure boolean, p_ms int
) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_qid uuid;
  v_correct smallint;
  v_choice smallint := p_choice;
begin
  if not coalesce(public.can_play_now(p_match), false) then
    raise exception 'Cette partie n''est plus jouable';
  end if;
  if p_index < 0 or p_index > 4 then raise exception 'Question inconnue'; end if;
  if p_ms is null or p_ms > 16000 then v_choice := null; end if; -- 15 s + 1 s de marge réseau

  select (question_ids)[p_index + 1] into v_qid from matches where id = p_match;
  select correct_index into v_correct from questions where id = v_qid;

  insert into answers (match_id, user_id, question_index, choice_index, sure, answered_ms, is_correct)
  values (p_match, auth.uid(), p_index, v_choice, coalesce(p_sure, false),
          least(greatest(coalesce(p_ms, 15000), 0), 15000),
          v_choice is not null and v_choice = v_correct);
exception when unique_violation then
  raise exception 'Tu as déjà répondu à cette question';
end $$;

create or replace function public.place_mine(p_match uuid, p_index int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not coalesce(public.can_play_now(p_match), false) then
    raise exception 'Cette partie n''est plus jouable';
  end if;
  if p_index < 0 or p_index > 4 then raise exception 'Question inconnue'; end if;
  insert into mines (match_id, user_id, question_index) values (p_match, auth.uid(), p_index);
exception when unique_violation then
  raise exception 'Une seule mine par partie';
end $$;

create or replace function public.remove_mine(p_match uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not coalesce(public.can_play_now(p_match), false) then
    raise exception 'Cette partie n''est plus jouable';
  end if;
  delete from mines where match_id = p_match and user_id = auth.uid();
end $$;

-- Joker : 1 par semaine, pour rattraper un duel jusqu'à midi le lendemain.
create or replace function public.use_joker(p_match uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_closes timestamptz;
begin
  select closes_at into v_closes from matches where id = p_match and status = 'open';
  if v_closes is null or not public.is_match_player(p_match) then raise exception 'Partie introuvable'; end if;
  if now() < v_closes or now() >= v_closes + interval '12 hours' then
    raise exception 'Le joker sert seulement entre minuit et midi, après la fin de la partie';
  end if;
  if exists (select 1 from match_players mp join matches m on m.id = mp.match_id
             where mp.user_id = auth.uid() and mp.joker_used
               and m.closes_at >= date_trunc('week', now())) then
    raise exception 'Tu as déjà utilisé ton joker cette semaine';
  end if;
  update match_players set joker_used = true where match_id = p_match and user_id = auth.uid();
end $$;

-- ------------------------------------------------------------------
-- Points bonus et cartes
-- ------------------------------------------------------------------
create or replace function public.grant_bonus(p_user uuid, p_delta int, p_reason text, p_match uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_bal int;
begin
  insert into bonus_ledger (user_id, delta, reason, match_id) values (p_user, p_delta, p_reason, p_match);
  update profiles set bonus_balance = bonus_balance + p_delta where id = p_user
  returning bonus_balance into v_bal;
  while v_bal >= 3 loop
    insert into cards (owner) values (p_user);  -- valable 3 jours
    v_bal := v_bal - 3;
  end loop;
  update profiles set bonus_balance = v_bal where id = p_user;
end $$;

-- Jouer une carte : défi sur un thème, en duo ou contre tout le groupe.
create or replace function public.play_card(
  p_card uuid, p_theme text, p_connection uuid default null, p_group uuid default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_card cards%rowtype;
  v_tz text;
  v_match uuid;
begin
  select * into v_card from cards where id = p_card and owner = auth.uid() for update;
  if v_card.id is null then raise exception 'Carte introuvable'; end if;
  if v_card.used_at is not null then raise exception 'Carte déjà jouée'; end if;
  if now() >= v_card.expires_at then raise exception 'Carte expirée (3 jours)'; end if;
  if (p_connection is null) = (p_group is null) then raise exception 'Choisis un duo ou un groupe'; end if;
  if p_connection is not null and not exists (
       select 1 from connections where id = p_connection and auth.uid() in (user_a, user_b)) then
    raise exception 'Connexion inconnue';
  end if;
  if p_group is not null and not public.is_group_member(p_group) then raise exception 'Groupe inconnu'; end if;

  select timezone into v_tz from profiles where id = auth.uid();
  v_match := public.create_match('card', p_connection, p_group, now(),
                                 public.local_midnight(v_tz) + interval '1 day',
                                 p_theme, 2, auth.uid());
  update cards set used_at = now(), match_id = v_match where id = p_card;
  return v_match;
end $$;

-- ------------------------------------------------------------------
-- Clôture et révélation
-- ------------------------------------------------------------------
create or replace function public.finalize_match(p_match uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_m matches%rowtype;
  r record;
begin
  select * into v_m from matches where id = p_match for update;
  if v_m.id is null or v_m.status = 'closed' then return; end if;

  -- Forfait : n'a pas fini sa partie
  update match_players set forfeit = true, points = 0
  where match_id = p_match and finished_at is null;

  -- Questions sans réponse = temps écoulé = réponse fausse
  insert into answers (match_id, user_id, question_index, choice_index, sure, answered_ms, is_correct)
  select mp.match_id, mp.user_id, g.i, null, false, 15000, false
  from match_players mp cross join generate_series(0, 4) as g(i)
  where mp.match_id = p_match and not mp.forfeit
  on conflict do nothing;

  -- Points de chaque réponse (mines des AUTRES joueurs uniquement)
  update answers a set points =
    case when a.is_correct
      then (case when a.sure then 3 else 1 end) * v_m.card_multiplier
      else (case when a.sure then -3 else -1 end) * v_m.card_multiplier
           * public.mine_multiplier((select count(*) from mines mi
                                     where mi.match_id = a.match_id
                                       and mi.question_index = a.question_index
                                       and mi.user_id <> a.user_id))
    end
  where a.match_id = p_match;

  update match_players mp set
    points   = coalesce((select sum(a.points) from answers a
                         where a.match_id = mp.match_id and a.user_id = mp.user_id), 0),
    total_ms = coalesce((select sum(a.answered_ms) from answers a
                         where a.match_id = mp.match_id and a.user_id = mp.user_id), 0)
  where mp.match_id = p_match and not mp.forfeit;

  -- Classement : points, puis le plus rapide ; forfaits en dernier
  with ranked as (
    select user_id, row_number() over (order by forfeit, points desc, total_ms asc) as rn
    from match_players where match_id = p_match
  )
  update match_players mp set rank = ranked.rn
  from ranked where mp.match_id = p_match and mp.user_id = ranked.user_id;

  update matches set status = 'closed',
    winner = (select user_id from match_players
              where match_id = p_match and not forfeit order by rank limit 1)
  where id = p_match;

  -- Bonus : quelqu'un a sauté sur ta mine (+1 par victime, à valider)
  for r in
    select mi.user_id as miner
    from answers a
    join mines mi on mi.match_id = a.match_id and mi.question_index = a.question_index
                 and mi.user_id <> a.user_id
    where a.match_id = p_match and not a.is_correct
  loop
    perform public.grant_bonus(r.miner, 1, 'mine_triggered', p_match);
  end loop;

  -- Bonus : 3 « Sûr » justes dans la même partie
  for r in
    select user_id from answers
    where match_id = p_match and sure and is_correct
    group by user_id having count(*) >= 3
  loop
    perform public.grant_bonus(r.user_id, 1, 'three_sure', p_match);
  end loop;
end $$;

-- J'ai fini mes 5 questions : si tout le monde a fini, on révèle tout de suite.
create or replace function public.finish_my_match(p_match uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_match_player(p_match) then raise exception 'Partie introuvable'; end if;
  update match_players set finished_at = coalesce(finished_at, now())
  where match_id = p_match and user_id = auth.uid();
  if not exists (select 1 from match_players where match_id = p_match and finished_at is null) then
    perform public.finalize_match(p_match);
    return true;
  end if;
  return false;
end $$;

-- Clôture automatique : tout le monde a fini après minuit, ou midi est passé (fin des jokers).
create or replace function public.close_due_matches() returns int
language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select m.id from matches m
    where m.status = 'open'
      and (now() >= m.closes_at + interval '12 hours'
           or (now() >= m.closes_at and not exists (
                 select 1 from match_players mp
                 where mp.match_id = m.id and mp.finished_at is null and mp.joker_used)))
  loop
    perform public.finalize_match(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Révélation : tout le détail, seulement une fois la partie close.
create or replace function public.get_reveal(p_match uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_lang text; v_m matches%rowtype;
begin
  if not public.is_match_player(p_match) then raise exception 'Partie introuvable'; end if;
  select * into v_m from matches where id = p_match;
  if v_m.status <> 'closed' then raise exception 'Révélation quand tout le monde a joué'; end if;
  select lang into v_lang from profiles where id = auth.uid();

  return jsonb_build_object(
    'match_id', v_m.id,
    'winner', v_m.winner,
    'card_multiplier', v_m.card_multiplier,
    'questions', (
      select jsonb_agg(jsonb_build_object(
               'index', ord - 1,
               'prompt', case when v_lang = 'en' then q.prompt_en else q.prompt_fr end,
               'choices', to_jsonb(case when v_lang = 'en' then q.choices_en else q.choices_fr end),
               'correct_index', q.correct_index,
               'mines', (select count(*) from mines mi where mi.match_id = v_m.id and mi.question_index = ord - 1))
             order by ord)
      from unnest(v_m.question_ids) with ordinality as u(qid, ord)
      join questions q on q.id = u.qid),
    'players', (
      select jsonb_agg(jsonb_build_object(
               'user_id', mp.user_id, 'pseudo', p.pseudo, 'points', mp.points,
               'rank', mp.rank, 'forfeit', mp.forfeit,
               'mine', (select question_index from mines where match_id = v_m.id and user_id = mp.user_id),
               'answers', (select jsonb_agg(jsonb_build_object(
                              'index', a.question_index, 'choice', a.choice_index, 'sure', a.sure,
                              'correct', a.is_correct, 'points', a.points) order by a.question_index)
                           from answers a where a.match_id = v_m.id and a.user_id = mp.user_id))
             order by mp.rank)
      from match_players mp join profiles p on p.id = mp.user_id
      where mp.match_id = v_m.id)
  );
end $$;

-- ------------------------------------------------------------------
-- Connexions, invitations, groupes, rythme
-- ------------------------------------------------------------------
create or replace function public.create_invite(p_group uuid default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare v_code text;
begin
  if p_group is not null and not public.is_group_member(p_group) then raise exception 'Groupe inconnu'; end if;
  insert into invites (inviter, group_id) values (auth.uid(), p_group) returning code into v_code;
  return v_code;
end $$;

create or replace function public.accept_invite(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_inv invites%rowtype;
  v_a uuid; v_b uuid; v_conn uuid;
begin
  select * into v_inv from invites where code = lower(trim(p_code)) for update;
  if v_inv.code is null then raise exception 'Invitation inconnue'; end if;
  if v_inv.inviter = auth.uid() then raise exception 'C''est ta propre invitation'; end if;

  if v_inv.group_id is not null then
    insert into group_members (group_id, user_id) values (v_inv.group_id, auth.uid())
    on conflict do nothing;
    return jsonb_build_object('group_id', v_inv.group_id);
  end if;

  if v_inv.used_by is not null then raise exception 'Invitation déjà utilisée'; end if;
  v_a := least(v_inv.inviter, auth.uid());
  v_b := greatest(v_inv.inviter, auth.uid());
  insert into connections (user_a, user_b) values (v_a, v_b)
  on conflict (user_a, user_b) do update set user_a = excluded.user_a
  returning id into v_conn;
  update invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  perform public.open_due_matches();
  return jsonb_build_object('connection_id', v_conn);
end $$;

create or replace function public.create_group(p_name text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into groups (name, created_by) values (p_name, auth.uid()) returning id into v_id;
  insert into group_members (group_id, user_id) values (v_id, auth.uid());
  return v_id;
end $$;

-- Rythme : tous les jours (1) à une fois par semaine (7), modifiable une fois par mois.
create or replace function public.set_rhythm(p_days int, p_connection uuid default null, p_group uuid default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_days not between 1 and 7 then raise exception 'Rythme entre 1 et 7 jours'; end if;
  if p_connection is not null then
    update connections set rhythm_days = p_days, rhythm_changed_at = now()
    where id = p_connection and auth.uid() in (user_a, user_b)
      and (rhythm_changed_at is null or rhythm_changed_at < now() - interval '30 days');
  elsif p_group is not null and public.is_group_member(p_group) then
    update groups set rhythm_days = p_days where id = p_group;
  end if;
  if not found then raise exception 'Le rythme ne change qu''une fois par mois'; end if;
end $$;

-- ------------------------------------------------------------------
-- Titres évolutifs : on ne vole un titre qu'en faisant STRICTEMENT mieux
-- ------------------------------------------------------------------
create or replace function public.refresh_titles() returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_season text := 'season-' || to_char(now(), 'YYYY');
  v_month  text := to_char(now(), 'YYYY-MM');
begin
  create temp table _stats (
    scope text, scope_id uuid, title_key text, period text, user_id uuid, value int
  ) on commit drop;

  -- Statistiques de réponses de la saison, à trois niveaux
  with a as (
    select an.user_id, an.sure, an.is_correct, m.theme_slug, m.connection_id, m.group_id
    from answers an join matches m on m.id = an.match_id
    where m.status = 'closed' and m.closes_at >= date_trunc('year', now())
  ), scoped as (
    select 'global'::text as scope, null::uuid as scope_id, user_id, sure, is_correct, theme_slug from a
    union all
    select 'duo', connection_id, user_id, sure, is_correct, theme_slug from a where connection_id is not null
    union all
    select 'group', group_id, user_id, sure, is_correct, theme_slug from a where group_id is not null
  )
  insert into _stats
  select scope, scope_id, 'most_sure_correct', v_season, user_id,
         (count(*) filter (where sure and is_correct))::int
  from scoped group by scope, scope_id, user_id
  union all
  select scope, scope_id, 'most_sure_wrong', v_season, user_id,
         (count(*) filter (where sure and not is_correct))::int
  from scoped group by scope, scope_id, user_id
  union all
  select scope, scope_id, 'theme_boss:' || theme_slug, v_season, user_id,
         (count(*) filter (where is_correct))::int
  from scoped group by scope, scope_id, theme_slug, user_id;

  -- Le Boss des Boss : cartes gagnées
  with c as (
    select winner as user_id, connection_id, group_id from matches
    where kind = 'card' and status = 'closed' and winner is not null
      and closes_at >= date_trunc('year', now())
  )
  insert into _stats
  select 'global', null, 'most_cards_won', v_season, user_id, count(*)::int from c group by user_id
  union all
  select 'duo', connection_id, 'most_cards_won', v_season, user_id, count(*)::int
  from c where connection_id is not null group by connection_id, user_id
  union all
  select 'group', group_id, 'most_cards_won', v_season, user_id, count(*)::int
  from c where group_id is not null group by group_id, user_id;

  -- L'Infatigable : plus longue série de victoires du mois
  with res as (
    select mp.user_id, m.closes_at, m.connection_id, m.group_id, (m.winner = mp.user_id) as won
    from match_players mp join matches m on m.id = mp.match_id
    where m.status = 'closed' and m.closes_at >= date_trunc('month', now())
  ), scoped as (
    select 'global'::text as scope, null::uuid as scope_id, user_id, closes_at, won from res
    union all select 'duo', connection_id, user_id, closes_at, won from res where connection_id is not null
    union all select 'group', group_id, user_id, closes_at, won from res where group_id is not null
  ), islands as (
    select scope, scope_id, user_id, won,
           row_number() over (partition by scope, scope_id, user_id order by closes_at)
         - row_number() over (partition by scope, scope_id, user_id, won order by closes_at) as grp
    from scoped
  )
  insert into _stats
  select scope, scope_id, 'longest_streak_month', v_month, user_id, max(n)::int
  from (select scope, scope_id, user_id, grp, count(*) as n
        from islands where won group by scope, scope_id, user_id, grp) s
  group by scope, scope_id, user_id;

  -- 1) Mettre à jour la valeur des détenteurs actuels
  update title_holders th set value = s.value, updated_at = now()
  from _stats s
  where s.scope = th.scope and s.scope_id is not distinct from th.scope_id
    and s.title_key = th.title_key and s.period = th.period and s.user_id = th.holder;

  -- 2) Le meilleur candidat ne prend le titre que s'il fait strictement mieux
  insert into title_holders as th (scope, scope_id, title_key, period, holder, value)
  select distinct on (scope, scope_id, title_key, period)
         scope, scope_id, title_key, period, user_id, value
  from _stats where value > 0
  order by scope, scope_id, title_key, period, value desc, user_id
  on conflict (scope, scope_key, title_key, period) do update
    set holder = excluded.holder, value = excluded.value, updated_at = now()
    where excluded.value > th.value;
end $$;

-- Mon rang mondial au pourcentage de victoires (10 parties minimum pour être classé).
create or replace function public.my_global_rank() returns jsonb
language sql stable security definer set search_path = public as $$
  with stats as (
    select mp.user_id,
           count(*) filter (where m.winner = mp.user_id)::numeric / count(*) as pct,
           count(*) as played
    from match_players mp join matches m on m.id = mp.match_id
    where m.status = 'closed' and m.closes_at >= date_trunc('year', now())
    group by mp.user_id having count(*) >= 10
  ), ranked as (
    select user_id, pct, played, rank() over (order by pct desc, played desc) as rnk from stats
  )
  select jsonb_build_object(
    'rank', (select rnk from ranked where user_id = auth.uid()),
    'pct', (select round(pct * 100) from ranked where user_id = auth.uid()),
    'total', (select count(*) from ranked));
$$;

-- ------------------------------------------------------------------
-- Tâche planifiée
-- ------------------------------------------------------------------
create or replace function public.tick() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.close_due_matches();
  perform public.open_due_matches();
end $$;

-- ------------------------------------------------------------------
-- Droits : seules les fonctions « joueur » sont appelables depuis l'app
-- ------------------------------------------------------------------
revoke execute on function public.create_match(public.match_kind, uuid, uuid, timestamptz, timestamptz, text, int, uuid) from public, anon, authenticated;
revoke execute on function public.open_due_matches() from public, anon, authenticated;
revoke execute on function public.close_due_matches() from public, anon, authenticated;
revoke execute on function public.finalize_match(uuid) from public, anon, authenticated;
revoke execute on function public.grant_bonus(uuid, int, text, uuid) from public, anon, authenticated;
revoke execute on function public.refresh_titles() from public, anon, authenticated;
revoke execute on function public.tick() from public, anon, authenticated;
revoke execute on function public.pick_theme(uuid[]) from public, anon, authenticated;
revoke execute on function public.pick_questions(text, uuid[], uuid, uuid) from public, anon, authenticated;

revoke execute on function public.get_my_matches() from public, anon;
revoke execute on function public.get_match_questions(uuid) from public, anon;
revoke execute on function public.submit_answer(uuid, int, int, boolean, int) from public, anon;
revoke execute on function public.place_mine(uuid, int) from public, anon;
revoke execute on function public.remove_mine(uuid) from public, anon;
revoke execute on function public.use_joker(uuid) from public, anon;
revoke execute on function public.play_card(uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.finish_my_match(uuid) from public, anon;
revoke execute on function public.get_reveal(uuid) from public, anon;
revoke execute on function public.create_invite(uuid) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.set_rhythm(int, uuid, uuid) from public, anon;
revoke execute on function public.my_global_rank() from public, anon;
