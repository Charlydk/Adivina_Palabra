import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { useGameSounds } from '../hooks/useGameSounds';
import LivingHangman from '../components/LivingHangman';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, MessageSquare, Share2, CalendarDays, RotateCcw, Copy, Check, Clock, Volume2, VolumeX, Monitor, Users, Trophy } from 'lucide-react';
import { getRoomScoreboard, type ScoreboardEntry } from '../services/api';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateShareText(game: any, date: string): string {
  const errors = game.incorrectLetters?.length || 0;
  const maxErr = game.maxAttempts;
  const won = game.status === 'Won';
  const skulls = Array(maxErr).fill('⬜').map((_, i) => (i < errors ? '☠️' : '⬜')).join('');
  const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  return `🎃 AhorcadoPro Daily — ${dateStr}
📚 ${game.category}
${skulls}
${won ? '🏆 ¡VICTORIA!' : '💀 DERROTA'}

👉 Jugá en ahorcadopro.vercel.app`;
}

const MODE_LABEL: Record<string, string> = {
  Solo: 'Solitario',
  VersusLocal: 'Local Versus',
  OnlineCoop: 'Online Coop',
  OnlineVersus: 'Duelo Online',
};

const CATEGORY_LABEL: Record<string, string> = {
  ciencias_naturales: 'Ciencias Naturales',
  ciencias_sociales: 'Ciencias Sociales',
  lengua: 'Lengua',
  cultura_general: 'Cultura General',
  general: 'General',
};

const Game: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isDaily = searchParams.get('daily') === 'true';
  const dailyDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const alias = searchParams.get('alias') || localStorage.getItem('alias') || 'Invitado';
  const { game, messages, hint, definition, loading, sendLetter, sendMessage, requestHint, requestDefinition, nextRound } = useGame(gameId, alias);
  const { isMuted, toggleMute } = useGameSounds(game, alias);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sharedResult, setSharedResult] = useState(false);
  const definitionFired = useRef(false);
  // Track current word index so we reset definitionFired when a room advances to the next word
  const lastWordIndex = useRef<number>(-1);

  // Teacher monitoring
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [scoreboardUpdated, setScoreboardUpdated] = useState<Date | null>(null);

  // Variables derivadas — deben estar ANTES de cualquier useCallback/useEffect que las use
  const isOnline = game?.mode === 'OnlineVersus' || game?.mode === 'OnlineCoop';
  const isVersus = game?.mode === 'OnlineVersus';
  const isWaiting = game?.status === 'Waiting';
  const localIsP1 = alias === game?.player1Alias;

  // Classroom host: teacher joined as spectator — has HostAlias, alias matches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameAny = game as any;
  const isHost = gameAny?.hostAlias != null && alias === gameAny?.hostAlias;
  const classroomJoinCode: string | undefined = gameAny?.joinCode;

  // En Versus: cada jugador tiene su propio progreso. En Coop/Solo: pool compartido.
  const p1Guessed   = isVersus ? (game?.player1Progress ?? '') : (game?.guessedLetters ?? '');
  const p1Incorrect = isVersus ? (game?.player1Incorrect ?? '') : (game?.incorrectLetters ?? '');
  const p2Guessed   = isVersus ? (game?.player2Progress ?? '') : (game?.guessedLetters ?? '');
  const p2Incorrect = isVersus ? (game?.player2Incorrect ?? '') : (game?.incorrectLetters ?? '');

  // Teclado: muestra las letras ya usadas por el jugador local
  const guessedLetters  = isVersus ? (localIsP1 ? p1Guessed : p2Guessed) : (game?.guessedLetters ?? '');
  const incorrectLetters = isVersus ? (localIsP1 ? p1Incorrect : p2Incorrect) : (game?.incorrectLetters ?? '');

  const isMyTurn = !isOnline || game?.currentTurnAlias === alias;

  const rivalAlias = isVersus ? (localIsP1 ? game?.player2Alias : game?.player1Alias) : null;
  const rivalErrors = isVersus ? (localIsP1 ? p2Incorrect.length : p1Incorrect.length) : 0;

  const localWon = isVersus
    ? (game?.winnerAlias != null && game.winnerAlias === alias)
    : game?.status === 'Won';
  const gameEnded = game?.status !== 'InProgress' && game?.status !== 'Waiting';
  const localStatus = isVersus && gameEnded
    ? (localWon ? 'Won' : 'Lost')
    : (game?.status ?? 'InProgress');

  // Teacher monitoring mode: alias is 'Clase' in a room session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joinCode: string | undefined = (game as any)?.joinCode;
  const isTeacherMonitor = alias === 'Clase' && (game?.isRoom ?? false) && !!joinCode;

  // Poll scoreboard every 4s when teacher is monitoring
  useEffect(() => {
    if (!isTeacherMonitor || !joinCode || !gameId) return;
    const fetch = () =>
      getRoomScoreboard(joinCode, gameId)
        .then(data => { setScoreboard(data); setScoreboardUpdated(new Date()); })
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 4000);
    return () => clearInterval(id);
  }, [isTeacherMonitor, joinCode, gameId]);

  // Guardar resultado del daily en localStorage al terminar
  useEffect(() => {
    if (!isDaily || !game || game.status === 'InProgress' || game.status === 'Waiting' || sharedResult) return;
    const key = `daily_${dailyDate}`;
    if (!localStorage.getItem(key)) {
      const shareText = generateShareText(game, dailyDate);
      localStorage.setItem(key, JSON.stringify({
        date: dailyDate,
        won: game.status === 'Won',
        errors: game.incorrectLetters?.length || 0,
        maxAttempts: game.maxAttempts,
        shareText
      }));
      // Defer to avoid synchronous setState inside an effect
      const t = setTimeout(() => setSharedResult(true), 0);
      return () => clearTimeout(t);
    }
  }, [game?.status, isDaily, dailyDate, sharedResult]);

  // Teclado físico — skip if user is typing in a chat input or any input/textarea
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!game || game.status !== 'InProgress' || !isMyTurn) return;
    const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const key = e.key.toUpperCase();
    if (/^[A-Z]$/.test(key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      sendLetter(key);
    }
  }, [game, sendLetter, isMyTurn]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset definition tracking when a room advances to a new word
  useEffect(() => {
    if (!game?.isRoom) return;
    const idx = game.currentWordIndex ?? 0;
    if (idx !== lastWordIndex.current) {
      lastWordIndex.current = idx;
      definitionFired.current = false;
    }
  }, [game?.currentWordIndex, game?.isRoom]);

  // Request word definition automatically when the game ends (or a room round ends).
  // In rooms with a teacher-provided definition, currentDefinition is already set on the
  // GameSession — skip the AI call only when it's non-empty.
  useEffect(() => {
    if (!game || game.status === 'InProgress' || game.status === 'Waiting' || definitionFired.current) return;
    // For room sessions: if the server already sent a definition, no AI call needed
    if (game.isRoom && game.currentDefinition) {
      definitionFired.current = true;
      return;
    }
    definitionFired.current = true;
    requestDefinition('primaria');
  }, [game?.status, game?.currentWordIndex]);

  const handleShare = async () => {
    const text = generateShareText(game, dailyDate);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(text);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      alert(window.location.href);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) { sendMessage(chatInput); setChatInput(''); }
  };

  const displayWord = (progress: string) =>
    game.wordToGuess.split('').map((char: string, i: number) => (
      <span key={i} className="mx-1 border-b-4 border-halloween-orange min-w-[2rem] inline-block text-center text-4xl font-bold uppercase">
        {char === ' ' ? ' ' : progress.includes(char) ? char : ''}
      </span>
    ));

  if (loading || !game) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-halloween-orange" />
        <p className="mt-4 text-halloween-orange magic-title text-2xl">Invocando la partida...</p>
      </div>
    );
  }

  // Classroom host waiting room — teacher joined, students haven't arrived yet
  if (isHost && isWaiting) {
    const joinCode = classroomJoinCode;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full text-center"
      >
        <div className="bg-black bg-opacity-80 rounded-2xl border border-green-500 border-opacity-40 p-10 flex flex-col items-center gap-8">
          <div className="flex items-center gap-3 text-green-400">
            <Monitor size={40} className="animate-pulse" />
            <h2 className="magic-title text-4xl">Sala de Clase</h2>
          </div>

          <p className="text-gray-400 text-lg">
            Esperando que los <span className="text-white font-bold">alumnos se unan...</span>
          </p>

          {joinCode && (
            <div className="bg-gray-900 border-2 border-green-500 border-opacity-60 rounded-2xl px-12 py-8 w-full">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Código de la clase</p>
              <p className="font-mono text-7xl text-green-400 tracking-widest font-black">
                {joinCode}
              </p>
              <p className="text-gray-500 text-sm mt-4">Mostrá este código en el proyector</p>
            </div>
          )}

          <div className="flex flex-col gap-2 text-sm text-gray-500">
            {game?.player1Alias ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-gray-300">{game.player1Alias} — conectado</span>
              </div>
            ) : (
              <p>Esperando primer alumno...</p>
            )}
            {game?.player2Alias ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-gray-300">{game.player2Alias} — conectado</span>
              </div>
            ) : (
              <p>Esperando segundo alumno...</p>
            )}
          </div>

          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-400 text-sm transition flex items-center gap-1"
          >
            <RotateCcw size={14} />
            Cancelar y volver
          </button>
        </div>
      </motion.div>
    );
  }

  // Sala de espera — modo online, esperando Player 2
  if (isOnline && isWaiting) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <div className="bg-black bg-opacity-80 rounded-2xl border border-halloween-orange border-opacity-40 p-8 flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 text-halloween-orange">
            <Clock size={40} className="animate-pulse" />
            <h2 className="magic-title text-4xl">Sala de Espera</h2>
          </div>

          <p className="text-gray-400">
            Esperando que <span className="text-white font-bold">otro jugador</span> se una a la partida...
          </p>

          <div className="w-full bg-gray-900 rounded-xl p-4 text-left">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Compartí este link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-halloween-orange bg-black rounded px-3 py-2 truncate">
                {window.location.href}
              </code>
              <button
                onClick={handleCopyLink}
                className="bg-halloween-orange hover:bg-amber-600 text-white p-2 rounded-lg transition flex-shrink-0"
                title="Copiar link"
              >
                {linkCopied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            {linkCopied && (
              <p className="text-xs text-green-400 mt-2">¡Link copiado!</p>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>{game.player1Alias || alias} (vos) — conectado</span>
          </div>

          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-400 text-sm transition flex items-center gap-1"
          >
            <RotateCcw size={14} />
            Cancelar y volver
          </button>
        </div>
      </motion.div>
    );
  }

  const isOver = game.status !== 'InProgress' && game.status !== 'Waiting';

  // ── Teacher monitoring view ──────────────────────────────────────────────
  if (isTeacherMonitor) {
    const secondsAgo = scoreboardUpdated
      ? Math.round((Date.now() - scoreboardUpdated.getTime()) / 1000)
      : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl"
      >
        {/* Header */}
        <div className="bg-black bg-opacity-80 rounded-2xl border border-green-500 border-opacity-40 p-6 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Monitor size={28} className="text-green-400" />
              <div>
                <h1 className="magic-title text-2xl text-green-400">Panel de Clase</h1>
                <p className="text-gray-500 text-sm">{game.listName ?? 'Clase en vivo'}</p>
              </div>
            </div>
            {joinCode && (
              <div className="bg-gray-900 border border-green-700 rounded-xl px-6 py-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Código</p>
                <p className="font-mono text-3xl text-green-400 font-black tracking-widest">{joinCode}</p>
              </div>
            )}
          </div>
        </div>

        {/* Scoreboard */}
        <div className="bg-black bg-opacity-70 rounded-2xl border border-halloween-orange border-opacity-20 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-halloween-orange" />
              <span className="font-bold text-sm text-gray-300 uppercase tracking-widest">
                Alumnos — {scoreboard.length} conectado{scoreboard.length !== 1 ? 's' : ''}
              </span>
            </div>
            {secondsAgo !== null && (
              <span className="text-xs text-gray-600">
                actualizado hace {secondsAgo}s
              </span>
            )}
          </div>

          {scoreboard.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-gray-600">
              <Clock size={40} className="opacity-30 animate-pulse" />
              <p className="text-sm">Esperando que los alumnos ingresen el código...</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {scoreboard.map((entry, i) => {
                const pct = entry.totalWords > 0 ? (entry.wordsCompleted / entry.totalWords) * 100 : 0;
                const isCompleted = entry.status === 'Completed';
                const isLost = entry.status === 'Lost' && !isCompleted;
                return (
                  <div key={entry.alias} className="flex items-center gap-4 px-5 py-4">
                    {/* Rank */}
                    <div className="w-8 text-center">
                      {i === 0 && scoreboard.length > 1 ? (
                        <Trophy size={18} className="text-yellow-400 mx-auto" />
                      ) : (
                        <span className="text-gray-600 font-bold text-sm">{i + 1}</span>
                      )}
                    </div>

                    {/* Alias */}
                    <div className="w-32 font-bold text-white truncate">{entry.alias}</div>

                    {/* Progress bar + count */}
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                        <span>{entry.wordsCompleted} / {entry.totalWords} palabras</span>
                        <span className={entry.currentErrors >= entry.maxAttempts ? 'text-red-400' : 'text-gray-500'}>
                          {entry.currentErrors} error{entry.currentErrors !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-halloween-orange'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="w-24 text-right">
                      {isCompleted ? (
                        <span className="text-xs font-bold bg-green-900 text-green-300 px-2 py-1 rounded-full">✓ Terminó</span>
                      ) : isLost ? (
                        <span className="text-xs font-bold bg-red-950 text-red-400 px-2 py-1 rounded-full">× Sin intentos</span>
                      ) : (
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">Jugando…</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-400 text-sm transition flex items-center gap-1 mx-auto"
          >
            <RotateCcw size={14} />
            Volver al inicio
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <>
    <div className="flex flex-col w-full max-w-5xl gap-4">

      {/* ── HERO: imagen principal + palabra ── */}
      <div className="bg-black bg-opacity-60 rounded-xl border border-halloween-orange border-opacity-20 overflow-hidden">
        {isDaily && (
          <div className="flex justify-center pt-3">
            <div className="flex items-center gap-1 bg-halloween-orange bg-opacity-20 border border-halloween-orange border-opacity-40 px-3 py-1 rounded-full">
              <CalendarDays size={14} className="text-halloween-orange" />
              <span className="text-xs font-bold text-halloween-orange uppercase tracking-widest">Daily Challenge</span>
            </div>
          </div>
        )}
        <LivingHangman
          key={`hero-${game?.currentWordIndex ?? 0}`}
          errors={isVersus ? (localIsP1 ? p1Incorrect.length : p2Incorrect.length) : p1Incorrect.length}
          maxErrors={game.maxAttempts}
          status={localStatus}
          size="full"
        />
        {!isOver && (
          <div className="px-6 pt-4 pb-5 flex flex-wrap justify-center gap-2">
            {displayWord(isVersus ? (localIsP1 ? p1Guessed : p2Guessed) : p1Guessed)}
          </div>
        )}
      </div>

      {/* ── CONTROLES: 3 columnas en desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Izquierda: info del jugador */}
        <div className="bg-black bg-opacity-60 p-4 rounded-xl border border-halloween-orange border-opacity-20 flex flex-col items-center gap-3">
          <h3 className="text-lg font-bold text-halloween-orange">
            {isVersus
              ? `${localIsP1 ? game.player1Alias : game.player2Alias} (vos)`
              : (game.player1Alias || alias)}
          </h3>
          <p className="text-sm text-gray-400">
            {incorrectLetters.length} / {game.maxAttempts} errores
          </p>
          {incorrectLetters.length > 0 && (
            <p className="text-xl text-red-500 tracking-widest font-bold">{incorrectLetters}</p>
          )}

          {/* Rival en versus */}
          {isVersus && game.player2Alias && (
            <div className="mt-2 border-t border-gray-700 pt-3 w-full flex flex-col items-center gap-2">
              <h4 className="text-sm font-bold text-halloween-orange">{rivalAlias} (rival)</h4>
              <LivingHangman
                size="sm"
                errors={rivalErrors}
                maxErrors={game.maxAttempts}
                status={localWon ? 'Lost' : (isOver ? 'Won' : game.status)}
              />
              <p className="text-xs text-gray-500">{rivalErrors} / {game.maxAttempts} errores</p>
            </div>
          )}
          {isVersus && isOnline && !game.player2Alias && (
            <div className="flex flex-col items-center gap-2 text-gray-600 mt-2">
              <Clock size={24} className="opacity-40" />
              <p className="text-xs">Esperando rival...</p>
            </div>
          )}
        </div>

        {/* Centro: teclado + controles */}
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="text-center w-full">
            <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                {CATEGORY_LABEL[game.category] ?? game.category}
              </span>
              <span className="text-xs text-gray-600">{MODE_LABEL[game.mode] ?? game.mode}</span>
              {isOver && (
                <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${
                  localWon ? 'bg-green-900 text-green-400' : 'bg-red-950 text-red-400'
                }`}>
                  {localWon ? '¡Ganaste!' : '¡Perdiste!'}
                </span>
              )}
            </div>

            {isOnline && !isOver && (
              <div className={`mb-2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest inline-block ${
                isMyTurn
                  ? 'bg-halloween-orange border border-halloween-orange text-white animate-pulse'
                  : 'bg-gray-800 border border-gray-600 text-gray-400'
              }`}>
                {isMyTurn ? '¡Tu turno!' : `Turno de ${game.currentTurnAlias}`}
              </div>
            )}

            {game?.isRoom && (
              <div className="mb-2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest inline-block bg-green-900 bg-opacity-40 border border-green-700 text-green-300">
                Palabra {(game.currentWordIndex ?? 0) + 1} de {game.totalWords ?? '?'}
              </div>
            )}

            {!isOver && (
              <button
                onClick={() => requestHint('primaria')}
                className="mt-1 flex items-center gap-2 bg-purple-900 bg-opacity-40 border border-purple-500 text-purple-200 rounded-full hover:bg-opacity-60 transition mx-auto px-4 py-1 text-xs"
              >
                <Sparkles size={14} />
                Pedir Pista (IA)
              </button>
            )}
            {hint && !isOver && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 bg-purple-900 bg-opacity-20 border border-purple-500/30 p-3 rounded-lg max-w-xs text-sm italic text-purple-200 mx-auto"
              >
                "{hint}"
              </motion.div>
            )}
          </div>

          {/* Teclado virtual */}
          {!isOver && !isHost && (
            <div className="w-full max-w-xs">
              <div className={`flex flex-wrap justify-center gap-1 mb-3 ${!isMyTurn ? 'opacity-40 pointer-events-none' : ''}`}>
                {ALPHABET.map((letter) => {
                  const isGuessed = (guessedLetters || '').includes(letter);
                  const isWrong = (incorrectLetters || '').includes(letter);
                  return (
                    <button
                      key={letter}
                      onClick={() => sendLetter(letter)}
                      disabled={isGuessed || isWrong || !isMyTurn}
                      className={`rounded font-bold transition w-9 h-9 text-sm ${
                        isWrong
                          ? 'bg-red-900 text-red-400 opacity-50 cursor-not-allowed'
                          : isGuessed
                          ? 'bg-green-900 text-green-400 opacity-50 cursor-not-allowed'
                          : 'bg-gray-800 hover:bg-halloween-orange hover:text-white text-gray-200'
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
              <p className="text-center text-xs text-gray-600">También podés usar el teclado físico</p>
            </div>
          )}

          {/* Panel proyección docente */}
          {!isOver && isHost && (
            <div className="w-full max-w-xs flex flex-col items-center gap-4">
              {classroomJoinCode && (
                <div className="bg-gray-900 border border-green-700 rounded-xl px-6 py-4 text-center w-full">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Código de la clase</p>
                  <p className="font-mono text-4xl text-green-400 tracking-widest font-black">{classroomJoinCode}</p>
                </div>
              )}
              <div className="bg-gray-900 border border-gray-700 rounded-xl px-6 py-4 text-center w-full">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Alumnos conectados</p>
                <div className="flex flex-col gap-1 text-sm">
                  {game?.player1Alias ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-gray-300">{game.player1Alias}</span>
                    </div>
                  ) : <p className="text-gray-600">Esperando primer alumno...</p>}
                  {game?.player2Alias ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-gray-300">{game.player2Alias}</span>
                    </div>
                  ) : <p className="text-gray-600">Esperando segundo alumno...</p>}
                </div>
              </div>
              {game?.currentTurnAlias && (
                <div className="bg-halloween-orange bg-opacity-20 border border-halloween-orange border-opacity-40 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest text-halloween-orange">
                  Turno de {game.currentTurnAlias}
                </div>
              )}
              <p className="text-xs text-gray-600 italic text-center">Los alumnos juegan desde sus dispositivos</p>
            </div>
          )}

          {/* Resultado final */}
          <AnimatePresence>
            {isOver && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-4 w-full"
              >
                <div className={`magic-title ${localWon ? 'text-green-400' : 'text-red-600'} text-4xl`}>
                  {localWon ? '¡VICTORIA!' : '¡PERDISTE!'}
                </div>
                {!localWon && (
                  <div className="text-center">
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">La palabra era</p>
                    <p className="text-halloween-orange font-black uppercase tracking-wider text-2xl">
                      {game.wordToGuess}
                    </p>
                  </div>
                )}
                {(game?.isRoom ? (game.currentDefinition || definition) : definition) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm bg-gray-900 bg-opacity-90 border border-purple-500 border-opacity-50 rounded-xl p-5 text-left"
                  >
                    <p className="text-purple-300 font-bold text-xs uppercase tracking-widest mb-3">
                      📚 Definición
                    </p>
                    <p className="text-gray-100 leading-relaxed text-sm">
                      {game?.isRoom && game.currentDefinition ? game.currentDefinition : definition?.definition}
                    </p>
                    {!game?.isRoom && definition?.bonus && (
                      <p className="mt-3 italic text-yellow-300 text-xs">
                        {definition.bonus}
                      </p>
                    )}
                  </motion.div>
                )}

                {game?.isRoom && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 w-full max-w-sm"
                  >
                    {game.roomCompleted ? (
                      <div className="text-center flex flex-col items-center gap-3">
                        <p className="magic-title text-green-400 text-3xl">
                          ¡Terminaron la lista!
                        </p>
                        <p className="text-gray-400 text-sm">
                          Completaron <span className="text-white font-bold">{game.listName}</span> — {game.totalWords} palabra{game.totalWords !== 1 ? 's' : ''}
                        </p>
                        <button
                          onClick={() => navigate('/')}
                          className="flex items-center gap-2 bg-halloween-orange text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-600 transition mt-2"
                        >
                          <RotateCcw size={16} />
                          Volver al inicio
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={nextRound}
                        className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white font-black uppercase tracking-widest rounded-xl transition py-3"
                      >
                        Siguiente palabra →
                      </button>
                    )}
                  </motion.div>
                )}

                {!game?.isRoom && (
                  <div className="flex gap-3">
                    {isDaily && (
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-2 bg-halloween-orange text-white font-bold px-5 py-2 rounded-xl hover:bg-amber-600 transition"
                      >
                        <Share2 size={16} />
                        {copied ? '¡Copiado!' : 'Compartir'}
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/')}
                      className="flex items-center gap-2 bg-gray-800 text-gray-300 font-bold px-5 py-2 rounded-xl hover:bg-gray-700 transition"
                    >
                      <RotateCcw size={16} />
                      Volver
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Derecha: chat */}
        <div className="flex flex-col gap-4">
          {game.mode !== 'Solo' && (
            <div className="bg-black bg-opacity-80 rounded-xl border border-gray-700 h-72 flex flex-col overflow-hidden">
              <div className="bg-gray-800 p-3 flex items-center gap-2 border-b border-gray-700">
                <MessageSquare size={16} className="text-halloween-orange" />
                <span className="font-bold text-sm text-gray-200">Chat</span>
              </div>
              <div className="flex-grow overflow-y-auto p-3 space-y-2 flex flex-col">
                {messages.map((msg, i) => (
                  <div key={i} className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.alias === alias ? 'bg-halloween-orange self-end text-white' : 'bg-gray-700 self-start text-gray-200'}`}>
                    <span className="block text-[10px] opacity-70 mb-1">{msg.alias}</span>
                    {msg.text}
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="p-2 bg-gray-900 flex gap-1 border-t border-gray-800">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-grow bg-gray-800 text-xs px-3 py-2 rounded focus:outline-none"
                  placeholder="Escribe un mensaje..."
                />
                <button type="submit" className="bg-halloween-orange p-2 rounded">
                  <Send size={14} className="text-white" />
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>

    {/* Botón mute — esquina inferior derecha */}
    <button
      onClick={toggleMute}
      title={isMuted ? 'Activar sonido' : 'Silenciar'}
      className="fixed bottom-6 right-6 z-50 bg-black bg-opacity-70 hover:bg-opacity-90 border border-halloween-orange border-opacity-40 text-halloween-orange p-3 rounded-full transition-all shadow-lg"
    >
      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
    </>
  );
};

export default Game;
