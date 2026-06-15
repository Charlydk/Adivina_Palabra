# Documentación Técnica — Ayuda a Diego

## Descripción general

**Ayuda a Diego: Aprendiendo con IA** es una plataforma educativa de adivinanza de palabras construida con ASP.NET Core 10 (backend) y React 19 + TypeScript (frontend). Está diseñada para uso en el aula y en el hogar, con soporte para docentes que quieren usar su propio vocabulario y alumnos de primaria o adultos mayores.

---

## Arquitectura del sistema

### Backend (`backend/AhorcadoPro.Backend/`)

El backend es una API REST + SignalR Hub sin capas de abstracción adicionales. Toda la lógica vive directamente en servicios.

#### Servicios clave

| Servicio | Responsabilidad |
|---------|----------------|
| `GameManager` | Singleton. Mantiene todas las `GameSession` activas en un `ConcurrentDictionary`. Usa `SemaphoreSlim` por sesión para thread-safety bajo tráfico SignalR concurrente. |
| `AiService` | Llama a la API de Groq (modelo llama) para generar pistas y definiciones educativas. Si la clave está ausente o la llamada falla, degrada silenciosamente. |
| `GameCleanupService` | `IHostedService` que limpia sesiones inactivas periódicamente. |

#### Hub SignalR (`Hubs/GameHub.cs`)

Montado en `/hubs/game`. Usa transporte WebSocket únicamente (`skipNegotiation: true` en el cliente).

Métodos del hub: `JoinGame`, `ProcessLetter`, `SendMessage`, `RequestHint`.

Tras cada mutación, emite `GameUpdated(GameSession)` al grupo (= sala).

#### Persistencia

- **Híbrida**: si `ConnectionStrings:Default` apunta a localhost o está vacío → `UseInMemoryDatabase`. Con una cadena de PostgreSQL real → Supabase.
- **`ApplicationDbContext`**: `IdentityDbContext<ApplicationUser>` con `DbSet<Word>`, `DbSet<Score>`, `DbSet<WordList>`, `DbSet<WordListItem>`.
- **`GameSession`** es mutable en memoria y no se persiste — solo `Score`, `Word`, `WordList` y `WordListItem` tocan la base de datos.

#### Salas del docente

El docente crea una `WordList` (lista con nombre + código de 6 chars) y sus `WordListItem` (palabras con definición y categoría opcionales). Los alumnos usan el código para unirse:

- **Modo Tarea** (`/api/rooms/join`): crea una `GameSession` independiente por alumno. Cada uno juega a su propio ritmo.
- **Clase en vivo**: el docente inicia su propia sesión y la proyecta. Los alumnos dictan letras verbalmente; no se necesitan dispositivos de alumnos.

### Frontend (`frontend/src/`)

#### Routing

`react-router-dom` v7 en `App.tsx`. Rutas: `/`, `/game/:gameId`, `/auth`, `/leaderboard`, `/daily`, `/create-room`, `/teacher/lists`.

#### Estado y datos

| Módulo | Rol |
|--------|-----|
| `services/api.ts` | Axios. Lee `VITE_API_URL`. JWT adjunto automáticamente desde `localStorage`. |
| `services/gameHub.ts` | Singleton `GameHubService` wrapping `@microsoft/signalr`. WebSocket-only. |
| `hooks/useGame.ts` | Conecta al hub, une al room, expone `sendLetter`, `sendMessage`, `requestHint`, `nextRound` y el estado `game` en vivo. |
| `hooks/useGameSounds.ts` | Maneja música de fondo, sonidos de acierto/error, victoria, derrota y último intento. |

#### Componentes destacados

- **`LivingHangman.tsx`**: muestra imágenes por fase (Fase1–Fase6 en progresión, Fase7B = ganó, Fase7A = perdió). Animado con Framer Motion. Soporta tamaños `xs`, `sm`, `md` y `full`.
- **`Navbar.tsx`**: navegación sticky con título en fuente Cinzel Decorative.
- **`Game.tsx`**: layout con imagen hero en la parte superior (ancho completo) y controles en 3 columnas debajo.

#### Perfiles de usuario

| Perfil | Comportamiento diferencial |
|--------|---------------------------|
| `primaria` | UI compacta, pista bajo demanda |
| `adultos_mayores` | Fuente y botones más grandes, pista automática al 2° error, teclado ampliado |

---

## Alegoría visual

Las imágenes del juego muestran a un nene intentando entrar a un castillo custodiado por un dragón amistoso. A medida que el jugador comete errores, la escena se vuelve más tensa. Al ganar, la puerta se abre con confetti; al perder, el nene se aleja con el mensaje "Lo intentaré nuevamente...".

| Imagen | Momento |
|--------|---------|
| `Fase1.png` | Inicio (0 errores) |
| `Fase2–Fase6.png` | Progresión de errores |
| `Fase7B.png` | Victoria |
| `Fase7A.png` | Derrota |

---

## Flujo de una partida con sala docente

1. El docente crea una lista en `/teacher/lists` o `/create-room`.
2. El sistema persiste la `WordList` y sus ítems en Supabase y genera un código de 6 chars.
3. El alumno ingresa el código en la pantalla principal → se crea una `GameSession` con las palabras de esa lista.
4. Cada palabra se juega como una ronda independiente. Al terminar, se muestra la definición (del docente o generada por IA).
5. Al completar todas las palabras, aparece el panel de fin de lista.

---

## Configuración

### Backend (`appsettings.json` — no commitear)

| Clave | Descripción |
|-------|-------------|
| `ConnectionStrings:Default` | Cadena PostgreSQL de Supabase (vacío = InMemory) |
| `Jwt:Key` | Clave de firma JWT (cambiar en producción) |
| `Groq:ApiKey` | Clave de Groq para IA (opcional — degrada sin ella) |

### Frontend (`.env`)

| Variable | Valor por defecto |
|----------|------------------|
| `VITE_API_URL` | `http://localhost:5000/api` |
| `VITE_HUB_URL` | `http://localhost:5000/hubs/game` |

---

## Tests

Tests en `backend/AhorcadoPro.Tests/` usando xUnit + Moq. `GameManager` se prueba con `ApplicationDbContext` en memoria — sin dependencias externas.

```powershell
dotnet test backend\AhorcadoPro.Tests
# Filtrar un test específico:
dotnet test backend\AhorcadoPro.Tests --filter "FullyQualifiedName~NombreDelTest"
```
