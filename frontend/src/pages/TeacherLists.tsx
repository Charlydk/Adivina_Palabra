import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { School, Plus, ArrowLeft, Copy, Check, RefreshCw, Monitor, BookMarked, Pencil, Save, X, Sparkles } from 'lucide-react';
import {
  getWordLists,
  getWordList,
  createRoom,
  updateWordList,
  joinRoom as joinRoomApi,
  generateAiWordList,
  type WordListSummary,
} from '../services/api';

interface CodeState {
  listId: number;
  code: string;
  copied: boolean;
}

function parseWordLines(raw: string) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      return { text: parts[0] ?? '', definition: parts[1] || undefined, category: parts[2] || undefined };
    })
    .filter((e) => e.text.length > 0);
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

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRaw, setEditRaw] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit AI generation state
  const [editAiTheme, setEditAiTheme] = useState('');
  const [editAiLoading, setEditAiLoading] = useState(false);
  const [editAiError, setEditAiError] = useState<string | null>(null);

  const generateForEdit = async () => {
    if (!editAiTheme.trim()) return;
    setEditAiLoading(true);
    setEditAiError(null);
    try {
      const words = await generateAiWordList(editAiTheme.trim(), 10);
      const raw = words.map(w => [w.text, w.definition, w.category].filter(Boolean).join(' | ')).join('\n');
      setEditRaw(raw);
    } catch {
      setEditAiError('No se pudo generar. Verificá que el servidor esté encendido.');
    } finally {
      setEditAiLoading(false);
    }
  };

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
    const list = lists.find(l => l.id === listId);
    try {
      const room = await createRoom({ wordListId: listId, alias: alias || undefined, maxAttempts: 6, joinCode: list?.joinCode || undefined });
      setActiveCode({ listId, code: room.joinCode, copied: false });
      setLists(prev => prev.map(l => l.id === listId ? { ...l, joinCode: room.joinCode } : l));
    } catch {
      // Code might already be registered — retry without custom code
      try {
        const room = await createRoom({ wordListId: listId, alias: alias || undefined, maxAttempts: 6 });
        setActiveCode({ listId, code: room.joinCode, copied: false });
        setLists(prev => prev.map(l => l.id === listId ? { ...l, joinCode: room.joinCode } : l));
      } catch {
        setFetchError('Error generando el código. Verificá que el servidor esté encendido.');
      }
    } finally {
      setGeneratingFor(null);
    }
  };

  const startClass = async (listId: number) => {
    setStartingClass(listId);
    const list = lists.find(l => l.id === listId);
    try {
      let room;
      try {
        room = await createRoom({ wordListId: listId, alias: 'Clase', maxAttempts: 6, joinCode: list?.joinCode || undefined });
      } catch {
        // Existing code already registered — create without preferred code
        room = await createRoom({ wordListId: listId, alias: 'Clase', maxAttempts: 6 });
      }
      const joined = await joinRoomApi(room.joinCode, 'Clase');
      navigate(`/game/${joined.gameId}?alias=Clase`);
    } catch {
      setFetchError('Error iniciando la clase. Verificá que el servidor esté encendido.');
      setStartingClass(null);
    }
  };

  const startEdit = async (listId: number) => {
    setEditingId(listId);
    setEditRaw('');
    setEditError(null);
    setEditLoading(true);
    try {
      const detail = await getWordList(listId);
      const raw = detail.items
        .map(i => [i.text, i.definition, i.category].filter(Boolean).join(' | '))
        .join('\n');
      setEditRaw(raw);
    } catch {
      setEditError('No se pudo cargar la lista para editar.');
    } finally {
      setEditLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRaw('');
    setEditError(null);
  };

  const saveEdit = async (listId: number) => {
    const words = parseWordLines(editRaw);
    if (words.length === 0) {
      setEditError('Ingresá al menos una palabra.');
      return;
    }
    setEditLoading(true);
    setEditError(null);
    try {
      await updateWordList(listId, { words });
      setLists(prev => prev.map(l => l.id === listId ? { ...l, wordCount: words.length } : l));
      setEditingId(null);
      setEditRaw('');
    } catch {
      setEditError('No se pudo guardar. Verificá que el servidor esté encendido.');
    } finally {
      setEditLoading(false);
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
          <h1 className="magic-title text-3xl text-halloween-orange">Mis listas</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {alias ? `Listas creadas por ${alias}` : 'Iniciá sesión para ver tus listas'}
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

      {!alias ? (
        <div className="text-center py-16 text-gray-500">
          <School size={48} className="mx-auto mb-4 opacity-30" />
          <p>Iniciá sesión como docente para ver tus listas.</p>
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
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-black text-white text-lg leading-tight">{list.name}</h3>
                  <p className="text-gray-500 text-xs mt-1">
                    {list.wordCount} palabra{list.wordCount !== 1 ? 's' : ''} · {formatDate(list.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => editingId === list.id ? cancelEdit() : startEdit(list.id)}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition text-xs px-2 py-1 rounded-lg hover:bg-gray-800"
                  title="Editar palabras"
                >
                  {editingId === list.id ? <X size={14} /> : <Pencil size={14} />}
                  {editingId === list.id ? 'Cancelar' : 'Editar'}
                </button>
              </div>

              {/* Edit panel */}
              <AnimatePresence>
                {editingId === list.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4 border border-gray-700 rounded-xl p-4 bg-gray-950">
                      {/* AI generation in edit panel */}
                      <div className="mb-3 border border-purple-900 border-opacity-40 rounded-lg p-3 bg-purple-950 bg-opacity-20">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Sparkles size={13} className="text-purple-400" />
                          <span className="text-purple-400 font-bold uppercase text-xs">Reemplazar con IA</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editAiTheme}
                            onChange={(e) => setEditAiTheme(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && generateForEdit()}
                            placeholder="Ej: Sistema solar, Independencia argentina"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                          />
                          <button
                            type="button"
                            onClick={generateForEdit}
                            disabled={editAiLoading || !editAiTheme.trim()}
                            className="flex items-center gap-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-md transition text-xs whitespace-nowrap"
                          >
                            {editAiLoading
                              ? <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-white" />
                              : <Sparkles size={12} />}
                            {editAiLoading ? 'Generando...' : 'Generar'}
                          </button>
                        </div>
                        {editAiError && <p className="text-red-400 text-xs mt-1">{editAiError}</p>}
                      </div>

                      <p className="text-xs text-gray-500 mb-2 italic">
                        Una palabra por línea · formato: <code className="text-gray-400">palabra | definición | categoría</code>
                      </p>
                      {editLoading && !editRaw ? (
                        <div className="flex justify-center py-6">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-halloween-orange" />
                        </div>
                      ) : (
                        <textarea
                          value={editRaw}
                          onChange={(e) => setEditRaw(e.target.value)}
                          rows={8}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-halloween-orange transition resize-y"
                        />
                      )}
                      {editError && (
                        <p className="text-red-400 text-xs mt-2">{editError}</p>
                      )}
                      <button
                        onClick={() => saveEdit(list.id)}
                        disabled={editLoading}
                        className="mt-3 flex items-center gap-2 bg-halloween-orange hover:bg-amber-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition text-sm"
                      >
                        {editLoading
                          ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                          : <Save size={14} />}
                        Guardar cambios
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stored code */}
              {list.joinCode && activeCode?.listId !== list.id && (
                <div className="mb-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Código activo</p>
                    <p className="font-mono font-black text-4xl text-halloween-orange tracking-widest">{list.joinCode}</p>
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

              {/* Freshly generated code */}
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
                        <p className="font-mono font-black text-4xl text-halloween-orange tracking-widest neon-text">
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
