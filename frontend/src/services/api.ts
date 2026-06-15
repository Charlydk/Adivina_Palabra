import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export default api;

// ── Teacher Room helpers ────────────────────────────────────────────────────

export interface WordListWord {
  text: string;
  definition?: string;
  category?: string;
}

export interface CreateWordListPayload {
  name: string;
  ownerAlias?: string;
  words: WordListWord[];
}

export interface CreateWordListResult {
  id: number;
  name: string;
  count: number;
}

export interface CreateRoomPayload {
  wordListId: number;
  alias?: string;
  maxAttempts?: number;
}

/** Response from POST /api/rooms — no gameId; teacher does not enter a game. */
export interface CreateRoomResult {
  joinCode: string;
  listName: string;
  totalWords: number;
}

export interface ResolveRoomCodeResult {
  listName: string;
  totalWords: number;
}

export interface JoinRoomResult {
  gameId: string;
}

/** Create a persisted word list for classroom use. */
export async function createWordList(payload: CreateWordListPayload): Promise<CreateWordListResult> {
  const res = await api.post<CreateWordListResult>('/wordlists', payload);
  return res.data;
}

/**
 * Register a room from an existing word list.
 * Returns join code metadata only — no GameSession is created here.
 * The teacher stays on the success screen and shares the code.
 */
export async function createRoom(payload: CreateRoomPayload): Promise<CreateRoomResult> {
  const res = await api.post<CreateRoomResult>('/rooms', payload);
  return res.data;
}

/** Resolve a 6-char join code to word list metadata (no gameId). */
export async function resolveRoomCode(code: string): Promise<ResolveRoomCodeResult> {
  const res = await api.get<ResolveRoomCodeResult>(`/rooms/resolve/${encodeURIComponent(code)}`);
  return res.data;
}

/**
 * Student joins a room by code — creates an independent Solo GameSession.
 * Returns { gameId } to navigate to the game.
 */
export async function joinRoom(code: string, alias: string): Promise<JoinRoomResult> {
  const res = await api.post<JoinRoomResult>('/rooms/join', { code, alias });
  return res.data;
}

export interface WordListSummary {
  id: number;
  name: string;
  ownerAlias: string | null;
  joinCode: string | null;
  createdAt: string;
  wordCount: number;
}

/** Fetch word lists created by a teacher (by ownerAlias). Returns newest first, up to 50. */
export async function getWordLists(ownerAlias: string): Promise<WordListSummary[]> {
  const res = await api.get<WordListSummary[]>('/wordlists', { params: { ownerAlias } });
  return res.data;
}

// ── Classroom mode helpers ──────────────────────────────────────────────────

export interface CreateClassroomPayload {
  name: string;
  words: Array<{ text: string; definition?: string; category?: string }>;
  alias?: string;
  maxAttempts?: number;
}

export interface CreateClassroomResult {
  gameId: string;
  joinCode: string;
  listName: string;
  totalWords: number;
}

export interface JoinClassroomResult {
  gameId: string;
}

/**
 * Teacher creates a classroom session — ephemeral, no DB record.
 * Returns gameId so the teacher navigates to /game/{gameId} as spectator.
 */
export async function createClassroomRoom(payload: CreateClassroomPayload): Promise<CreateClassroomResult> {
  const res = await api.post<CreateClassroomResult>('/rooms/clase', payload);
  return res.data;
}

/**
 * Student (or teacher rejoining) resolves a classroom join code to a gameId.
 * Returns { gameId } to navigate to /game/{gameId}.
 */
export async function joinClassroom(code: string, alias: string): Promise<JoinClassroomResult> {
  const res = await api.post<JoinClassroomResult>('/rooms/join-clase', { code, alias });
  return res.data;
}
