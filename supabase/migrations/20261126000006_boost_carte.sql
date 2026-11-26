-- Boost et carte Who da Boss ? (appliquée sur le projet Supabase le 26 novembre 2026).
-- Boost : une question flash bonus en fin de partie (1 par partie, 3 par semaine).
--   Juste en 10 s : +3 points dans la partie et +1 point bonus. Faux ou temps écoulé : 0.
-- Carte : le lanceur du défi double tous ses points ; les autres doublent seulement leurs pertes.
create table if not exists public.boosts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  choice_index smallint,
  is_correct boolean,
  points int not null default 0,
  unique (match_id, user_id)
);
alter table public.boosts enable row level security;

create or replace function public.boosts_left() returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, 3 - (select count(*)::int from boosts
                          where user_id = auth.uid() and started_at >= date_trunc('week', now())));
$$;

create or replace function public.start_boost(p_match uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_m matches%rowtype;
  v_lang text;
  v_q questions%rowtype;
  v_b boosts%rowtype;
begin
  if not coalesce(public.can_play_now(p_match), false) then raise exception 'Cette partie n''est plus jouable'; end if;
  if (select count(*) from answers where match_id = p_match and user_id = auth.uid()) < 5 then
    raise exception 'Le Boost se joue après tes 5 questions';
  end if;
  select * into v_b from boosts where match_id = p_match and user_id = auth.uid();
  if v_b.id is null then
    if public.boosts_left() <= 0 then raise exception 'Plus de Boost cette semaine (3 maximum)'; end if;
    select * into v_m from matches where id = p_match;
    select * into v_q from questions q
      where q.theme_slug = v_m.theme_slug and q.active and not (q.id = any(v_m.question_ids))
      order by random() limit 1;
    if v_q.id is null then
      select * into v_q from questions q where q.active and not (q.id = any(v_m.question_ids)) order by random() limit 1;
    end if;
    insert into boosts (match_id, user_id, question_id) values (p_match, auth.uid(), v_q.id) returning * into v_b;
  elsif v_b.answered_at is not null then
    raise exception 'Boost déjà joué pour cette partie';
  else
    select * into v_q from questions where id = v_b.question_id;
  end if;
  select lang into v_lang from profiles where id = auth.uid();
  return jsonb_build_object(
    'prompt', case when v_lang = 'en' then v_q.prompt_en else v_q.prompt_fr end,
    'choices', to_jsonb(case when v_lang = 'en' then v_q.choices_en else v_q.choices_fr end),
    'started_at', v_b.started_at);
end $$;

create or replace function public.submit_boost(p_match uuid, p_choice int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_b boosts%rowtype;
  v_q questions%rowtype;
  v_ok boolean;
begin
  select * into v_b from boosts where match_id = p_match and user_id = auth.uid() for update;
  if v_b.id is null then raise exception 'Aucun Boost en cours'; end if;
  if v_b.answered_at is not null then raise exception 'Boost déjà joué'; end if;
  select * into v_q from questions where id = v_b.question_id;
  v_ok := p_choice is not null and now() <= v_b.started_at + interval '11 seconds' and p_choice = v_q.correct_index;
  update boosts set answered_at = now(), choice_index = p_choice, is_correct = v_ok,
                    points = case when v_ok then 3 else 0 end
  where id = v_b.id;
  return jsonb_build_object('correct', v_ok, 'correct_index', v_q.correct_index, 'points', case when v_ok then 3 else 0 end,
    'explanation', v_q.explanation_fr);
end $$;

-- finalize_match : voir 20261125000002_game.sql, avec trois changements :
--   1. bonne réponse dans une partie « card » : ×2 seulement pour le lanceur (matches.challenger) ;
--   2. points du joueur = somme des réponses + points de son Boost ;
--   3. +1 point bonus (raison « boost ») pour un Boost réussi, sauf forfait.
-- Le texte complet de la fonction est celui appliqué sur le projet (migration « boost_and_card_rules »).

revoke execute on function public.boosts_left() from public, anon;
revoke execute on function public.start_boost(uuid) from public, anon;
revoke execute on function public.submit_boost(uuid, int) from public, anon;
grant execute on function public.boosts_left() to authenticated;
grant execute on function public.start_boost(uuid) to authenticated;
grant execute on function public.submit_boost(uuid, int) to authenticated;
