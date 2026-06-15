import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, Skull, Sparkles, Share2, Trophy } from 'lucide-react';
import api from '../services/api';

interface DailyInfo {
  gameId: string;
  category: string;
  hint: string;
  date: string;
  wordLength: number;
}

interface StoredResult {
  date: string;
  won: boolean;
  errors: number;
  maxAttempts: number;
  word?: string;
  shareText: string;
}

const todayKey = () => `daily_${new Date().toISOString().split('T')[0]}`;

export default function DailyChallenge() {
  const navigate = useNavigate();
  const [daily, setDaily] = useState<DailyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [played, setPlayed] = useState<StoredResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(todayKey());
    if (stored) {
      // Defer state updates to avoid synchronous setState inside an effect
      const t = setTimeout(() => {
        setPlayed(JSON.parse(stored) as StoredResult);
        setLoading(false);
      }, 0);
      return () => clearTimeout(t);
    }

    api.get('/games/daily')
      .then(({ data }) => setDaily(data as DailyInfo))
      .catch(() => setError('No se pudo cargar el desafío de hoy.'))
      .finally(() => setLoading(false));
  }, []);

  const handlePlay = () => {
    if (!daily) return;
    localStorage.setItem('alias', localStorage.getItem('alias') || 'Invocador');
    navigate(`/game/${daily.gameId}?daily=true&date=${daily.date}`);
  };

  const handleShare = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(text);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-halloween-orange" />
        <p className="creepster text-2xl text-halloween-orange animate-pulse">Invocando el desafío...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 py-12">
        <Skull size={48} className="mx-auto mb-4 opacity-50" />
        <p>{error}</p>
      </div>
    );
  }

  // Ya jugó hoy
  if (played) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <div className="bg-black bg-opacity-80 rounded-2xl border border-halloween-orange border-opacity-40 p-8">
          <CalendarDays className="text-halloween-orange mx-auto mb-4" size={48} />
          <h2 className="creepster text-4xl text-halloween-orange mb-2">Daily Completado</h2>
          <p className="text-gray-400 mb-6">{new Date(played.date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

          <div className="bg-gray-900 rounded-xl p-6 mb-6 text-left font-mono text-sm whitespace-pre-wrap text-gray-300 leading-relaxed">
            {played.shareText}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleShare(played.shareText)}
              className="flex-1 bg-halloween-orange text-white font-bold py-3 rounded-xl hover:bg-amber-600 transition flex items-center justify-center gap-2"
            >
              <Share2 size={18} />
              {copied ? '¡Copiado!' : 'Compartir resultado'}
            </button>
            <button
              onClick={() => navigate('/leaderboard')}
              className="bg-gray-800 text-gray-300 font-bold py-3 px-4 rounded-xl hover:bg-gray-700 transition"
              title="Ver ranking"
            >
              <Trophy size={18} />
            </button>
          </div>

          <p className="text-gray-600 text-xs mt-4">Volvé mañana para un nuevo desafío 🎃</p>
        </div>
      </motion.div>
    );
  }

  // Todavía no jugó
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full text-center"
    >
      <div className="bg-black bg-opacity-80 rounded-2xl border border-halloween-orange border-opacity-40 p-8">
        <div className="flex items-center justify-center gap-3 mb-6">
          <CalendarDays className="text-halloween-orange" size={40} />
          <div>
            <h2 className="creepster text-4xl text-halloween-orange">Daily Challenge</h2>
            <p className="text-gray-500 text-sm">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 mb-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Categoría</p>
            <p className="text-halloween-orange font-bold text-xl">{daily?.category}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Longitud</p>
            <div className="flex justify-center gap-1">
              {Array(daily?.wordLength || 0).fill(0).map((_, i) => (
                <div key={i} className="w-6 h-1 bg-halloween-orange rounded-full opacity-40" />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Pista</p>
            <p className="text-gray-300 text-sm italic flex items-start gap-2">
              <Sparkles size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
              {daily?.hint}
            </p>
          </div>
        </div>

        <button
          onClick={handlePlay}
          className="w-full bg-halloween-orange text-white font-bold py-4 rounded-xl hover:bg-amber-600 transition creepster text-2xl tracking-widest"
        >
          ¡INVOCAR!
        </button>

        <p className="text-gray-600 text-xs mt-4">La misma palabra para todos hoy 🌎</p>
      </div>
    </motion.div>
  );
}
