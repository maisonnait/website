'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/theme';

/** Start of each shot, in seconds; the film lasts 26 seconds. */
const CUES = [0, 5, 10.5, 16, 21.5] as const;
const DURATION = 26;
/** The still frame shows the fourth shot. */
const POSTER_CUE = 3;

export interface FilmTexts {
  /** One caption per shot. */
  captions: string[];
  play: string;
  pause: string;
  soundOn: string;
  soundOff: string;
  /** "Synthetic voice-over." */
  voice: string;
}

/**
 * The house film. Silent, it starts by itself when it is on screen and loops; the sound is
 * only ever turned on by the visitor, and then the film plays once from its first word.
 * `cut` is the language of the voice-over: fr, en or ar (Darija and Tamazight use the Arabic cut).
 */
export function Film({ cut, texts }: { cut: 'fr' | 'en' | 'ar'; texts: FilmTexts }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [heard, setHeard] = useState(false);
  const [cue, setCue] = useState(POSTER_CUE);
  const [caption, setCaption] = useState(POSTER_CUE);
  const [failed, setFailed] = useState(false);

  // Mutable state read by the observers and the frame loop.
  const live = useRef({ userPaused: false, sound: false, cue: POSTER_CUE });

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.preload === 'none') video.preload = 'auto';
    video.play().catch((error: unknown) => {
      // A browser that refuses sound still gets the silent film.
      if (!live.current.sound || (error as { name?: string } | null)?.name !== 'NotAllowedError') return;
      live.current.sound = false;
      setSound(false);
      video.muted = true;
      video.loop = true;
      video.play().catch(() => {});
    });
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const go = () => {
      try {
        video.currentTime = seconds + 0.03;
      } catch {
        // not seekable yet
      }
    };
    if (video.readyState >= 1) go();
    else video.addEventListener('loadedmetadata', go, { once: true });
  };

  // Progress line and current shot, while the film runs.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let raf = 0;
    const loop = () => {
      raf = 0;
      const time = video.currentTime || 0;
      fillRef.current?.style.setProperty('--v', Math.min(1, Math.max(0, time / DURATION)).toFixed(4));
      let index = 0;
      for (let k = 0; k < CUES.length; k++) if (time >= CUES[k]! - 0.08) index = k;
      if (index !== live.current.cue) {
        live.current.cue = index;
        setCue(index);
      }
      if (!video.paused) raf = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      setPlaying(true);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onPause = () => setPlaying(false);
    const onSeeked = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onEnded = () => {
      live.current.userPaused = true;
    };
    const onError = () => setFailed(true);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Silent autoplay on screen; off screen the film always stops.
  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            if (!reduced && !live.current.userPaused && !live.current.sound) play();
          } else if (!entry.isIntersecting && !video.paused) {
            video.pause();
            if (live.current.sound) live.current.userPaused = true;
          }
        }
      },
      { threshold: [0, 0.55] },
    );
    observer.observe(frame);
    return () => observer.disconnect();
    // `play` only reads refs, so it does not belong to the dependencies.
  }, [reduced]);

  // The caption dips out while its words change.
  useEffect(() => {
    if (cue === caption) return;
    if (reduced) {
      setCaption(cue);
      return;
    }
    const timer = window.setTimeout(() => setCaption(cue), 300);
    return () => window.clearTimeout(timer);
  }, [cue, caption, reduced]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      live.current.userPaused = false;
      play();
    } else {
      live.current.userPaused = true;
      video.pause();
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !live.current.sound;
    live.current.sound = next;
    setSound(next);
    setHeard(true);
    video.muted = !next;
    video.loop = !next; // with the voice on, the film plays once and rests on the name
    if (next) {
      live.current.userPaused = false;
      seek(0); // the voice-over is heard from its first word
      play();
    }
  };

  const jump = (index: number) => {
    live.current.userPaused = false;
    play();
    seek(CUES[index]!);
  };

  // A film that cannot load takes its section with it.
  useEffect(() => {
    const section = frameRef.current?.closest('section');
    if (section) section.hidden = failed;
  }, [failed]);

  return (
    <div className={`film__frame ${playing ? 'is-playing' : ''} ${heard ? 'has-heard' : ''}`}>
      <div className="film__stage">
        <div className="film__clip cham ring" ref={frameRef}>
          <video
            ref={videoRef}
            src={`/media/film-${cut}.mp4`}
            poster="/media/film.jpg"
            muted
            loop
            playsInline
            preload="none"
            tabIndex={-1}
          />
        </div>
        <p className={`film__cap ${cue !== caption ? 'is-out' : ''}`} aria-live="off">
          {texts.captions[caption]}
        </p>
      </div>
      <div className="film__ctrl">
        <button className="film__btn cham" type="button" aria-label={playing ? texts.pause : texts.play} onClick={togglePlay}>
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 2h3.6v12H3zM9.4 2H13v12H9.4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 1.5v13l11-6.5z" />
            </svg>
          )}
        </button>
        <div className="film__track">
          <i ref={fillRef} />
          {CUES.map((seconds, index) => (
            <button
              key={seconds}
              className={`film__tick ${index === cue ? 'is-on' : ''}`}
              type="button"
              style={{ '--at': `${((seconds / DURATION) * 100).toFixed(2)}%` } as React.CSSProperties}
              aria-label={`${index + 1}. ${texts.captions[index] ?? ''}`}
              aria-current={index === cue ? 'true' : undefined}
              onClick={() => jump(index)}
            />
          ))}
        </div>
        <button
          className="film__btn film__btn--sound cham"
          type="button"
          aria-pressed={sound}
          aria-label={sound ? texts.soundOff : texts.soundOn}
          onClick={toggleSound}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.5 6h3L8.6 2.6v10.8L4.5 10h-3z" />
            {sound ? (
              <path className="ln" d="M10.8 5.7a3.3 3.3 0 0 1 0 4.6M12.7 3.7a6.1 6.1 0 0 1 0 8.6" />
            ) : (
              <path className="ln" d="M11 6l3.6 4M14.6 6 11 10" />
            )}
          </svg>
        </button>
      </div>
      <p className="film__note">{texts.voice}</p>
    </div>
  );
}
