import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  User, Users, Zap, Sparkles, BookOpen,
  LogIn, Gamepad2, ArrowLeft, GraduationCap,
  BookMarked, Plus, Play, Eye, EyeOff,
} from 'lucide-react';
import { joinRoom as joinRoomApi } from '../services/api';
import { useAuth } from '../context/useAuth';

interface GameMode {
  id: number;
  name: string;
  Icon: LucideIcon;
  desc: string;
  border: string;
  iconBg: string;
  iconText: string;
  btnBg: string;
}

const MODES: GameMode[] = [
  {
    id: 0, name: 'Solitario', Icon: User,
    desc: 'Jugá solo a tu ritmo. Cada error acerca al dragón un poco más.',
    border: 'border-blue-500/40', iconBg: 'bg-blue-900/40', iconText: 'text-blue-400', btnBg: 'bg-blue-600 hover:bg-blue-500',
  },
  {
    id: 1, name: 'Versus Local', Icon: Gamepad2,
    desc: 'Escribí una palabra secreta y pasale el dispositivo a tu compañero para que la adivine.',
    border: 'border-purple-500/40', iconBg: 'bg-purple-900/40', iconText: 'text-purple-400', btnBg: 'bg-purple-600 hover:bg-purple-500',
  },
  {
    id: 2, name: 'Online Coop', Icon: Users,
    desc: 'Jugá con un amigo online. Colaboren para adivinar la misma palabra juntos.',
    border: 'border-green-500/40', iconBg: 'bg-green-900/40', iconText: 'text-green-400', btnBg: 'bg-green-600 hover:bg-green-500',
  },
  {
    id: 3, name: 'Duelo Online', Icon: Zap,
    desc: 'Carrera online contra otro jugador. El primero en adivinar la palabra gana.',
    border: 'border-amber-500/40', iconBg: 'bg-amber-900/40', iconText: 'text-amber-400', btnBg: 'bg-amber-600 hover:bg-amber-500',
  },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'ciencias_naturales', label: 'Ciencias Naturales' },
  { value: 'ciencias_sociales', label: 'Ciencias Sociales' },
  { value: 'lengua', label: 'Lengua' },
];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Coming back from a game: jump straight to mode selection (and optionally the
  // Versus Local secret-word modal) instead of replaying the intro video.
  const navState = location.state as { step?: number; openVersusWord?: boolean } | null;
  const aliasStored = localStorage.getItem('alias') || '';
  const skipToModes = (navState?.step === 2 || navState?.openVersusWord === true) && aliasStored.length > 0;

  const [step, setStep] = useState<0 | 1 | 2>(skipToModes ? 2 : 0);
  const [videoLeaving, setVideoLeaving] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [alias, setAlias] = useState(localStorage.getItem('alias') || '');
  const [category, setCategory] = useState('');
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [flippedCard, setFlippedCard] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [showVersusWord, setShowVersusWord] = useState(navState?.openVersusWord === true && aliasStored.length > 0);
  const [versusWord, setVersusWord] = useState('');
  const [revealWord, setRevealWord] = useState(false);

  const hasAlias = alias.trim().length > 0;

  // Keep only letters the in-game keyboard supports (A-Z + spaces).
  // Uppercases and strips accents; Ñ collapses to N (the keyboard has no Ñ).
  const sanitizeWord = (raw: string) =>
    raw
      .toUpperCase()
      .normalize('NFD')        // split accented letters into base + combining mark
      .replace(/[^A-Z ]/g, '') // drop combining marks, digits, punctuation, Ñ→N happens via base char
      .replace(/\s+/g, ' ');

  const cleanVersusWord = sanitizeWord(versusWord).trim();
  const versusWordValid = cleanVersusWord.replace(/ /g, '').length >= 3;

  const goToModes = () => {
    if (!hasAlias) return;
    localStorage.setItem('alias', alias.trim());
    setStep(2);
  };

  // Versus Local always lets one player set a secret word for the other to guess.
  const handleModeClick = (mode: number) => {
    if (mode === 1) {
      setVersusWord('');
      setRevealWord(false);
      setShowVersusWord(true);
      return;
    }
    startGame(mode);
  };

  const startGame = async (mode: number, customWord?: string) => {
    setLoading(true);
    try {
      const response = await api.post('/games/create', {
        mode,
        alias: alias.trim(),
        maxAttempts: 6,
        theme: customWord ? null : theme.trim() || null,
        category: customWord ? null : category || null,
        profile: 'primaria',
        word: customWord || null,
      });
      // Pass alias via router state (not the URL) so it never leaks through the shared link.
      navigate(`/game/${response.data.id}`, { state: { alias: alias.trim() } });
    } catch (err) {
      console.error(err);
      alert('Error al crear la partida. ¿Está el backend encendido?');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('El código debe tener exactamente 6 caracteres.');
      return;
    }
    setJoinLoading(true);
    try {
      const result = await joinRoomApi(code, alias.trim());
      navigate(`/game/${result.gameId}`, { state: { alias: alias.trim() } });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 404) {
        setJoinError('Código inválido o sala expirada.');
      } else {
        setJoinError('No se pudo conectar. ¿Está el servidor encendido?');
      }
    } finally {
      setJoinLoading(false);
    }
  };

  // ── Teacher portal — shown when a docente is logged in ───────────────────
  if (user) {
    const username = user.user_metadata?.username
      ?? user.email?.split('@')[0]
      ?? 'Docente';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full flex flex-col gap-6"
      >
        {/* Greeting */}
        <div className="text-center">
          <GraduationCap size={48} className="text-halloween-orange mx-auto mb-3" />
          <h2 className="magic-title text-3xl text-halloween-orange">Portal Docente</h2>
          <p className="text-gray-400 mt-1">Bienvenido/a, <span className="text-white font-bold">{username}</span></p>
        </div>

        {/* Actions */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/create-room')}
          className="w-full bg-black/60 rounded-2xl border-2 border-halloween-orange/50 hover:border-halloween-orange transition-all flex items-center gap-5 p-6 group"
        >
          <div className="bg-halloween-orange/20 rounded-full p-4 group-hover:bg-halloween-orange/30 transition">
            <Plus size={28} className="text-halloween-orange" />
          </div>
          <div className="text-left">
            <h3 className="font-black text-white uppercase tracking-widest text-base">Crear nueva sala</h3>
            <p className="text-gray-400 text-sm mt-0.5">Cargá tu lista de palabras y compartí el código con la clase</p>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/teacher/lists')}
          className="w-full bg-black/60 rounded-2xl border-2 border-green-700/50 hover:border-green-500 transition-all flex items-center gap-5 p-6 group"
        >
          <div className="bg-green-900/40 rounded-full p-4 group-hover:bg-green-800/60 transition">
            <BookMarked size={28} className="text-green-400" />
          </div>
          <div className="text-left">
            <h3 className="font-black text-white uppercase tracking-widest text-base">Mis listas guardadas</h3>
            <p className="text-gray-400 text-sm mt-0.5">Revisá, reutilizá o editá tus listas anteriores</p>
          </div>
        </motion.button>

        <p className="text-center text-gray-700 text-xs">
          Para jugar como alumno, cerrá sesión desde el menú superior.
        </p>
      </motion.div>
    );
  }

  // ── Step 0: Video intro ─────────────────────────────────────────────────
  const advanceFromVideo = () => {
    if (videoLeaving) return;
    setVideoLeaving(true);
    setTimeout(() => { setStep(1); setVideoLeaving(false); }, 700);
  };

  const startVideo = () => {
    setVideoStarted(true);
    videoRef.current?.play();
  };

  if (step === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: videoLeaving ? 0 : 1 }}
        transition={{ duration: 0.65, ease: 'easeInOut' }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        <video
          ref={videoRef}
          src="/Video/Introvideo.mp4"
          playsInline
          className="w-full h-full object-contain"
          onEnded={advanceFromVideo}
        />

        {/* UTN credit — discreet overlay in the top-left corner */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 rounded-lg px-3 py-1.5 pointer-events-none">
          <img src="/img/logo_utn.png" alt="Universidad Tecnológica Nacional" className="h-8 w-auto opacity-90" />
          <p className="text-gray-300 text-[10px] leading-tight max-w-[140px]">
            Desarrollado por Fabián Bernardino — Tecnología Educativa I, UTN
          </p>
        </div>

        {/* Pre-start overlay — click triggers user gesture so audio works */}
        {!videoStarted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 cursor-pointer"
            onClick={startVideo}
          >
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="bg-halloween-orange/90 hover:bg-amber-500 rounded-full p-7 shadow-2xl transition-colors"
            >
              <Play size={52} className="text-white fill-white" />
            </motion.div>
            <p className="text-white/70 text-sm tracking-widest uppercase">Tocá para empezar</p>
          </motion.div>
        )}

        {/* Skip button — only visible once video is playing */}
        {videoStarted && (
          <button
            onClick={advanceFromVideo}
            className="absolute bottom-6 right-6 bg-black/60 text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition border border-gray-700 hover:border-gray-500"
          >
            Saltar →
          </button>
        )}
      </motion.div>
    );
  }

  // ── Step 1: Opening ──────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-[78vh] w-full flex flex-col items-center justify-center gap-8 max-w-sm">
        <motion.img
          src="/img/Fase1.png"
          alt="Diego frente al castillo"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="w-48 md:w-64 h-auto"
        />

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center"
        >
          <h1 className="magic-title text-5xl md:text-7xl text-halloween-orange">
            Ayuda a Diego
          </h1>
          <p className="text-gray-500 mt-2 text-sm tracking-widest uppercase">Aprendiendo con IA</p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="w-full flex flex-col gap-4"
        >
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value.toLowerCase())}
            onKeyDown={(e) => e.key === 'Enter' && goToModes()}
            placeholder="¿Cómo te llamás?"
            maxLength={30}
            className="w-full bg-black/70 border-2 border-gray-700 focus:border-halloween-orange rounded-xl px-5 py-4 text-white text-lg text-center focus:outline-none transition"
          />
          <motion.button
            whileHover={{ scale: hasAlias ? 1.03 : 1 }}
            whileTap={{ scale: hasAlias ? 0.97 : 1 }}
            onClick={goToModes}
            disabled={!hasAlias}
            className="w-full bg-halloween-orange hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-xl py-4 text-xl transition"
          >
            ¡Jugar!
          </motion.button>

          <button
            onClick={() => navigate('/auth')}
            className="text-gray-700 hover:text-gray-500 text-xs text-center transition mt-2"
          >
            Soy docente — ingresar
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-col items-center mt-4"
        >
          <img src="/img/logo_utn.png" alt="Universidad Tecnológica Nacional" className="h-40 w-auto opacity-90" />
        </motion.div>
      </div>
    );
  }

  // ── Step 2: Mode selection ──────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="step2"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl w-full flex flex-col items-center gap-6"
      >
        {/* Header */}
        <div className="w-full flex items-center gap-3">
          <button
            onClick={() => { setStep(1); setFlippedCard(null); }}
            className="text-gray-600 hover:text-gray-300 transition"
            aria-label="Volver"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest">¿Cómo querés jugar,</p>
            <p className="text-halloween-orange font-black text-lg uppercase tracking-widest">{alias}?</p>
          </div>
        </div>

        {/* Category + theme quick filter */}
        <div className="w-full flex items-center gap-2">
          <BookOpen size={14} className="text-purple-400 flex-shrink-0" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-1 bg-black/70 border border-gray-800 rounded-lg px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-purple-500 transition"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Sparkles size={14} className="text-gray-700 flex-shrink-0" />
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Tema libre (IA)..."
            className="flex-1 bg-black/70 border border-gray-800 rounded-lg px-3 py-2 text-gray-300 text-xs placeholder-gray-700 focus:outline-none focus:border-gray-600 transition"
          />
        </div>

        {/* 4 mode flip cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          {MODES.map((mode) => {
            const cardKey = mode.id.toString();
            const isFlipped = flippedCard === cardKey;
            return (
              <div key={mode.id} className="relative h-48" style={{ perspective: '1000px' }}>
                <motion.div
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.45, ease: 'easeInOut' }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className="relative w-full h-full cursor-pointer"
                  onClick={() => setFlippedCard(isFlipped ? null : cardKey)}
                >
                  {/* Front */}
                  <div
                    style={{ backfaceVisibility: 'hidden' }}
                    className={`absolute inset-0 bg-black/60 rounded-2xl border-2 ${mode.border} flex flex-col items-center justify-center gap-3 p-4`}
                  >
                    <div className={`${mode.iconBg} rounded-full p-3`}>
                      <mode.Icon size={22} className={mode.iconText} />
                    </div>
                    <h3 className="font-black text-white uppercase tracking-widest text-xs text-center">
                      {mode.name}
                    </h3>
                    <p className="text-[9px] text-gray-600 text-center">Tocá para saber más</p>
                  </div>

                  {/* Back */}
                  <div
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    className={`absolute inset-0 bg-black/90 rounded-2xl border-2 ${mode.border} flex flex-col items-center justify-center gap-3 p-4`}
                  >
                    <p className={`text-center text-[10px] ${mode.iconText} leading-relaxed`}>
                      {mode.desc}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleModeClick(mode.id); }}
                      disabled={loading}
                      className={`${mode.btnBg} disabled:opacity-50 text-white font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition text-[10px]`}
                    >
                      ¡Jugar!
                    </button>
                    <p className="text-[9px] text-gray-700">Tocá para volver</p>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Con mi Profe — big card, full width */}
        <div className="w-full relative h-44 sm:h-36" style={{ perspective: '1000px' }}>
          <motion.div
            animate={{ rotateY: flippedCard === 'join' ? 180 : 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative w-full h-full cursor-pointer"
            onClick={() => setFlippedCard(flippedCard === 'join' ? null : 'join')}
          >
            {/* Front */}
            <div
              style={{ backfaceVisibility: 'hidden' }}
              className="absolute inset-0 bg-black/60 rounded-2xl border-2 border-blue-500/50 hover:border-blue-400/70 transition flex items-center gap-6 px-8"
            >
              <div className="bg-blue-900/50 rounded-full p-4 flex-shrink-0">
                <GraduationCap size={32} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-white uppercase tracking-widest text-lg">Con mi Profe</h3>
                <p className="text-blue-400 text-sm mt-0.5">Tu profe te da un código de 6 letras para entrar a la clase</p>
              </div>
              <p className="text-[10px] text-gray-700 hidden sm:block flex-shrink-0">Tocá para ingresar →</p>
            </div>

            {/* Back — code input */}
            <div
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              className="absolute inset-0 bg-black/90 rounded-2xl border-2 border-blue-500/50 flex flex-col items-center justify-center gap-2 px-6"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={joinRoom} className="flex flex-col sm:flex-row items-center gap-2 w-full">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
                  placeholder="AB23CD"
                  maxLength={6}
                  className="w-full sm:flex-1 bg-gray-900 border-2 border-gray-700 focus:border-blue-500 rounded-xl px-4 py-2 text-white font-mono uppercase tracking-[0.3em] text-lg text-center focus:outline-none transition"
                />
                <button
                  type="submit"
                  disabled={joinLoading || joinCode.trim().length < 3}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-black uppercase px-5 py-2 rounded-xl transition"
                >
                  <LogIn size={16} />
                  {joinLoading ? '...' : 'Entrar'}
                </button>
              </form>
              {joinError && (
                <p className="text-red-400 text-xs">{joinError}</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Versus Local — secret word entry */}
        {showVersusWord && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[90] p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md bg-black/90 border-2 border-purple-500/50 rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-900/40 rounded-full p-3">
                  <Gamepad2 size={22} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-black text-white uppercase tracking-widest text-sm">Palabra secreta</h3>
                  <p className="text-purple-400 text-xs">Escribila sin que tu compañero la vea</p>
                </div>
              </div>

              <div className="relative">
                <input
                  type={revealWord ? 'text' : 'password'}
                  value={versusWord}
                  onChange={(e) => setVersusWord(sanitizeWord(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && versusWordValid) startGame(1, cleanVersusWord); }}
                  placeholder="Tu palabra..."
                  maxLength={20}
                  autoFocus
                  className="w-full bg-gray-900 border-2 border-gray-700 focus:border-purple-500 rounded-xl px-4 py-3 pr-12 text-white uppercase tracking-[0.2em] text-lg text-center focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setRevealWord((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition"
                  aria-label={revealWord ? 'Ocultar palabra' : 'Mostrar palabra'}
                >
                  {revealWord ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <p className="text-[11px] text-gray-500 text-center">
                Solo letras (sin Ñ ni tildes), mínimo 3. Pueden ser dos palabras.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowVersusWord(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => startGame(1, cleanVersusWord)}
                  disabled={!versusWordValid || loading}
                  className="flex-[2] bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition text-xs"
                >
                  ¡A jugar!
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-[100]">
            <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-halloween-orange" />
            <p className="magic-title text-halloween-orange text-3xl mt-6 animate-pulse">
              Abriendo portales...
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
