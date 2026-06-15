using System.Collections.Concurrent;
using AhorcadoPro.Backend.Models;
using AhorcadoPro.Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace AhorcadoPro.Backend.Services
{
    public class GameManager
    {
        private readonly ConcurrentDictionary<string, GameSession> _activeGames = new();

        // Code registry: maps 6-char join codes to WordList DB primary keys.
        // One code → many independent student GameSessions; codes live until server restart.
        private readonly ConcurrentDictionary<string, int> _roomCodes = new();

        // Classroom code registry: maps 6-char codes to live classroom GameSession IDs.
        // Unlike _roomCodes, these point directly to an in-memory GameSession (not a DB record).
        private readonly ConcurrentDictionary<string, string> _classroomCodes = new();

        // Unambiguous alphabet — excludes O/0/I/1 to prevent visual confusion when read aloud or typed on mobile
        private const string JoinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<GameManager> _logger;
        private readonly Random _random = new();

        public GameManager(IServiceProvider serviceProvider, ILogger<GameManager> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task<GameSession> CreateGame(GameMode mode, string? creatorAlias, int maxAttempts = 6, string? theme = null, string? wordOverride = null, string? categoryOverride = null, string? educationalCategory = null, string? profile = null)
        {
            string? wordText = wordOverride?.ToUpper();
            string? category = categoryOverride;

            if (wordText == null && !string.IsNullOrEmpty(theme))
            {
                using var scope = _serviceProvider.CreateScope();
                var ai = scope.ServiceProvider.GetRequiredService<IAiService>();
                var aiResult = await ai.GenerateWordAsync(theme);
                if (aiResult != null)
                {
                    wordText = aiResult.Word;
                    category = aiResult.Category;
                }
            }

            if (wordText == null)
            {
                var word = await GetRandomWord(educationalCategory, profile);
                wordText = word?.Text.ToUpper() ?? "AHORCADO";
                category = word?.Category ?? "general";
            }

            var game = new GameSession
            {
                Mode = mode,
                WordToGuess = wordText,
                Category = category ?? "General",
                MaxAttempts = maxAttempts,
                RemainingAttempts = maxAttempts,
                Player1Alias = creatorAlias,
                Player1RemainingAttempts = maxAttempts,
                Player2RemainingAttempts = maxAttempts
            };

            _activeGames[game.Id] = game;
            return game;
        }

        public GameSession? GetGame(string gameId) =>
            _activeGames.TryGetValue(gameId, out var game) ? game : null;

        // ──────────────────────────────────────────────────────────────
        // Room session API (teacher word rooms)
        // ──────────────────────────────────────────────────────────────

        /// <summary>
        /// Generates a 6-character join code using an unambiguous alphabet.
        /// Does NOT register the code — caller is responsible for registration.
        /// </summary>
        public string GenerateJoinCode()
        {
            return new string(Enumerable.Range(0, 6)
                .Select(_ => JoinCodeAlphabet[_random.Next(JoinCodeAlphabet.Length)])
                .ToArray());
        }

        /// <summary>
        /// Creates a room entry: generates a join code and maps it to the DB word list ID.
        /// Does NOT create any GameSession. Students join later via <see cref="JoinRoomGame"/>.
        /// </summary>
        /// <param name="listName">Display name of the word list (for metadata only).</param>
        /// <param name="words">Word snapshot — used only to validate the list is non-empty.</param>
        /// <param name="wordListId">Database primary key of the WordList entity.</param>
        /// <returns>The generated 6-char join code.</returns>
        public string CreateRoom(string listName, List<RoomWord> words, int wordListId)
        {
            if (words == null || words.Count == 0)
                throw new ArgumentException("Word list must contain at least one word.", nameof(words));

            // Generate unique join code with collision retry
            string code;
            int attempts = 0;
            do
            {
                code = GenerateJoinCode();
                attempts++;
                if (attempts > 10)
                {
                    code = new string(Enumerable.Range(0, 8)
                        .Select(_ => JoinCodeAlphabet[_random.Next(JoinCodeAlphabet.Length)])
                        .ToArray());
                    break;
                }
            }
            while (_roomCodes.ContainsKey(code));

            _roomCodes[code] = wordListId;
            return code;
        }

        /// <summary>
        /// Resolves a join code to the DB WordList ID it maps to.
        /// Returns null if the code is unknown.
        /// </summary>
        public int? GetWordListIdByCode(string code) =>
            _roomCodes.TryGetValue(code, out var id) ? id : null;

        /// <summary>
        /// Creates a brand-new Solo GameSession for a student joining via room code.
        /// Loads the word list from the database. Returns null if the code is unknown
        /// or the word list no longer exists in DB.
        /// Each student who calls this gets their own independent GameSession.
        /// </summary>
        public async Task<GameSession?> JoinRoomGame(string code, string? alias)
        {
            if (!_roomCodes.TryGetValue(code, out var wordListId))
            {
                // Code not in memory (e.g. server restarted) — fall back to DB lookup by stored join_code
                using var fallbackScope = _serviceProvider.CreateScope();
                var fallbackDb = fallbackScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var stored = await fallbackDb.WordLists.FirstOrDefaultAsync(l => l.JoinCode == code);
                if (stored == null) return null;
                wordListId = (int)stored.Id;
                _roomCodes[code] = wordListId; // restore to memory for subsequent requests
            }

            // Load word list from DB
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var list = await context.WordLists
                .Include(l => l.Items)
                .FirstOrDefaultAsync(l => l.Id == wordListId);

            if (list == null) return null;

            var orderedItems = list.Items.OrderBy(i => i.Position).ToList();
            if (orderedItems.Count == 0) return null;

            var roomWords = orderedItems.Select(i => new RoomWord
            {
                Text = i.Text.ToUpper(),
                Definition = i.Definition,
                Category = i.Category
            }).ToList();

            var first = roomWords[0];

            var game = new GameSession
            {
                Mode = GameMode.Solo,
                Status = GameStatus.InProgress,   // Solo starts immediately
                WordToGuess = first.Text,
                Category = first.Category ?? list.Name,
                MaxAttempts = 6,
                RemainingAttempts = 6,
                Player1RemainingAttempts = 6,
                Player2RemainingAttempts = 6,
                Player1Alias = alias,
                IsRoom = true,
                RoomWords = roomWords,
                CurrentWordIndex = 0,
                RoomCompleted = false,
                JoinCode = code,
                ListName = list.Name
            };

            _activeGames[game.Id] = game;
            return game;
        }

        /// <summary>
        /// Creates an in-memory room session seeded from the provided word snapshot.
        /// Kept for backward compatibility with existing tests (Slice 2).
        /// New code should use <see cref="CreateRoom"/> + <see cref="JoinRoomGame"/> instead.
        /// </summary>
        public async Task<GameSession> CreateRoomGame(
            List<RoomWord> words,
            string? alias = null,
            int maxAttempts = 6,
            string? listName = null)
        {
            if (words == null || words.Count == 0)
                throw new ArgumentException("Word list must contain at least one word.", nameof(words));

            var first = words[0];
            string wordText = first.Text.ToUpper();

            // Normalize: ensure Text on each RoomWord is uppercase (mirror CreateGame behavior)
            var snapshot = words.Select(w => new RoomWord
            {
                Text = w.Text.ToUpper(),
                Definition = w.Definition,
                Category = w.Category
            }).ToList();

            var game = new GameSession
            {
                Mode = GameMode.OnlineCoop,
                WordToGuess = wordText,
                Category = first.Category ?? "General",
                MaxAttempts = maxAttempts,
                RemainingAttempts = maxAttempts,
                Player1Alias = alias,
                Player1RemainingAttempts = maxAttempts,
                Player2RemainingAttempts = maxAttempts,
                IsRoom = true,
                RoomWords = snapshot,
                CurrentWordIndex = 0,
                ListName = listName
            };

            // Register a new code → wordListId=-1 as a sentinel for legacy in-memory rooms
            // (These rooms use a synthetic code not tied to any DB record)
            string code;
            int attempts = 0;
            do
            {
                code = GenerateJoinCode();
                attempts++;
                if (attempts > 10)
                {
                    code = new string(Enumerable.Range(0, 8)
                        .Select(_ => JoinCodeAlphabet[_random.Next(JoinCodeAlphabet.Length)])
                        .ToArray());
                    break;
                }
            }
            while (_roomCodes.ContainsKey(code));

            game.JoinCode = code;
            _activeGames[game.Id] = game;
            // Store -1 as sentinel: code exists, maps to no DB record
            _roomCodes[code] = -1;

            await Task.CompletedTask;
            return game;
        }

        /// <summary>
        /// Resolves a join code to a game ID for legacy room sessions created via <see cref="CreateRoomGame"/>.
        /// Returns null if not found or if the code points to a new-style DB-backed room.
        /// </summary>
        public string? GetGameIdByCode(string code)
        {
            // Legacy: find any active game whose JoinCode matches this code
            var game = _activeGames.Values.FirstOrDefault(g => g.JoinCode == code);
            return game?.Id;
        }

        // ──────────────────────────────────────────────────────────────
        // Classroom session API (teacher + students share one live GameSession)
        // ──────────────────────────────────────────────────────────────

        /// <summary>
        /// Creates a shared OnlineCoop GameSession for classroom mode.
        /// The teacher acts as spectator (HostAlias); students join as Player1/Player2.
        /// The session is ephemeral — no DB record is created.
        /// </summary>
        /// <returns>The created GameSession and the 6-char join code.</returns>
        public (GameSession game, string joinCode) CreateClassroomSession(
            string hostAlias,
            List<RoomWord> words,
            string listName,
            int maxAttempts = 6)
        {
            if (words == null || words.Count == 0)
                throw new ArgumentException("Word list must contain at least one word.", nameof(words));

            var snapshot = words.Select(w => new RoomWord
            {
                Text = w.Text.ToUpper(),
                Definition = w.Definition,
                Category = w.Category
            }).ToList();

            var first = snapshot[0];
            var game = new GameSession
            {
                Mode = GameMode.OnlineCoop,
                Status = GameStatus.Waiting,
                WordToGuess = first.Text,
                Category = first.Category ?? listName,
                MaxAttempts = maxAttempts,
                RemainingAttempts = maxAttempts,
                Player1RemainingAttempts = maxAttempts,
                Player2RemainingAttempts = maxAttempts,
                IsRoom = true,
                RoomWords = snapshot,
                CurrentWordIndex = 0,
                RoomCompleted = false,
                ListName = listName,
                HostAlias = hostAlias
            };

            // Generate a code that doesn't collide with either _roomCodes or _classroomCodes
            string code;
            int attempts = 0;
            do
            {
                code = GenerateJoinCode();
                attempts++;
                if (attempts > 10)
                {
                    code = new string(Enumerable.Range(0, 8)
                        .Select(_ => JoinCodeAlphabet[_random.Next(JoinCodeAlphabet.Length)])
                        .ToArray());
                    break;
                }
            }
            while (_roomCodes.ContainsKey(code) || _classroomCodes.ContainsKey(code));

            game.JoinCode = code;
            _classroomCodes[code] = game.Id;
            _activeGames[game.Id] = game;

            return (game, code);
        }

        /// <summary>
        /// Resolves a classroom join code to the live GameSession ID it maps to.
        /// Returns null if the code is unknown.
        /// </summary>
        public string? GetGameIdByClassroomCode(string code) =>
            _classroomCodes.TryGetValue(code, out var id) ? id : null;

        /// <summary>
        /// Advances a room session to the next word. No-op if the session is still InProgress
        /// or the game does not exist. Marks <c>RoomCompleted</c> when the last word ends.
        /// Must be called inside the hub after acquiring the group lock; this method acquires StateLock internally.
        /// </summary>
        public async Task<GameSession?> AdvanceToNextWord(string gameId)
        {
            if (!_activeGames.TryGetValue(gameId, out var game)) return null;

            await game.StateLock.WaitAsync();
            try
            {
                // Guard: only advance when a round has concluded
                if (game.Status != GameStatus.Won && game.Status != GameStatus.Lost)
                    return game;

                int nextIndex = game.CurrentWordIndex + 1;

                if (nextIndex >= game.RoomWords.Count)
                {
                    // All words completed — mark room as done; do not mutate index or word
                    game.RoomCompleted = true;
                    return game;
                }

                var nextWord = game.RoomWords[nextIndex];

                game.CurrentWordIndex = nextIndex;
                game.WordToGuess = nextWord.Text;
                game.Category = nextWord.Category ?? game.Category;
                game.GuessedLetters = string.Empty;
                game.IncorrectLetters = string.Empty;
                game.RemainingAttempts = game.MaxAttempts;
                game.Status = GameStatus.InProgress;
                game.FinishedAt = null;
                game.LastActivity = DateTime.UtcNow;

                return game;
            }
            finally
            {
                game.StateLock.Release();
            }
        }

        // ──────────────────────────────────────────────────────────────

        public async Task<GameSession?> AddPlayerToGame(string gameId, string connectionId, string alias, Guid? userId = null)
        {
            if (!_activeGames.TryGetValue(gameId, out var game)) return null;

            await game.StateLock.WaitAsync();
            try
            {
                game.LastActivity = DateTime.UtcNow;

                // Classroom host: teacher reconnects as spectator — do NOT assign a player slot
                if (game.HostAlias != null && alias == game.HostAlias)
                {
                    game.HostId = connectionId;
                    return game;
                }

                if (game.Player1Id == null)
                {
                    game.Player1Id = connectionId;
                    game.Player1Alias = alias;
                    game.Player1UserId = userId;
                    if (game.Mode == GameMode.Solo || game.Mode == GameMode.VersusLocal)
                        game.Status = GameStatus.InProgress;
                }
                else if (game.Player2Id == null && game.Player1Id != connectionId)
                {
                    game.Player2Id = connectionId;
                    game.Player2Alias = alias;
                    game.Player2UserId = userId;
                    game.Status = GameStatus.InProgress;
                    game.CurrentTurnPlayerId = game.Player1Id; // P1 always goes first
                }
            }
            finally
            {
                game.StateLock.Release();
            }
            return game;
        }

        public async Task<GameSession?> ProcessLetter(string gameId, string connectionId, string letter)
        {
            if (!_activeGames.TryGetValue(gameId, out var game)) return null;

            await game.StateLock.WaitAsync();
            try
            {
                game.LastActivity = DateTime.UtcNow;
                if (game.Status != GameStatus.InProgress) return game;

                letter = letter.ToUpper();

                if (game.Mode == GameMode.OnlineVersus)
                    return ProcessVersusTurnLetter(game, connectionId, letter);
                if (game.Mode == GameMode.OnlineCoop)
                    return ProcessTurnBasedLetter(game, connectionId, letter);
                return ProcessCoopOrSoloLetter(game, connectionId, letter);
            }
            finally
            {
                game.StateLock.Release();
            }
        }

        private GameSession ProcessVersusTurnLetter(GameSession game, string connectionId, string letter)
        {
            if (game.CurrentTurnPlayerId != connectionId) return game;

            bool isP1 = connectionId == game.Player1Id;
            string progress = isP1 ? (game.Player1Progress ?? "") : (game.Player2Progress ?? "");
            string incorrect = isP1 ? (game.Player1Incorrect ?? "") : (game.Player2Incorrect ?? "");
            int remaining = isP1 ? game.Player1RemainingAttempts : game.Player2RemainingAttempts;

            if (remaining <= 0) return game; // jugador eliminado

            if (progress.Contains(letter) || incorrect.Contains(letter)) return game;

            if (game.WordToGuess.Contains(letter))
                progress += letter;
            else
            {
                incorrect += letter;
                remaining--;
            }

            if (isP1)
            {
                game.Player1Progress = progress;
                game.Player1Incorrect = incorrect;
                game.Player1RemainingAttempts = remaining;
            }
            else
            {
                game.Player2Progress = progress;
                game.Player2Incorrect = incorrect;
                game.Player2RemainingAttempts = remaining;
            }

            // ¿Completó la palabra? Gana este jugador
            if (game.WordToGuess.All(c => progress.Contains(c)))
            {
                game.Status = GameStatus.Won;
                game.WinnerAlias = isP1 ? game.Player1Alias : game.Player2Alias;
                game.FinishedAt = DateTime.UtcNow;
                _ = RecordScore(
                    game.WinnerAlias,
                    isP1 ? game.Player1UserId : game.Player2UserId,
                    game, true, incorrect.Length
                );
                return game;
            }

            // ¿Agotó los intentos? Pierde este jugador, gana el otro
            if (remaining <= 0)
            {
                game.Status = GameStatus.Won;
                game.WinnerAlias = isP1 ? game.Player2Alias : game.Player1Alias;
                game.FinishedAt = DateTime.UtcNow;
                _ = RecordScore(
                    game.WinnerAlias,
                    isP1 ? game.Player2UserId : game.Player1UserId,
                    game, true, 0
                );
                return game;
            }

            // Alternar turno
            game.CurrentTurnPlayerId = isP1 ? game.Player2Id : game.Player1Id;
            return game;
        }

        private GameSession ProcessTurnBasedLetter(GameSession game, string connectionId, string letter)
        {
            // Solo puede jugar quien tiene el turno
            if (game.CurrentTurnPlayerId != connectionId) return game;

            if (game.GuessedLetters.Contains(letter) || game.IncorrectLetters.Contains(letter)) return game;

            if (game.WordToGuess.Contains(letter))
                game.GuessedLetters += letter;
            else
            {
                game.IncorrectLetters += letter;
                game.RemainingAttempts--;
            }

            bool won = game.WordToGuess.All(c => game.GuessedLetters.Contains(c));
            if (won)
            {
                game.Status = GameStatus.Won;
                game.FinishedAt = DateTime.UtcNow;
                bool isP1 = connectionId == game.Player1Id;
                _ = RecordScore(
                    isP1 ? game.Player1Alias : game.Player2Alias,
                    isP1 ? game.Player1UserId : game.Player2UserId,
                    game, true, game.IncorrectLetters.Length
                );
            }
            else if (game.RemainingAttempts <= 0)
            {
                game.Status = GameStatus.Lost;
                game.FinishedAt = DateTime.UtcNow;
                _ = RecordScore(game.Player1Alias, game.Player1UserId, game, false, game.MaxAttempts);
            }
            else
            {
                // Alternar turno
                game.CurrentTurnPlayerId = connectionId == game.Player1Id
                    ? game.Player2Id
                    : game.Player1Id;
            }

            return game;
        }

        private GameSession ProcessCoopOrSoloLetter(GameSession game, string connectionId, string letter)
        {
            if (game.GuessedLetters.Contains(letter) || game.IncorrectLetters.Contains(letter)) return game;

            if (game.WordToGuess.Contains(letter))
                game.GuessedLetters += letter;
            else
            {
                game.IncorrectLetters += letter;
                game.RemainingAttempts--;
            }

            bool won = game.WordToGuess.All(c => game.GuessedLetters.Contains(c));
            if (won)
            {
                game.Status = GameStatus.Won;
                game.FinishedAt = DateTime.UtcNow;
                int attemptsUsed = game.IncorrectLetters.Length;
                _ = RecordScore(game.Player1Alias, game.Player1UserId, game, true, attemptsUsed);
            }
            else if (game.RemainingAttempts <= 0)
            {
                game.Status = GameStatus.Lost;
                game.FinishedAt = DateTime.UtcNow;
                _ = RecordScore(game.Player1Alias, game.Player1UserId, game, false, game.MaxAttempts);
            }

            return game;
        }

        private int CalculatePoints(GameSession game, bool won, int attemptsUsed)
        {
            if (!won) return 0;
            var basePoints = game.Mode switch
            {
                GameMode.Solo => 100,
                GameMode.VersusLocal => 120,
                GameMode.OnlineCoop => 150,
                GameMode.OnlineVersus => 200,
                _ => 100
            };
            int remaining = game.MaxAttempts - attemptsUsed;
            return basePoints + (remaining * 10);
        }

        private async Task RecordScore(string? alias, Guid? userId, GameSession game, bool won, int attemptsUsed)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                context.Scores.Add(new Score
                {
                    UserId = userId,
                    GuestAlias = userId == null ? alias : null,
                    Points = CalculatePoints(game, won, attemptsUsed),
                    Mode = game.Mode.ToString(),
                    Word = game.WordToGuess,
                    Category = game.Category,
                    Won = won,
                    AttemptsUsed = attemptsUsed,
                    MaxAttempts = game.MaxAttempts
                });
                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to record score for game {GameId}", game.Id);
            }
        }

        public async Task HandleDisconnect(string connectionId)
        {
            var game = _activeGames.Values.FirstOrDefault(g => g.Player1Id == connectionId || g.Player2Id == connectionId);
            if (game != null)
            {
                await game.StateLock.WaitAsync();
                try { game.LastActivity = DateTime.UtcNow; }
                finally { game.StateLock.Release(); }
            }
        }

        public void EndGame(string gameId)
        {
            if (_activeGames.TryRemove(gameId, out var removed))
            {
                _logger.LogInformation("Game {GameId} removed", gameId);

                // Clean up classroom code if this was a classroom session
                if (removed.JoinCode != null && _classroomCodes.TryGetValue(removed.JoinCode, out var classroomGameId) && classroomGameId == gameId)
                {
                    _classroomCodes.TryRemove(removed.JoinCode, out _);
                    return;
                }

                // Only remove tarea room codes for legacy rooms (CreateRoomGame, sentinel value -1).
                // New-style DB-backed rooms (CreateRoom/JoinRoomGame) keep their codes alive
                // so future students can still join with the same code.
                if (removed.JoinCode != null &&
                    _roomCodes.TryGetValue(removed.JoinCode, out var storedId) &&
                    storedId == -1)
                {
                    _roomCodes.TryRemove(removed.JoinCode, out _);
                }
            }
        }

        public void CleanupIdleGames(TimeSpan maxIdleTime)
        {
            var now = DateTime.UtcNow;
            var stale = _activeGames
                .Where(kv => now - kv.Value.LastActivity > maxIdleTime)
                .Select(kv => kv.Key)
                .ToList();

            foreach (var id in stale)
            {
                _logger.LogInformation("Cleaning up idle game {GameId}", id);
                if (_activeGames.TryRemove(id, out var removed))
                {
                    // Clean up classroom code if this was a classroom session
                    if (removed.JoinCode != null && _classroomCodes.TryGetValue(removed.JoinCode, out var classroomGameId) && classroomGameId == id)
                    {
                        _classroomCodes.TryRemove(removed.JoinCode, out _);
                        continue;
                    }

                    // Clean up legacy tarea room codes (sentinel -1)
                    if (removed.JoinCode != null &&
                        _roomCodes.TryGetValue(removed.JoinCode, out var storedId) &&
                        storedId == -1)
                    {
                        _roomCodes.TryRemove(removed.JoinCode, out _);
                    }
                }
            }
        }

        private async Task<Word?> GetRandomWord(string? educationalCategory = null, string? profile = null)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var query = context.Words.Where(w => w.IsActive);

            if (!string.IsNullOrEmpty(educationalCategory))
                query = query.Where(w => w.Category == educationalCategory);

            if (!string.IsNullOrEmpty(profile))
                query = query.Where(w => w.TargetProfile == profile || w.TargetProfile == "ambos");

            var count = await query.CountAsync();
            if (count == 0)
            {
                // Fallback: ignore filters and pick any active word
                count = await context.Words.CountAsync(w => w.IsActive);
                if (count == 0) return null;
                var fallbackSkip = _random.Next(count);
                return await context.Words.Where(w => w.IsActive).Skip(fallbackSkip).FirstOrDefaultAsync();
            }

            var skip = _random.Next(count);
            return await query.Skip(skip).FirstOrDefaultAsync();
        }
    }
}
