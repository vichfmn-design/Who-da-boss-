// Adresse temporaire (1 h) d'un selfie de mine stocké dans l'espace privé « mine-selfies ».
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useSelfieUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    supabase.storage.from('mine-selfies').createSignedUrl(path, 3600)
      .then(({ data }) => { if (alive) setUrl(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [path]);
  return url;
}

export async function uploadSelfie(userId: string, blob: Blob, previous?: string | null): Promise<string> {
  const path = `${userId}/selfie-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('mine-selfies').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.from('profiles').update({ mine_selfie: path }).eq('id', userId);
  if (e2) throw new Error(e2.message);
  if (previous) supabase.storage.from('mine-selfies').remove([previous]).then(() => {});
  return path;
}
