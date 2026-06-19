import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Copy, Check, Plus, ArrowLeft, Monitor, BookMarked } from 'lucide-react';
import { createWordList, createRoom, joinRoom as joinRoomApi, generateAiWordList } from '../services/api';
import { Sparkles } from 'lucide-react';

type RoomMode = 'tarea' | 'clase';

interface RoomResult {
  joinCode: string;
  listName: string;
  totalWords: number;
  isClase?: boolean;
}

/**
 * Parse a raw textarea block into word entries.
 * Supported format per line: "palabra | definición | categoría"
 * All three parts after the first pipe are optional.
 */
function parseWordLines(raw: string) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      return {
        text: parts[0] ?? '',
        definition: parts[1] || undefined,
        category: parts[2] || undefined,
      };
    })
    .filter((entry) => entry.text.length > 0);
}

export default function CreateRoom() {
  const navigate = useNavigate();
  const alias = localStorage.getItem('alias') || '';

  const [mode, setMode] = useState<RoomMode>('tarea');
  const [listName, setListName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [wordsRaw, setWordsRaw] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoomResult | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [startingClass, setStartingClass] = useState(false);
  const [startClassError, setStartClassError] = useState<string | null>(null);

  const [aiTheme, setAiTheme] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleGenerateWithAi = async () => {
    if (!aiTheme.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const words = await generateAiWordList(aiTheme.trim(), 10);
      const raw = words.map(w => [w.text, w.definition, w.category].filter(Boolean).join(' | ')).join('\n');
      setWordsRaw(raw);
    } catch {
      setAiError('No se pudo generar la lista. Verificá que el servidor esté encendido.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const words = parseWordLines(wordsRaw);
    if (!listName.trim()) {
      setError('Por favor, ingresá un nombre para la lista.');
      return;
    }
    if (words.length === 0) {
      setError('Ingresá al menos una palabra.');
      return;
    }

    setLoading(true);
    try {
      const normalizedCode = customCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || undefined;

      if (mode === 'tarea') {
        // Step 1: persist the word list
        const list = await createWordList({
          name: listName.trim(),
          ownerAlias: alias || undefined,
          words,
        });
        // Step 2: create the tarea room (code-only, no GameSession)
        const room = await createRoom({
          wordListId: list.id,
          alias: alias || undefined,
          maxAttempts,
          joinCode: normalizedCode,
        });
        setResult({ joinCode: room.joinCode, listName: room.listName, totalWords: room.totalWords });
      } else {
        // Classroom: teacher gets their own session to play projected — same infra as tarea
        const list = await createWordList({
          name: listName.trim(),
          ownerAlias: alias || undefined,
          words,
        });
        const room = await createRoom({
          wordListId: list.id,
          alias: alias || undefined,
          maxAttempts,
          joinCode: normalizedCode,
        });
        setResult({ joinCode: room.joinCode, listName: room.listName, totalWords: room.totalWords, isClase: true });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      const detail = axiosErr?.response?.data;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (detail && typeof detail === 'object' && 'error' in detail && typeof (detail as Record<string, unknown>).error === 'string') {
        setError((detail as Record<string, string>).error);
      } else {
        setError('No se pudo crear la sala. Verificá que el servidor esté encendido.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      alert(result.joinCode);
    }
  };

  const handleStartClass = async () => {
    if (!result) return;
    setStartingClass(true);
    setStartClassError(null);
    try {
      const joined = await joinRoomApi(result.joinCode, 'Clase');
      navigate(`/game/${joined.gameId}?alias=Clase`);
    } catch {
      setStartClassError('No se pudo iniciar la clase. Verificá que el servidor esté encendido.');
      setStartingClass(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────
  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="bg-black bg-opacity-80 rounded-2xl border border-halloween-orange border-opacity-50 p-8 flex flex-col items-center gap-6 text-center">
          <h2 className="creepster text-4xl text-halloween-orange neon-text">
            {result.isClase ? '¡Lista lista para clase!' : '¡Sala creada!'}
          </h2>

          <div>
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">{result.listName}</p>
            <p className="text-gray-500 text-xs">{result.totalWords} palabras</p>
          </div>

          {/* Big join code */}
          <div className="bg-gray-900 border-2 border-halloween-orange border-opacity-60 rounded-2xl px-10 py-6 w-full">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
              {result.isClase ? 'Código (también para tarea)' : 'Código de la sala'}
            </p>
            <p className="creepster text-6xl text-halloween-orange neon-text tracking-widest">
              {result.joinCode}
            </p>
          </div>

          <p className="text-gray-400 text-sm">
            {result.isClase
              ? 'Iniciá la clase en el proyector. Si querés, compartí el código para asignar la lista como tarea en casa.'
              : 'Compartí este código con tu clase. La sala está activa mientras el servidor esté encendido.'}
          </p>

          <div className="flex flex-col gap-3 w-full">
            {result.isClase && (
              <>
                {startClassError && (
                  <p className="text-red-400 text-sm bg-red-950 bg-opacity-50 border border-red-800 rounded-lg px-4 py-3">
                    {startClassError}
                  </p>
                )}
                <button
                  onClick={handleStartClass}
                  disabled={startingClass}
                  className="flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition"
                >
                  {startingClass
                    ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white" />
                    : <Monitor size={18} />}
                  {startingClass ? 'Iniciando...' : 'Empezar clase en el proyector'}
                </button>
              </>
            )}

            <button
              onClick={handleCopyCode}
              className={`flex items-center justify-center gap-2 ${result.isClase ? 'bg-gray-800 hover:bg-gray-700' : 'bg-halloween-orange hover:bg-amber-600'} text-white font-bold px-6 py-3 rounded-xl transition`}
            >
              {codeCopied ? <Check size={18} /> : <Copy size={18} />}
              {codeCopied ? '¡Copiado!' : 'Copiar código'}
            </button>

            <button
              onClick={() => {
                setResult(null);
                setListName('');
                setCustomCode('');
                setWordsRaw('');
                setMaxAttempts(6);
                setError(null);
                setStartClassError(null);
              }}
              className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl transition"
            >
              <Plus size={18} />
              Crear nueva sala
            </button>

            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-400 text-sm transition flex items-center justify-center gap-1"
            >
              <ArrowLeft size={14} />
              Volver al inicio
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Create form ─────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg w-full"
    >
      <div className="bg-black bg-opacity-70 rounded-2xl border border-halloween-orange border-opacity-30 p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-300 transition"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="creepster text-3xl text-halloween-orange neon-text">Crear sala</h1>
            <p className="text-gray-500 text-sm mt-0.5">Ingresá tu lista y compartí el código con los alumnos</p>
          </div>
        </div>

        {/* Mode toggle: Tarea / Clase */}
        <div className="flex rounded-xl overflow-hidden border border-gray-700">
          <button
            type="button"
            onClick={() => setMode('tarea')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-widest transition ${
              mode === 'tarea'
                ? 'bg-halloween-orange text-white'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
          >
            <BookMarked size={16} />
            Tarea
          </button>
          <button
            type="button"
            onClick={() => setMode('clase')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-widest transition ${
              mode === 'clase'
                ? 'bg-green-700 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Monitor size={16} />
            Clase en vivo
          </button>
        </div>

        {/* Mode description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={mode}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-gray-500 italic -mt-2"
          >
            {mode === 'tarea'
              ? 'Cada alumno recibe su propio juego independiente. El código no caduca.'
              : 'La docente juega en el proyector, la clase dicta las letras. No se necesitan dispositivos de alumnos.'}
          </motion.p>
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* List name */}
          <div>
            <label className="block text-halloween-orange font-bold uppercase text-sm mb-2">
              Nombre de la lista
            </label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Ej: Unidad 3 — Ecosistemas"
              maxLength={120}
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-halloween-orange transition"
            />
          </div>

          {/* Custom join code */}
          <div>
            <label className="block text-gray-400 font-bold uppercase text-sm mb-2">
              Código de sala <span className="text-gray-600 font-normal normal-case">(opcional)</span>
            </label>
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="Ej: PERRO, CLASE1, 2025"
              maxLength={6}
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-3 text-white font-mono tracking-widest focus:outline-none focus:border-gray-500 transition"
            />
            <p className="text-[11px] text-gray-600 mt-1.5 italic">
              3 a 6 letras o números. Si lo dejás vacío se genera uno automáticamente.
            </p>
          </div>

          {/* AI word generation */}
          <div className="border border-purple-900 border-opacity-50 rounded-xl p-4 bg-purple-950 bg-opacity-20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={15} className="text-purple-400" />
              <span className="text-purple-400 font-bold uppercase text-sm">Generar palabras con IA</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiTheme}
                onChange={(e) => setAiTheme(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateWithAi()}
                placeholder="Ej: Ecosistemas, Revolución de Mayo, Partes del cuerpo"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition"
              />
              <button
                type="button"
                onClick={handleGenerateWithAi}
                disabled={aiLoading || !aiTheme.trim()}
                className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition text-sm whitespace-nowrap"
              >
                {aiLoading
                  ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                  : <Sparkles size={14} />}
                {aiLoading ? 'Generando...' : 'Generar'}
              </button>
            </div>
            {aiError && <p className="text-red-400 text-xs mt-2">{aiError}</p>}
            <p className="text-gray-600 text-xs mt-2 italic">Genera 10 palabras con definiciones. Podés editarlas abajo.</p>
          </div>

          {/* Words textarea */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={16} className="text-purple-400" />
              <label className="text-purple-400 font-bold uppercase text-sm">
                Palabras (una por línea)
              </label>
            </div>
            <textarea
              value={wordsRaw}
              onChange={(e) => setWordsRaw(e.target.value)}
              rows={8}
              placeholder={"fotosíntesis | Proceso por el que las plantas producen alimento\nclorofila\ncélula | Unidad básica de la vida | Biología"}
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition resize-y font-mono"
            />
            <p className="text-[11px] text-gray-600 mt-1.5 italic leading-relaxed">
              Formato: <code className="text-gray-400">palabra | definición | categoría</code><br />
              La definición y la categoría son opcionales.
            </p>
          </div>

          {/* Max attempts */}
          <div>
            <label className="block text-gray-400 font-bold uppercase text-sm mb-2">
              Intentos máximos
            </label>
            <select
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500 transition"
            >
              <option value={4}>4 — Difícil</option>
              <option value={6}>6 — Normal</option>
              <option value={8}>8 — Fácil</option>
            </select>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-sm bg-red-950 bg-opacity-50 border border-red-800 rounded-lg px-4 py-3"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className={`disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-xl transition text-lg ${
              mode === 'clase'
                ? 'bg-green-700 hover:bg-green-600'
                : 'bg-halloween-orange hover:bg-amber-600'
            }`}
          >
            {loading
              ? 'Creando sala...'
              : mode === 'clase'
              ? 'Crear sala de clase'
              : 'Crear sala'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
