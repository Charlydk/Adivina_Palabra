import { useEffect, useRef, useState } from 'react';

function makeAudio(src: string, loop = false, volume = 1) {
  const a = new Audio(src);
  a.loop = loop;
  a.volume = volume;
  return a;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useGameSounds(game: any, alias?: string) {
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);

  const bg = useRef<HTMLAudioElement | null>(null);
  const sfxOk = useRef<HTMLAudioElement | null>(null);
  const sfxWrong = useRef<HTMLAudioElement | null>(null);
  const sfxWin = useRef<HTMLAudioElement | null>(null);
  const sfxLose = useRef<HTMLAudioElement | null>(null);
  const sfxLast = useRef<HTMLAudioElement | null>(null);

  const prevStatus = useRef<string | null>(null);
  const prevIncorrect = useRef(0);
  const prevGuessed = useRef(0);
  const lastFired = useRef(false);

  useEffect(() => {
    bg.current = makeAudio('/sounds/musica_fondo_intro.mp3', true, 0.25);
    sfxOk.current = makeAudio('/sounds/acierto_letra.mp3', false, 0.75);
    sfxWrong.current = makeAudio('/sounds/error_letra.mp3', false, 0.75);
    sfxWin.current = makeAudio('/sounds/triunfo.mp3', false, 0.3);
    sfxLose.current = makeAudio('/sounds/derrota.mp3', false, 0.85);
    sfxLast.current = makeAudio('/sounds/ultimo_intento.mp3', false, 0.85);
    return () => { bg.current?.pause(); };
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
    [bg, sfxOk, sfxWrong, sfxWin, sfxLose, sfxLast].forEach(
      (r) => { if (r.current) r.current.muted = isMuted; }
    );
  }, [isMuted]);

  const play = (audio: HTMLAudioElement | null) => {
    if (!audio || isMutedRef.current) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    if (!game) return;

    const isVersus = game.mode === 'OnlineVersus';
    const localIsP1 = alias === game.player1Alias;
    const incorrectLen = isVersus
      ? (localIsP1 ? game.player1Incorrect?.length || 0 : game.player2Incorrect?.length || 0)
      : game.incorrectLetters?.length || 0;
    const guessedLen = isVersus
      ? (localIsP1 ? game.player1Progress?.length || 0 : game.player2Progress?.length || 0)
      : game.guessedLetters?.length || 0;
    const remainingAttempts = isVersus
      ? (localIsP1 ? game.player1RemainingAttempts : game.player2RemainingAttempts)
      : game.remainingAttempts;

    const status = game.status as string;

    if (status !== prevStatus.current) {
      if (status === 'InProgress') {
        lastFired.current = false;
        bg.current?.play().catch(() => {});
      }
      if (status === 'Won' || status === 'Lost') {
        bg.current?.pause();
        const localWon = status === 'Won' && (!isVersus || game.winnerAlias === alias);
        play(localWon ? sfxWin.current : sfxLose.current);
      }
      prevStatus.current = status;
    }

    if (incorrectLen > prevIncorrect.current) play(sfxWrong.current);
    if (guessedLen > prevGuessed.current) play(sfxOk.current);
    prevIncorrect.current = incorrectLen;
    prevGuessed.current = guessedLen;

    if (remainingAttempts === 1 && status === 'InProgress' && !lastFired.current) {
      play(sfxLast.current);
      lastFired.current = true;
    }
  }, [game]);

  return { isMuted, toggleMute: () => setIsMuted((m) => !m) };
}
