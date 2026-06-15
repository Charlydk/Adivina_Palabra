import { useState, useEffect, useRef } from 'react';
import { gameHub } from '../services/gameHub';
import { useAuth } from '../context/AuthContext';

// GameSession shape as received from SignalR (dynamic — typed loosely on purpose)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GameSession = any;

export function useGame(gameId: string | undefined, alias: string | null) {
  const { session } = useAuth();
  const [game, setGame] = useState<GameSession>(null);
  const [messages, setMessages] = useState<{ alias: string; text: string }[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [definition, setDefinition] = useState<{ definition: string; bonus?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const aliasRef = useRef(alias);

  useEffect(() => {
    if (!gameId || !alias) return;
    // Keep ref current inside the effect to avoid reading it during render
    aliasRef.current = alias;
  }, [alias]);

  useEffect(() => {
    if (!gameId || !alias) return;

    let cancelled = false;

    const handleGameUpdated = (g: GameSession) => { if (!cancelled) setGame(g); };
    const handleReceiveMessage = (fromAlias: string, text: string) => {
      if (!cancelled) setMessages((prev) => [...prev, { alias: fromAlias, text }]);
    };
    const handleReceiveHint = (h: string) => { if (!cancelled) setHint(h); };
    const handleReceiveDefinition = (data: { definition: string; bonus?: string }) => {
      if (!cancelled) setDefinition(data);
    };

    const init = async () => {
      await gameHub.startConnection(session?.access_token);
      if (cancelled) return;

      // Register listeners AFTER connection is ready, so they land on the active connection
      gameHub.onGameUpdated(handleGameUpdated);
      gameHub.onReceiveMessage(handleReceiveMessage);
      gameHub.onReceiveHint(handleReceiveHint);
      gameHub.onReceiveDefinition(handleReceiveDefinition);

      await gameHub.joinGame(gameId, aliasRef.current ?? 'Invitado');
      if (!cancelled) setLoading(false);
    };

    init();

    return () => {
      cancelled = true;
      gameHub.offGameUpdated(handleGameUpdated);
      gameHub.offReceiveMessage(handleReceiveMessage);
      gameHub.offReceiveHint(handleReceiveHint);
      gameHub.offReceiveDefinition(handleReceiveDefinition);
    };
  }, [gameId, alias, session?.access_token]);

  // Clear hint and definition when a room advances to the next word
  useEffect(() => {
    if (game?.isRoom) {
      setHint(null);
      setDefinition(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.currentWordIndex]);

  const sendLetter = async (letter: string) => {
    if (gameId) await gameHub.processLetter(gameId, letter);
  };

  const sendMessage = async (text: string) => {
    if (gameId && alias) await gameHub.sendMessage(gameId, alias, text);
  };

  const requestHint = async (profile: string = '') => {
    if (gameId) await gameHub.requestHint(gameId, profile);
  };

  const requestDefinition = async (profile: string = '') => {
    if (gameId) await gameHub.requestDefinition(gameId, profile);
  };

  /** Advance a room session to the next word. Server no-ops when round is still InProgress. */
  const nextRound = async () => {
    if (gameId) await gameHub.nextRound(gameId);
  };

  return { game, messages, hint, definition, loading, sendLetter, sendMessage, requestHint, requestDefinition, nextRound };
}
