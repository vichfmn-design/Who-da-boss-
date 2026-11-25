// Notifie les autres joueurs d'une partie : « Victor a joué. À toi ! »
// ou « Révélation ! » quand tout le monde a fini.
// Appelée par l'app juste après finish_my_match.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Body = { match_id: string };

const TEXTS = {
  fr: { played: (p: string) => `${p} a joué. À toi !`, reveal: 'Révélation ! Viens voir qui est le boss.' },
  en: { played: (p: string) => `${p} has played. Your turn!`, reveal: 'Results are in! Come see who da boss.' },
};

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response('Non connecté', { status: 401 });

  const { match_id } = (await req.json()) as Body;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: players } = await admin
    .from('match_players')
    .select('user_id, finished_at, profiles(pseudo, lang)')
    .eq('match_id', match_id);
  if (!players || !players.some((p) => p.user_id === user.id)) {
    return new Response('Partie introuvable', { status: 404 });
  }

  const { data: match } = await admin.from('matches').select('status').eq('id', match_id).single();
  const me = players.find((p) => p.user_id === user.id)!;
  // deno-lint-ignore no-explicit-any
  const myPseudo = (me.profiles as any)?.pseudo ?? '?';

  const targets = players.filter((p) =>
    p.user_id !== user.id && (match?.status === 'closed' || !p.finished_at));

  const messages = [];
  for (const t of targets) {
    // deno-lint-ignore no-explicit-any
    const lang = ((t.profiles as any)?.lang ?? 'fr') as 'fr' | 'en';
    const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', t.user_id);
    for (const { token } of tokens ?? []) {
      messages.push({
        to: token,
        title: 'Who da Boss ?',
        body: match?.status === 'closed' ? TEXTS[lang].reveal : TEXTS[lang].played(myPseudo),
        data: { match_id },
        sound: 'default',
      });
    }
  }

  if (messages.length > 0) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  }
  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
