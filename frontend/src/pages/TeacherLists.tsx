import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { School, Plus, ArrowLeft, Copy, Check, RefreshCw, Monitor, BookMarked } from 'lucide-react';
import { getWordLists, createRoom, joinRoom as joinRoomApi, type WordListSummary } from '../services/api';

interface CodeState {
  listId: number;
  code: string;
  copied: boolean;
}

export default function TeacherLists() {
  const navigate = useNavigate();
  const alias = localStorage.getItem('alias') || '';

  const [lists, setLists] = useState<WordListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<CodeState | null>(null);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [startingClass, setStartingClass] = useState<number | null>(null);

  useEffect(() => {
    if (!alias) { setLoading(false); return; }
    getWordLists(alias)
      .then(setLists)
      .catch(() => setFetchError('No se pudo cargar las listas. Verificá que el servidor esté encendido.'))
      .finally(() => setLoading(false));
  }, [alias]);

  const generateCode = async (listId: number) => {
    setGeneratingFor(listId);
    setActiveCode(null);
    try {
      const room = await createRoom({ wordListId: listId, alias: alias || undefined, maxAttempts: 6 });
      setActiveCode({ listId, code: room.joinCode, copied: false });
    } catch {
      setFetchError('Error generando el código. Verificá que el servidor esté encendido.');
    } finally {
      setGeneratingFor(null);
    }
  };

  const startClass = async (listId: number) => {
    setStartingClass(listId);
    try {
      const room = await createRoom({ wordListId: listId, alias: alias || undefined, maxAttempts: 6 });
      const teacherAlias = alias || 'Docente';
      localStorage.setItem('alias', teacherAlias);
      const joined = await joinRoomApi(room.joinCode, teacherAlias);
      navigate(`/game/${joined.gameId}`);
    } catch {
      setFetchError('Error iniciando la clase. Verificá que el servidor esté encendido.');
      setStartingClass(null);
    }
  };

  const copyCode = async (code: string, listId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setActiveCode(prev => prev?.listId === listId ? { ...prev, copied: true } : prev);
      setTimeout(() => setActiveCode(prev => prev?.listId === listId ? { ...prev, copied: false } : prev), 2000);
    } catch {
      alert(code);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl w-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-300 transition">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-grow">
          <h1 className="creepster text-3xl text-halloween-orange neon-text">Mis listas</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {alias ? `Listas creadas por ${alias}` : 'Configurá tu alias para ver tus listas'}
          </p>
        </div>
        <button
          onClick={() => navigate('/create-room')}
          className="flex items-center gap-2 bg-halloween-orange hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl transition text-sm whitespace-nowrap"
        >
          <Plus size={16} />
          Nueva lista
        </button>
      </div>

      {fetchError && (
        <div className="mb-4 text-red-400 text-sm bg-red-950 bg-opacity-50 border border-red-800 rounded-lg px-4 py-3">
          {fetchError}
        </div>
      )}

      {/* States */}
      {!alias ? (
        <div className="text-center py-16 text-gray-500">
          <School size={48} className="mx-auto mb-4 opacity-30" />
          <p>Ingresá tu alias en la pantalla principal para ver tus listas.</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-halloween-orange" />
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <BookMarked size={48} className="mx-auto mb-4 opacity-30" />
          <p>Todavía no creaste ninguna lista.</p>
          <button
            onClick={() => navigate('/create-room')}
            className="mt-6 flex items-center gap-2 bg-halloween-orange hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl transition mx-auto"
          >
            <Plus size={18} />
            Crear primera lista
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {lists.map((list, i) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-black bg-opacity-70 rounded-2xl border border-halloween-orange border-opacity-20 p-5"
            >
              {/* List info */}
              <div className="mb-3">
                <h3 className="font-black text-white text-lg leading-tight">{list.name}</h3>
                <p className="text-gray-500 text-xs mt-1">
                  {list.wordCount} palabra{list.wordCount !== 1 ? 's' : ''} · {formatDate(list.createdAt)}
                </p>
              </div>

              {/* Stored code (persisted in DB) — shown unless a freshly generated one is active */}
              {list.joinCode && activeCode?.listId !== list.id && (
                <div className="mb-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Código activo</p>
                    <p className="creepster text-4xl text-halloween-orange tracking-widest">{list.joinCode}</p>
                  </div>
                  <button
                    onClick={() => copyCode(list.joinCode!, list.id)}
                    className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition text-sm"
                  >
                    <Copy size={14} />
                    Copiar
                  </button>
                </div>
              )}

              {/* Freshly generated code (overrides the stored display above) */}
              <AnimatePresence>
                {activeCode?.listId === list.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-3 bg-gray-900 border border-halloween-orange border-opacity-40 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Nuevo código generado</p>
                        <p className="creepster text-4xl text-halloween-orange tracking-widest neon-text">
                          {activeCode.code}
                        </p>
                      </div>
                      <button
                        onClick={() => copyCode(activeCode.code, list.id)}
                        className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition text-sm"
                      >
                        {activeCode.copied ? <Check size={14} /> : <Copy size={14} />}
                        {activeCode.copied ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => generateCode(list.id)}
                  disabled={generatingFor === list.id}
                  className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition text-sm"
                >
                  {generatingFor === list.id
                    ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                    : <RefreshCw size={14} />}
                  Generar código tarea
                </button>
                <button
                  onClick={() => startClass(list.id)}
                  disabled={startingClass === list.id}
                  className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition text-sm"
                >
                  {startingClass === list.id
                    ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                    : <Monitor size={14} />}
                  Empezar clase
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
