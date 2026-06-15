import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Crown, Skull } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LeaderboardEntry {
  player: string;
  total_points: number;
  games_played: number;
  wins: number;
  avg_attempts: number;
}

type Period = 'weekly' | 'alltime';

const PERIOD_VIEWS: Record<Period, string> = {
  weekly: 'leaderboard_weekly',
  alltime: 'leaderboard_alltime',
};

const RANK_ICONS = [
  <Crown className="text-yellow-400" size={20} />,
  <Crown className="text-gray-400" size={18} />,
  <Crown className="text-amber-700" size={16} />,
];

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use a microtask-deferred setter for loading to avoid synchronous setState in effect
    const t = setTimeout(() => setLoading(true), 0);
    supabase
      .from(PERIOD_VIEWS[period])
      .select('*')
      .then(({ data, error }) => {
        if (!error && data) setData(data as LeaderboardEntry[]);
        setLoading(false);
      });
    return () => clearTimeout(t);
  }, [period]);

  return (
    <div className="max-w-2xl w-full">
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <Trophy className="text-halloween-orange" size={40} />
          <h1 className="creepster text-5xl text-halloween-orange neon-text">RANKING</h1>
          <Trophy className="text-halloween-orange" size={40} />
        </div>
        <p className="text-gray-400 italic">"Los mejores invocadores del reino"</p>
      </motion.div>

      {/* Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-6">
        {(['weekly', 'alltime'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-3 flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-sm transition ${
              period === p ? 'bg-halloween-orange text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            {p === 'weekly' ? <Flame size={16} /> : <Skull size={16} />}
            {p === 'weekly' ? 'Esta Semana' : 'Todos los Tiempos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-halloween-orange" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Skull size={48} className="mx-auto mb-4 opacity-30" />
          <p>Aún no hay almas en el ranking. ¡Sé el primero!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((entry, i) => (
            <motion.div
              key={entry.player}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-xl border transition ${
                i === 0
                  ? 'bg-yellow-900 bg-opacity-20 border-yellow-500 border-opacity-50'
                  : i === 1
                  ? 'bg-gray-700 bg-opacity-20 border-gray-500 border-opacity-30'
                  : i === 2
                  ? 'bg-amber-900 bg-opacity-20 border-amber-700 border-opacity-30'
                  : 'bg-black bg-opacity-40 border-gray-800'
              }`}
            >
              <div className="w-8 flex justify-center">
                {i < 3 ? RANK_ICONS[i] : <span className="text-gray-500 font-bold text-sm">#{i + 1}</span>}
              </div>
              <div className="flex-grow">
                <p className="font-bold text-white">{entry.player}</p>
                <p className="text-xs text-gray-400">
                  {entry.games_played} partidas · {entry.wins} victorias · ~{entry.avg_attempts} intentos
                </p>
              </div>
              <div className="text-right">
                <p className="text-halloween-orange font-bold text-xl">{entry.total_points.toLocaleString()}</p>
                <p className="text-xs text-gray-500">pts</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
