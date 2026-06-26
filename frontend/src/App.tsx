import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Game from './pages/Game';
import Auth from './pages/Auth';
import Leaderboard from './pages/Leaderboard';
import DailyChallenge from './pages/DailyChallenge';
import CreateRoom from './pages/CreateRoom';
import TeacherLists from './pages/TeacherLists';
import Navbar from './components/Navbar';

function App() {
  return (
    <AuthProvider>
      <Router>
<div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center justify-center">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game/:gameId" element={<Game />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/daily" element={<DailyChallenge />} />
              <Route path="/create-room" element={<CreateRoom />} />
              <Route path="/teacher/lists" element={<TeacherLists />} />
            </Routes>
          </main>
          <footer className="bg-black bg-opacity-80 text-white py-4 flex flex-col items-center gap-2">
            <p className="magic-title text-base text-halloween-orange text-center">
              Ayuda a Diego: Aprendiendo con IA &copy; {new Date().getFullYear()}
              <span className="text-gray-600 text-xs font-sans ml-2">v{__APP_VERSION__}</span>
            </p>
            <div className="flex items-center gap-3">
              <img src="/img/logo_utn2.jpg" alt="Universidad Tecnológica Nacional" className="h-12 w-auto opacity-90" />
              <p className="text-gray-400 text-xs text-center">
                Desarrollado por Fabián Bernardino — Tecnología Educativa I, UTN
              </p>
            </div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
