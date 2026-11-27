// Vidéo d'explosion plein écran (faite avec Midjourney) jouée par-dessus l'app, sur le web.
// Préchargée dès l'affichage de la page ; play() la lance depuis le début et appelle onEnd à la fin.
// Sur l'app iPhone native (pas encore de lecteur vidéo installé), play() renvoie false : on enchaîne direct.
import { createElement, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type BoomVideoHandle = { play: () => boolean };

type Props = { src: string; onEnd: () => void; background?: string; maxMs?: number };

export const BoomVideo = forwardRef<BoomVideoHandle, Props>(function BoomVideo({ src, onEnd, background = '#FAE04D', maxMs = 3500 }, ref) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    if (timer.current) clearTimeout(timer.current);
    onEnd();
    setTimeout(() => setVisible(false), 400);
  };

  useImperativeHandle(ref, () => ({
    play: () => {
      const v = video.current;
      if (Platform.OS !== 'web' || !v) return false;
      done.current = false;
      setVisible(true);
      try {
        v.currentTime = 0;
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => finish());
      } catch { finish(); }
      timer.current = setTimeout(finish, maxMs); // filet de sécurité si la vidéo ne se termine pas
      return true;
    },
  }));

  if (Platform.OS !== 'web') return null;
  return createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 9999, background, pointerEvents: visible ? 'auto' : 'none',
      opacity: visible ? 1 : 0, transition: 'opacity 120ms ease-out', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
  }, createElement('video', {
    ref: video, src, muted: true, playsInline: true, preload: 'auto', onEnded: finish, onError: () => visible && finish(),
    'aria-hidden': true,
    style: { width: '100%', height: '100%', objectFit: 'cover' },
  }));
});
