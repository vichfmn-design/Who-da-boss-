-- Scénario complet sur une base de test (après 00_supabase_shim.sql, migrations 0001-0002 et seed).
-- Victor invite Léa, ils jouent leur duel, Victor pose une mine, Léa saute dessus.
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'victor@test'),
  ('00000000-0000-0000-0000-00000000000b', 'lea@test');
insert into public.profiles (id, pseudo) values
  ('00000000-0000-0000-0000-00000000000a', 'Victor'),
  ('00000000-0000-0000-0000-00000000000b', 'Lea');

create temp table t (k text primary key, v text);
grant all on t to authenticated;

-- Victor crée une invitation, Léa l'accepte : la connexion et le duel du jour s'ouvrent
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into t select 'code', public.create_invite();
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.accept_invite((select v from t where k = 'code'));

insert into t select 'match', match_id::text from public.get_my_matches() limit 1;

do $$
declare
  v_match uuid := (select v from t where k = 'match')::uuid;
  v_q jsonb;
  v_correct int[];
  v_pts int;
  v_reveal jsonb;
begin
  assert v_match is not null, 'le duel du jour devrait être ouvert';
  select array_agg(q.correct_index order by u.ord) into v_correct
  from public.matches m, unnest(m.question_ids) with ordinality u(qid, ord)
  join public.questions q on q.id = u.qid where m.id = v_match;

  -- Victor : Sûr juste ×3, une faute normale, une juste. Mine sur la question 1.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  v_q := public.get_match_questions(v_match);
  assert jsonb_array_length(v_q->'questions') = 5, '5 questions';
  assert (v_q->'questions'->0) ? 'correct_index' = false, 'la bonne réponse ne doit pas être envoyée';
  perform public.place_mine(v_match, 1);
  begin
    perform public.place_mine(v_match, 2);
    raise exception 'une deuxième mine aurait dû être refusée';
  exception when others then
    assert sqlerrm like '%Une seule mine%', sqlerrm;
  end;
  perform public.submit_answer(v_match, 0, v_correct[1], true, 4000);
  perform public.submit_answer(v_match, 1, v_correct[2], true, 4000);
  perform public.submit_answer(v_match, 2, v_correct[3], true, 4000);
  perform public.submit_answer(v_match, 3, (v_correct[4] + 1) % 4, false, 4000);
  perform public.submit_answer(v_match, 4, v_correct[5], false, 4000);
  assert public.finish_my_match(v_match) = false, 'Léa n''a pas encore joué';

  -- Léa : juste, Sûr FAUX sur la question minée, juste, juste, pas de réponse (temps écoulé)
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  perform public.submit_answer(v_match, 0, v_correct[1], false, 3000);
  perform public.submit_answer(v_match, 1, (v_correct[2] + 1) % 4, true, 3000);
  perform public.submit_answer(v_match, 2, v_correct[3], false, 3000);
  perform public.submit_answer(v_match, 3, v_correct[4], false, 3000);
  perform public.submit_answer(v_match, 4, v_correct[5], false, 20000); -- trop tard
  assert public.finish_my_match(v_match) = true, 'tout le monde a joué : révélation';

  select points into v_pts from public.match_players where match_id = v_match and user_id = '00000000-0000-0000-0000-00000000000a';
  assert v_pts = 3 + 3 + 3 - 1 + 1, format('Victor devrait avoir 9, a %s', v_pts);
  select points into v_pts from public.match_players where match_id = v_match and user_id = '00000000-0000-0000-0000-00000000000b';
  assert v_pts = 1 - 6 + 1 + 1 - 1, format('Léa devrait avoir -4, a %s', v_pts);

  assert (select winner from public.matches where id = v_match) = '00000000-0000-0000-0000-00000000000a', 'Victor gagne';
  -- Bonus : mine déclenchée (+1) et 3 Sûr justes (+1) pour Victor
  assert (select bonus_balance from public.profiles where pseudo = 'Victor') = 2, 'Victor a 2 points bonus';

  v_reveal := public.get_reveal(v_match);
  assert (v_reveal->'questions'->1->>'mines')::int = 1, 'la question 1 est minée';
  raise notice 'Duel OK : Victor 9, Léa -4, révélation complète';
end $$;

-- Un 3e point bonus donne une carte, jouable 3 jours
do $$
declare v_card uuid; v_conn uuid; v_card_match uuid;
begin
  perform public.grant_bonus('00000000-0000-0000-0000-00000000000a', 1, 'test', null);
  select id into v_card from public.cards where owner = '00000000-0000-0000-0000-00000000000a';
  assert v_card is not null, 'une carte aurait dû être créée';
  assert (select bonus_balance from public.profiles where pseudo = 'Victor') = 0, 'le solde repart à 0';

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  select id into v_conn from public.connections limit 1;
  v_card_match := public.play_card(v_card, 'animaux', v_conn, null);
  assert (select card_multiplier from public.matches where id = v_card_match) = 2, 'duel de carte ×2';
  assert (select used_at from public.cards where id = v_card) is not null, 'carte utilisée';
  raise notice 'Carte Who da Boss ? OK';
end $$;

-- Titres et rang mondial
select public.refresh_titles();
do $$
begin
  assert (select holder from public.title_holders
          where scope = 'global' and title_key = 'most_sure_correct') = '00000000-0000-0000-0000-00000000000a',
         'Victor est la personne la plus sûre';
  assert (select holder from public.title_holders
          where scope = 'global' and title_key = 'most_sure_wrong') = '00000000-0000-0000-0000-00000000000b',
         'Léa s''y croit trop';
  raise notice 'Titres OK';
end $$;

-- Sécurité : un joueur connecté ne lit pas les questions en direct
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
begin
  assert (select count(*) from public.questions) = 0, 'les questions ne doivent pas être lisibles';
  assert (select count(*) from public.matches) >= 1, 'Léa voit ses parties';
  begin
    perform public.finalize_match((select id from public.matches limit 1));
    raise exception 'finalize_match ne devrait pas être appelable';
  exception when insufficient_privilege then null;
  end;
  raise notice 'Sécurité OK';
end $$;
reset role;

-- Forfait et joker : la fenêtre du duel de carte est terminée depuis 1 h
do $$
declare v_m uuid := (select id from public.matches where kind = 'card' limit 1);
begin
  update public.matches set opens_at = now() - interval '25 hours', closes_at = now() - interval '1 hour' where id = v_m;
  -- Léa utilise son joker de la semaine : la partie attend jusqu'à midi
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  perform public.use_joker(v_m);
  assert public.close_due_matches() = 0, 'la partie attend le joueur qui a un joker';
  assert public.can_play_now(v_m), 'Léa peut encore jouer avec son joker';
  -- Victor, sans joker, ne peut plus jouer
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  assert not public.can_play_now(v_m), 'Victor ne peut plus jouer';
  -- Midi passé : clôture, les deux absents sont forfait (0 point)
  update public.matches set closes_at = now() - interval '13 hours' where id = v_m;
  assert public.close_due_matches() = 1, 'clôture après midi';
  assert (select bool_and(forfeit) from public.match_players where match_id = v_m), 'forfait pour les absents';
  assert (select winner from public.matches where id = v_m) is null, 'pas de gagnant sans joueur';
  raise notice 'Forfait et joker OK';
end $$;
