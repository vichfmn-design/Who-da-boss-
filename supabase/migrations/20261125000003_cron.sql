-- Tâches automatiques (pg_cron, disponible sur Supabase).
-- Toutes les 10 minutes : clore les parties terminées, ouvrir celles du jour.
-- Toutes les heures : recalculer les titres.

create extension if not exists pg_cron;

select cron.schedule('wdb-tick', '*/10 * * * *', $$select public.tick();$$);
select cron.schedule('wdb-titles', '7 * * * *', $$select public.refresh_titles();$$);
