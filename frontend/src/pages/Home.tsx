import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion } from 'framer-motion';
import { User, Users, Zap, Sparkles, BookOpen, Heart, GraduationCap, School, KeyRound, LogIn, Gamepad2 } from 'lucide-react';
import { joinRoom as joinRoomApi } from '../services/api';

type UserProfile = 'primaria' | 'adultos_mayores';

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'ciencias_naturales', label: 'Ciencias Naturales' },
  { value: 'ciencias_sociales', label: 'Ciencias Sociales' },
  { value: 'lengua', label: 'Lengua' },
];

export default function Home() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(
    (localStorage.getItem('userProfile') as UserProfile) || null
  );
  const [alias, setAlias] = useState(localStorage.getItem('alias') || '');
  const [category, setCategory] = useState('');
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);

  // Join-by-code state (tarea — student gets own session)
  const [joinCode, setJoinCode] = useState('');
  const [joinAlias, setJoinAlias] = useState(localStorage.getItem('alias') || '');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const isAccessible = profile === 'adultos_mayores';

  const handleSelectProfile = (p: UserProfile) => {
    setProfile(p);
    localStorage.setItem('userProfile', p);
    setCategory(p === 'adultos_mayores' ? 'cultura_general' : '');
  };

  const startGame = async (mode: number) => {
    if (!alias.trim()) {
      alert(isAccessible ? 'Por favor, ingresá tu nombre.' : 'Por favor, ingresá un alias antes de jugar.');
      return;
    }
    localStorage.setItem('alias', alias);
    setLoading(true);
    try {
      const response = await api.post('/games/create', {
        mode,
        alias: alias.trim(),
        maxAttempts: isAccessible ? 8 : 6,
        theme: theme.trim() || null,
        category: category || null,
        profile: profile || 'primaria',
      });
      navigate(`/game/${response.data.id}`);
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
    if (!joinAlias.trim()) {
      setJoinError('Ingresá tu alias para unirte a la sala.');
      return;
    }
    localStorage.setItem('alias', joinAlias.trim());
    setJoinLoading(true);
    try {
      // POST /api/rooms/join — creates an independent Solo session for this student
      const result = await joinRoomApi(code, joinAlias.trim());
      navigate(`/game/${result.gameId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 404) {
        setJoinError('Código inválido o sala expirada.');
      } else {
        setJoinError('No se pudo conectar al servidor. ¿Está encendido?');
      }
    } finally {
      setJoinLoading(false);
    }
  };

  const modes = [
    { id: 0, name: 'Solitario', icon: <User size={isAccessible ? 28 : 24} />, desc: isAccessible ? 'Jugá a tu ritmo' : 'Vos contra el verdugo' },
    { id: 1, name: isAccessible ? 'Con un amigo' : 'Versus Local', icon: <Gamepad2 size={isAccessible ? 28 : 24} />, desc: isAccessible ? 'Jugá con alguien' : '2 jugadores, 1 pantalla' },
    { id: 2, name: 'Online Coop', icon: <Users size={isAccessible ? 28 : 24} />, desc: 'Adivina con un amigo' },
    { id: 3, name: 'Duelo Online', icon: <Zap size={isAccessible ? 28 : 24} />, desc: 'Carrera por sobrevivir' },
  ];

  // Step 1: Profile selection
  if (!profile) {
    return (
      <div className="max-w-4xl w-full flex flex-col items-center gap-10">
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <h1 className="magic-title text-4xl md:text-6xl text-halloween-orange mb-3">
            Ayuda a Diego
          </h1>
          <p className="text-gray-300 text-lg">Aprendiendo con IA</p>
          <p className="text-gray-500 text-sm mt-2">¿Quién va a jugar hoy?</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <motion.button
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => handleSelectProfile('primaria')}
            className="bg-black bg-opacity-60 p-8 rounded-2xl border-2 border-blue-500 border-opacity-40 hover:border-blue-400 hover:border-opacity-80 transition-all flex flex-col items-center gap-4"
          >
            <div className="p-5 bg-blue-900 bg-opacity-40 rounded-full">
              <GraduationCap size={48} className="text-blue-400" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black text-white mb-1">Primaria</h3>
              <p className="text-blue-300 text-sm">5°, 6° y 7° grado</p>
              <p className="text-gray-500 text-xs mt-2">Ciencias Naturales, Sociales y Lengua</p>
            </div>
          </motion.button>

          <motion.button
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => handleSelectProfile('adultos_mayores')}
            className="bg-black bg-opacity-60 p-8 rounded-2xl border-2 border-amber-500 border-opacity-40 hover:border-amber-400 hover:border-opacity-80 transition-all flex flex-col items-center gap-4"
          >
            <div className="p-5 bg-amber-900 bg-opacity-40 rounded-full">
              <Heart size={48} className="text-amber-400" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black text-white mb-1">Adultos Mayores</h3>
              <p className="text-amber-300 text-sm">Estimulación cognitiva</p>
              <p className="text-gray-500 text-xs mt-2">Palabras familiares · Pistas guiadas</p>
            </div>
          </motion.button>
        </div>
      </div>
    );
  }

  // Step 2: Game setup
  return (
    <div className="max-w-4xl w-full flex flex-col items-center gap-6">
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center"
      >
        <h1 className={`magic-title text-halloween-orange ${isAccessible ? 'text-4xl md:text-5xl' : 'text-4xl md:text-6xl'}`}>
          Ayuda a Diego
        </h1>
        <p className={`text-gray-400 italic mt-1 ${isAccessible ? 'text-lg' : 'text-base'}`}>
          {isAccessible
            ? '¡Ayudá a Diego adivinando la palabra!'
            : 'Ayudá a Diego adivinando la palabra. ¡La IA te da pistas!'}
        </p>
        <button
          onClick={() => { setProfile(null); localStorage.removeItem('userProfile'); }}
          className="mt-2 text-xs text-gray-600 hover:text-gray-400 transition underline"
        >
          Cambiar perfil ({isAccessible ? 'Adultos Mayores' : 'Primaria'})
        </button>
      </motion.div>

      <div className="w-full max-w-md flex flex-col gap-4">
        {/* Alias */}
        <div className={`bg-black bg-opacity-70 rounded-xl border border-halloween-orange border-opacity-30 ${isAccessible ? 'p-7' : 'p-6'}`}>
          <label className={`block text-halloween-orange font-bold uppercase mb-2 ${isAccessible ? 'text-base' : 'text-sm'}`}>
            {isAccessible ? 'Tu nombre' : 'Tu Alias de Invocador'}
          </label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder={isAccessible ? 'Ej: María' : 'Ej: CharlyDK'}
            className={`w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 text-white focus:outline-none focus:border-halloween-orange transition ${isAccessible ? 'py-4 text-xl' : 'py-3'}`}
          />
        </div>

        {/* Category selector */}
        <div className={`bg-black bg-opacity-70 rounded-xl border border-purple-500 border-opacity-30 ${isAccessible ? 'p-7' : 'p-6'}`}>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={isAccessible ? 20 : 16} className="text-purple-400" />
            <label className={`text-purple-400 font-bold uppercase ${isAccessible ? 'text-base' : 'text-sm'}`}>Categoría</label>
          </div>
          {isAccessible ? (
            <p className={`text-gray-200 ${isAccessible ? 'text-xl' : ''}`}>Cultura General</p>
          ) : (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Custom theme — only for primaria */}
        {!isAccessible && (
          <div className="bg-black bg-opacity-70 p-6 rounded-xl border border-gray-700 border-opacity-30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-gray-400" />
              <label className="block text-gray-400 text-sm font-bold uppercase">Tema personalizado (IA)</label>
            </div>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ej: Animales de la selva"
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-gray-500 transition"
            />
            <p className="text-[10px] text-gray-600 mt-2 italic">Dejá vacío para usar el banco de palabras.</p>
          </div>
        )}
      </div>

      {/* Mode buttons */}
      <div className={`grid gap-4 w-full max-w-2xl ${isAccessible ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
        {modes.map((mode) => (
          <motion.button
            key={mode.id}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => startGame(mode.id)}
            disabled={loading}
            className={`bg-black bg-opacity-60 rounded-2xl border-2 border-gray-800 hover:border-halloween-orange transition-all flex flex-col items-center gap-3 group ${isAccessible ? 'p-8' : 'p-6'}`}
          >
            <div className={`bg-gray-900 rounded-full text-halloween-orange group-hover:bg-halloween-orange group-hover:text-white transition ${isAccessible ? 'p-6' : 'p-4'}`}>
              {mode.icon}
            </div>
            <div className="text-center">
              <h3 className={`font-black text-white uppercase tracking-widest ${isAccessible ? 'text-2xl' : 'text-lg'}`}>{mode.name}</h3>
              <p className={`text-gray-500 ${isAccessible ? 'text-base' : 'text-sm'}`}>{mode.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* ── Teacher: create a classroom room ────────────────────────────────── */}
      <div className="w-full max-w-2xl flex flex-col gap-2">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/create-room')}
          className={`w-full bg-black bg-opacity-60 rounded-2xl border-2 border-green-700 hover:border-green-500 transition-all flex items-center gap-4 group ${isAccessible ? 'p-7' : 'p-5'}`}
        >
          <div className={`bg-green-900 bg-opacity-40 rounded-full text-green-400 group-hover:bg-green-800 transition ${isAccessible ? 'p-5' : 'p-4'}`}>
            <School size={isAccessible ? 28 : 22} />
          </div>
          <div className="text-left">
            <h3 className={`font-black text-white uppercase tracking-widest ${isAccessible ? 'text-xl' : 'text-base'}`}>
              Crear sala con mis palabras
            </h3>
            <p className={`text-green-400 ${isAccessible ? 'text-base' : 'text-sm'}`}>
              Modo Profesor — ingresá tu lista y compartí el código
            </p>
          </div>
        </motion.button>
        <button
          onClick={() => navigate('/teacher/lists')}
          className={`text-green-600 hover:text-green-400 transition text-center ${isAccessible ? 'text-base' : 'text-sm'}`}
        >
          Ver mis listas guardadas →
        </button>
      </div>

      {/* ── Student: join by code ─────────────────────────────────────────── */}
      <div className="w-full max-w-2xl">
        <div className={`bg-black bg-opacity-60 rounded-2xl border-2 border-blue-700 border-opacity-60 ${isAccessible ? 'p-7' : 'p-5'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`bg-blue-900 bg-opacity-40 rounded-full text-blue-400 ${isAccessible ? 'p-4' : 'p-3'}`}>
              <KeyRound size={isAccessible ? 26 : 20} />
            </div>
            <div>
              <h3 className={`font-black text-white uppercase tracking-widest ${isAccessible ? 'text-xl' : 'text-base'}`}>
                Unirse con código
              </h3>
              <p className={`text-blue-400 ${isAccessible ? 'text-base' : 'text-sm'}`}>Tu profe te da el código</p>
            </div>
          </div>

          <form onSubmit={joinRoom} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
                placeholder="Código (ej: AB23CD)"
                maxLength={6}
                className={`w-full sm:w-36 bg-gray-900 border-2 border-gray-700 rounded-lg px-4 text-white font-mono uppercase tracking-widest focus:outline-none focus:border-blue-500 transition ${isAccessible ? 'py-4 text-xl' : 'py-3'}`}
              />
              <input
                type="text"
                value={joinAlias}
                onChange={(e) => { setJoinAlias(e.target.value); setJoinError(null); }}
                placeholder={isAccessible ? 'Tu nombre' : 'Tu alias'}
                className={`min-w-0 flex-1 bg-gray-900 border-2 border-gray-700 rounded-lg px-4 text-white focus:outline-none focus:border-blue-500 transition ${isAccessible ? 'py-4 text-xl' : 'py-3'}`}
              />
            </div>

            {joinError && (
              <p className="text-red-400 text-sm">{joinError}</p>
            )}

            <button
              type="submit"
              disabled={joinLoading}
              className={`flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl transition ${isAccessible ? 'py-4 text-lg' : 'py-3'}`}
            >
              <LogIn size={isAccessible ? 22 : 18} />
              {joinLoading ? 'Conectando...' : 'Unirse'}
            </button>
          </form>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-[100]">
          <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-halloween-orange" />
          <p className={`creepster text-halloween-orange mt-6 animate-pulse ${isAccessible ? 'text-4xl' : 'text-3xl'}`}>
            {isAccessible ? 'Preparando el juego...' : 'Abriendo portales...'}
          </p>
        </div>
      )}
    </div>
  );
}
