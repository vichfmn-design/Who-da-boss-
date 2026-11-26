-- Banque de 1 000 questions relues (v0.2) : référence, explication affichée à la révélation.
-- Les données sont dans supabase/questions/banque-v0.2.json ; les 31 questions de test sont désactivées.
alter table public.questions add column if not exists ref text unique;
alter table public.questions add column if not exists explanation_fr text;
alter table public.questions add column if not exists explanation_en text;
update public.questions set active = false where ref is null;
-- get_reveal renvoie aussi 'explanation' pour chaque question (voir le projet Supabase).
