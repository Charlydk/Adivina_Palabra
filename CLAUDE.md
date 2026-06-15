# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ahorcado Pro is a full-stack hangman game built with **ASP.NET Core 10** (backend) and **React 19 + TypeScript** (frontend). It supports Solo, Local Versus, Online Coop, and Online Versus game modes, uses SignalR for real-time communication, and integrates Google Gemini AI for dynamic word/hint generation.

## Commands

### Backend

```powershell
cd backend/AhorcadoPro.Backend
dotnet run                     # Run the API (default: http://localhost:5000)
dotnet test ../AhorcadoPro.Tests  # Run all tests
dotnet test ../AhorcadoPro.Tests --filter "FullyQualifiedName~CreateGame"  # Run a single test
```

### Frontend

```powershell
cd frontend
npm install
npm run dev     # Dev server at http://localhost:5173
npm run build   # Type-check + production build
npm run lint    # ESLint
```

## Architecture

### Backend (`backend/AhorcadoPro.Backend/`)

The backend is a single ASP.NET Core project with no layering abstraction — logic lives directly in services.

**Key services (all in `Services/`):**
- `GameManager` — singleton that holds all active `GameSession` objects in a `ConcurrentDictionary<string, GameSession>`. All game mutations go through here. Uses `SemaphoreSlim` on each session for thread-safety under concurrent SignalR traffic.
- `GeminiService` (`IGeminiService`) — calls `gemini-1.5-flash` via HTTP. Falls back silently to the word bank if the API key is missing or the call fails. JSON responses from Gemini can be markdown-wrapped (`\`\`\`json`) and are stripped before deserialization.
- `GameCleanupService` — `IHostedService` that periodically calls `GameManager.CleanupIdleGames()` to remove stale sessions from memory.

**Real-time (`Hubs/GameHub.cs`):**
- SignalR hub mounted at `/hubs/game` (WebSockets-only — `skipNegotiation: true` on the client).
- Hub methods: `JoinGame`, `ProcessLetter`, `SendMessage`, `RequestHint`.
- After every mutation, the hub broadcasts `GameUpdated(GameSession)` to the entire SignalR group (= game room).

**Data (`Data/ApplicationDbContext.cs`):**
- `IdentityDbContext<ApplicationUser>` — handles ASP.NET Identity tables.
- `DbSet<Word>` — the word bank seeded at startup.
- `DbSet<Score>` — guest/user scores persisted after each game result.
- **Hybrid storage**: if `ConnectionStrings:Default` is empty or points to localhost, it switches automatically to `UseInMemoryDatabase`. Production needs a real PostgreSQL connection string.

**Auth (`Controllers/AuthController.cs`):**
- JWT-based. Tokens are signed with `Jwt:Key` from `appsettings.json`. The key in the repo is a dev placeholder — change it for any real deployment.

### Frontend (`frontend/src/`)

**Routing:** `react-router-dom` v7 in `App.tsx`. Pages: `Home`, `Auth`, `Game`.

**State/data flow:**
- `services/api.ts` — Axios instance. Reads `VITE_API_URL` (defaults to `http://localhost:5000/api`). JWT token auto-attached from `localStorage`.
- `services/gameHub.ts` — singleton `GameHubService` wrapping `@microsoft/signalr`. Reads `VITE_HUB_URL` (defaults to `http://localhost:5000/hubs/game`). Uses WebSocket-only transport.
- `hooks/useGame.ts` — consumes `gameHub`. Connects, joins the room, and exposes `sendLetter`, `sendMessage`, `requestHint`, and the live `game` state. Cleans up listeners on unmount.

**UI:**
- `components/LivingHangman.tsx` — SVG hangman animated with Framer Motion; reacts to `game.remainingAttempts`.
- Tailwind CSS v4 (PostCSS plugin, no `tailwind.config.js` — config is inline in CSS).
- Sound effects via HTML `<Audio>` in `public/sounds/`.

## Key Design Decisions

- **`GameSession` is mutable in-memory, not a DB entity.** Only `Score` and `Word` hit the database. Sessions are ephemeral and cleaned up by `GameCleanupService`.
- **`OnlineVersus` mode uses a race model** — each player has their own independent `Player1Progress`/`Player2Progress` on the same `WordToGuess`. The first to complete the word wins.
- **`OnlineCoop` / Solo share a single `GuessedLetters` + `IncorrectLetters` string** — any player in the group contributes to the same pool.
- **CORS split**: REST endpoints use `AllowAll`; SignalR (`SignalRPolicy`) requires explicit origins (`localhost:5173`) because WebSocket credentials require it.

## Configuration

All secrets are in `appsettings.json` (dev only — do not commit real keys):

| Key | Purpose |
|-----|---------|
| `ConnectionStrings:Default` | PostgreSQL (falls back to InMemory if localhost/empty) |
| `Jwt:Key` | JWT signing key — must be changed for production |
| `Gemini:ApiKey` | Google Gemini API key — AI features disabled if empty |

Frontend env vars (`.env` file in `frontend/`):
```
VITE_API_URL=http://localhost:5000/api
VITE_HUB_URL=http://localhost:5000/hubs/game
```

## Testing

Tests live in `backend/AhorcadoPro.Tests/`. They use xUnit + Moq. `GameManager` is tested with an in-memory `ApplicationDbContext` — no external dependencies required.
