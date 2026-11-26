-- Who da Boss ? — schéma de base (v1)
-- Tables, contraintes et sécurité (RLS). Les règles de jeu sont dans 0002.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- Joueurs
-- ------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  pseudo        text not null unique check (char_length(pseudo) between 2 and 20),
  lang          text not null default 'fr' check (lang in ('fr', 'en')),
  timezone      text not null default 'Europe/Paris',
  bonus_balance int  not null default 0 check (bonus_balance >= 0),
  created_at    timestamptz not null default now()
);

-- Thèmes choisis par chaque joueur (3 minimum, contrôlé côté app).
create table public.themes (
  slug     text primary key,
  name_fr  text not null,
  name_en  text not null,
  sort     int  not null default 0,
  active   boolean not null default true
);

create table public.user_themes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  theme_slug text not null references public.themes(slug) on delete cascade,
  primary key (user_id, theme_slug)
);

-- ------------------------------------------------------------------
-- Connexions (duo) et invitations
-- ------------------------------------------------------------------
create table public.connections (
  id                uuid primary key default gen_random_uuid(),
  user_a            uuid not null references public.profiles(id) on delete cascade,
  user_b            uuid not null references public.profiles(id) on delete cascade,
  rhythm_days       int  not null default 1 check (rhythm_days between 1 and 7),
  rhythm_changed_at timestamptz,
  created_at        timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.invites (
  code       text primary key default substr(encode(gen_random_bytes(6), 'hex'), 1, 8),
  inviter    uuid not null references public.profiles(id) on delete cascade,
  group_id   uuid,  -- null = invitation en duo
  created_at timestamptz not null default now(),
  used_by    uuid references public.profiles(id) on delete set null,
  used_at    timestamptz
);

-- ------------------------------------------------------------------
-- Groupes (2 à 4 joueurs)
-- ------------------------------------------------------------------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 30),
  created_by  uuid references public.profiles(id) on delete set null,
  rhythm_days int  not null default 1 check (rhythm_days between 1 and 7),
  created_at  timestamptz not null default now()
);

alter table public.invites
  add constraint invites_group_fk foreign key (group_id) references public.groups(id) on delete cascade;

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create or replace function public.check_group_size() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.group_members where group_id = new.group_id) >= 4 then
    raise exception 'Un groupe compte 4 joueurs au maximum';
  end if;
  return new;
end $$;

create trigger group_members_max_4
  before insert on public.group_members
  for each row execute function public.check_group_size();

-- ------------------------------------------------------------------
-- Questions (bilingues). La bonne réponse n'est JAMAIS lisible
-- directement par les joueurs : on passe par des fonctions.
-- ------------------------------------------------------------------
create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  theme_slug    text not null references public.themes(slug) on delete cascade,
  prompt_fr     text not null,
  prompt_en     text not null,
  choices_fr    text[] not null check (array_length(choices_fr, 1) = 4),
  choices_en    text[] not null check (array_length(choices_en, 1) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  lang_only     text check (lang_only in ('fr', 'en')),  -- question intraduisible
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Parties
-- ------------------------------------------------------------------
create type public.match_kind as enum ('duo', 'group', 'card');

create table public.matches (
  id              uuid primary key default gen_random_uuid(),
  kind            public.match_kind not null,
  connection_id   uuid references public.connections(id) on delete cascade,
  group_id        uuid references public.groups(id) on delete cascade,
  theme_slug      text not null references public.themes(slug),
  question_ids    uuid[] not null check (array_length(question_ids, 1) = 5),
  opens_at        timestamptz not null,
  closes_at       timestamptz not null,
  card_multiplier int not null default 1 check (card_multiplier in (1, 2)),
  challenger      uuid references public.profiles(id) on delete set null,
  status          text not null default 'open' check (status in ('open', 'closed')),
  winner          uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  check ((connection_id is not null) <> (group_id is not null)),
  check (closes_at > opens_at)
);
create index matches_open_idx on public.matches (status, closes_at);

create table public.match_players (
  match_id    uuid not null references public.matches(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  started_at  timestamptz,
  finished_at timestamptz,
  total_ms    int not null default 0,
  points      int,
  rank        int,
  forfeit     boolean not null default false,
  joker_used  boolean not null default false,
  primary key (match_id, user_id)
);
create index match_players_user_idx on public.match_players (user_id);

create table public.answers (
  match_id       uuid not null,
  user_id        uuid not null,
  question_index smallint not null check (question_index between 0 and 4),
  choice_index   smallint check (choice_index between 0 and 3), -- null = temps écoulé
  sure           boolean not null default false,
  answered_ms    int not null default 0,
  is_correct     boolean not null,
  points         int,  -- calculé à la clôture (les mines ne sont connues qu'à la fin)
  created_at     timestamptz not null default now(),
  primary key (match_id, user_id, question_index),
  foreign key (match_id, user_id) references public.match_players(match_id, user_id) on delete cascade
);

-- Une mine par joueur et par partie : la clé primaire le garantit.
create table public.mines (
  match_id       uuid not null,
  user_id        uuid not null,
  question_index smallint not null check (question_index between 0 and 4),
  created_at     timestamptz not null default now(),
  primary key (match_id, user_id),
  foreign key (match_id, user_id) references public.match_players(match_id, user_id) on delete cascade
);

-- ------------------------------------------------------------------
-- Points bonus et cartes Who da Boss ?
-- ------------------------------------------------------------------
create table public.bonus_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  delta      int  not null,
  reason     text not null,
  match_id   uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.cards (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references public.profiles(id) on delete cascade,
  earned_at  timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 days'),
  used_at    timestamptz,
  match_id   uuid references public.matches(id) on delete set null
);

-- ------------------------------------------------------------------
-- Titres évolutifs (duo, groupe, mondial)
-- ------------------------------------------------------------------
create table public.title_holders (
  scope      text not null check (scope in ('duo', 'group', 'global')),
  scope_id   uuid,  -- connexion ou groupe ; null pour le mondial
  scope_key  uuid generated always as (coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  title_key  text not null,  -- most_sure_correct, most_sure_wrong, longest_streak_month, most_cards_won, theme_boss:<slug>
  period     text not null,  -- 'season-2026' ou '2026-11' pour L'Infatigable
  holder     uuid not null references public.profiles(id) on delete cascade,
  value      int  not null,
  updated_at timestamptz not null default now(),
  unique (scope, scope_key, title_key, period)
);

-- ------------------------------------------------------------------
-- Réactions GIF / photo, signalements, blocages (règle Apple 1.2)
-- ------------------------------------------------------------------
create table public.reactions (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('taquin', 'respect', 'boum', 'victoire')),
  storage_path text not null,
  hidden       boolean not null default false,  -- masquée par la modération
  updated_at   timestamptz not null default now(),
  primary key (user_id, kind)
);

create table public.reports (
  id            bigint generated always as identity primary key,
  reporter      uuid not null references public.profiles(id) on delete cascade,
  reported_user uuid not null references public.profiles(id) on delete cascade,
  reaction_kind text,
  reason        text,
  created_at    timestamptz not null default now(),
  handled_at    timestamptz
);

create table public.blocks (
  blocker    uuid not null references public.profiles(id) on delete cascade,
  blocked    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.push_tokens (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  platform   text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ------------------------------------------------------------------
-- Sécurité : RLS partout. Les écritures de jeu passent par les
-- fonctions « security definer » de 0002, jamais en direct.
-- ------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.themes        enable row level security;
alter table public.user_themes   enable row level security;
alter table public.connections   enable row level security;
alter table public.invites       enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.questions     enable row level security;
alter table public.matches       enable row level security;
alter table public.match_players enable row level security;
alter table public.answers       enable row level security;
alter table public.mines         enable row level security;
alter table public.bonus_ledger  enable row level security;
alter table public.cards         enable row level security;
alter table public.title_holders enable row level security;
alter table public.reactions     enable row level security;
alter table public.reports       enable row level security;
alter table public.blocks        enable row level security;
alter table public.push_tokens   enable row level security;

create or replace function public.is_match_player(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from match_players where match_id = p_match and user_id = auth.uid());
$$;

create or replace function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid());
$$;

create policy "profils lisibles" on public.profiles for select to authenticated using (true);
create policy "mon profil" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "modifier mon profil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "thèmes lisibles" on public.themes for select to authenticated using (true);
create policy "mes thèmes" on public.user_themes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "mes connexions" on public.connections for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy "quitter une connexion" on public.connections for delete to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "mes invitations" on public.invites for select to authenticated using (inviter = auth.uid());

create policy "mes groupes" on public.groups for select to authenticated using (public.is_group_member(id));
create policy "membres de mes groupes" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
create policy "quitter un groupe" on public.group_members for delete to authenticated using (user_id = auth.uid());

-- questions : aucune policy = aucun accès direct.

create policy "mes parties" on public.matches for select to authenticated using (public.is_match_player(id));
create policy "joueurs de mes parties" on public.match_players for select to authenticated
  using (public.is_match_player(match_id));

-- Réponses et mines des autres : visibles seulement après la clôture.
create policy "réponses" on public.answers for select to authenticated using (
  user_id = auth.uid()
  or (public.is_match_player(match_id)
      and exists (select 1 from public.matches m where m.id = match_id and m.status = 'closed'))
);
create policy "mines" on public.mines for select to authenticated using (
  user_id = auth.uid()
  or (public.is_match_player(match_id)
      and exists (select 1 from public.matches m where m.id = match_id and m.status = 'closed'))
);

create policy "mes points bonus" on public.bonus_ledger for select to authenticated using (user_id = auth.uid());
create policy "mes cartes" on public.cards for select to authenticated using (owner = auth.uid());

create policy "titres lisibles" on public.title_holders for select to authenticated using (
  scope = 'global'
  or (scope = 'group' and public.is_group_member(scope_id))
  or (scope = 'duo' and exists (select 1 from public.connections c
        where c.id = scope_id and auth.uid() in (c.user_a, c.user_b)))
);

create policy "réactions visibles" on public.reactions for select to authenticated using (
  user_id = auth.uid()
  or (not hidden and not exists (select 1 from public.blocks b
        where (b.blocker = auth.uid() and b.blocked = user_id)
           or (b.blocker = user_id and b.blocked = auth.uid())))
);
create policy "mes réactions" on public.reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "signaler" on public.reports for insert to authenticated with check (reporter = auth.uid());
create policy "mes blocages" on public.blocks for all to authenticated
  using (blocker = auth.uid()) with check (blocker = auth.uid());
create policy "mes jetons push" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Stockage des réactions : bucket privé « reactions », un dossier par joueur.
insert into storage.buckets (id, name, public) values ('reactions', 'reactions', false)
  on conflict (id) do nothing;

create policy "déposer mes réactions" on storage.objects for insert to authenticated
  with check (bucket_id = 'reactions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "remplacer mes réactions" on storage.objects for update to authenticated
  using (bucket_id = 'reactions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "supprimer mes réactions" on storage.objects for delete to authenticated
  using (bucket_id = 'reactions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "voir les réactions" on storage.objects for select to authenticated
  using (bucket_id = 'reactions');

-- Accès de l'API (protégé par les règles RLS ci-dessus). Explicite pour ne pas
-- dépendre du réglage « Grant API access to new tables » du projet.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
