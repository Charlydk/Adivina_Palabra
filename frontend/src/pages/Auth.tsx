import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { GraduationCap, Mail, Lock, User, ArrowLeft } from 'lucide-react';

type Mode = 'login' | 'register';

export default function Auth() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/');
      } else {
        await signUp(email, password, username);
        setMessage('¡Cuenta creada! Revisá tu email para confirmar antes de ingresar.');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/80 p-8 rounded-2xl border border-halloween-orange/30 max-w-md w-full shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate('/')}
          className="text-gray-600 hover:text-gray-400 transition"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <GraduationCap className="text-halloween-orange" size={32} />
          <div>
            <h2 className="magic-title text-2xl text-halloween-orange leading-tight">Panel Docente</h2>
            <p className="text-gray-600 text-xs">Acceso para docentes</p>
          </div>
        </div>
      </div>

      {/* Toggle login/register */}
      <div className="flex rounded-lg overflow-hidden border border-gray-800 mb-6 mt-6">
        {(['login', 'register'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(''); setMessage(''); }}
            className={`flex-1 py-2 text-sm font-bold uppercase tracking-widest transition ${
              mode === m ? 'bg-halloween-orange text-white' : 'bg-gray-900 text-gray-500 hover:text-white'
            }`}
          >
            {m === 'login' ? 'Ingresar' : 'Registrarse'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-500/60 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-green-900/40 border border-green-500/60 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Tu nombre o alias"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-halloween-orange transition"
            />
          </div>
        )}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="email"
            placeholder="Tu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-halloween-orange transition"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="password"
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-halloween-orange transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-halloween-orange text-white font-bold py-3 rounded-lg hover:bg-amber-600 transition uppercase tracking-widest disabled:opacity-50"
        >
          {loading
            ? 'Cargando...'
            : mode === 'login'
            ? 'Ingresar'
            : 'Crear cuenta'}
        </button>
      </form>

      <div className="flex items-center gap-4 text-gray-700 my-4">
        <div className="h-px bg-gray-800 flex-grow" />
        <span className="text-xs uppercase">o</span>
        <div className="h-px bg-gray-800 flex-grow" />
      </div>

      <button
        onClick={handleGoogle}
        className="w-full bg-white text-gray-900 font-bold py-3 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-3"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
        Continuar con Google
      </button>

      {mode === 'login' && (
        <p className="text-center text-gray-700 text-xs mt-4">
          ¿Sos nuevo?{' '}
          <button
            onClick={() => setMode('register')}
            className="text-halloween-orange hover:text-amber-400 transition underline"
          >
            Creá tu cuenta acá
          </button>
        </p>
      )}
    </motion.div>
  );
}
