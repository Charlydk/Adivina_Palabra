import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ghost, Trophy, LogOut, LogIn, User, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const username = user?.user_metadata?.username
    ?? user?.email?.split('@')[0]
    ?? null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-black bg-opacity-90 border-b border-halloween-orange border-opacity-30 py-4 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <Ghost className="text-halloween-orange group-hover:animate-bounce" size={32} />
          <h1 className="magic-title text-xl text-halloween-orange">Ayuda a Diego</h1>
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            to="/daily"
            className="text-gray-300 hover:text-halloween-orange transition flex items-center gap-1"
          >
            <CalendarDays size={18} />
            <span className="hidden sm:inline text-sm font-bold uppercase tracking-widest">Daily</span>
          </Link>
          <Link
            to="/leaderboard"
            className="text-gray-300 hover:text-halloween-orange transition flex items-center gap-1"
          >
            <Trophy size={18} />
            <span className="hidden sm:inline text-sm font-bold uppercase tracking-widest">Ranking</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 px-3 py-2 rounded-lg">
                <User size={16} className="text-halloween-orange" />
                <span className="text-sm font-bold text-white">{username}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-gray-400 hover:text-red-400 transition"
                title="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="bg-halloween-orange hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-md"
            >
              <LogIn size={18} />
              <span className="font-bold text-sm">Ingresar</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
