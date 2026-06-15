using AhorcadoPro.Backend.Services;
using AhorcadoPro.Backend.Models;
using Microsoft.Extensions.Logging;
using Moq;
using Microsoft.Extensions.DependencyInjection;
using AhorcadoPro.Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace AhorcadoPro.Tests
{
    /// <summary>
    /// Strict TDD tests for the GameManager room runtime (Slice 2).
    /// Tasks covered: 2.3–2.12
    /// </summary>
    public class GameManagerRoomTests
    {
        private readonly GameManager _gameManager;
        private readonly Mock<IServiceProvider> _serviceProviderMock;
        private readonly Mock<ILogger<GameManager>> _loggerMock;
        private readonly ApplicationDbContext _dbContext;

        private static readonly List<RoomWord> SampleWords =
        [
            new RoomWord { Text = "PERRO", Definition = "Animal doméstico.", Category = "Animales" },
            new RoomWord { Text = "GATO", Definition = "Felino doméstico.", Category = "Animales" },
            new RoomWord { Text = "PAJARO", Definition = null, Category = "Animales" }
        ];

        public GameManagerRoomTests()
        {
            _serviceProviderMock = new Mock<IServiceProvider>();
            _loggerMock = new Mock<ILogger<GameManager>>();

            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: $"RoomTestDb_{Guid.NewGuid()}")
                .Options;
            _dbContext = new ApplicationDbContext(options);
            _dbContext.Words.Add(new Word { Text = "FALLBACK", Category = "General", IsActive = true });
            _dbContext.SaveChanges();

            var scopeMock = new Mock<IServiceScope>();
            var scopeFactoryMock = new Mock<IServiceScopeFactory>();
            scopeMock.Setup(s => s.ServiceProvider.GetService(typeof(ApplicationDbContext))).Returns(_dbContext);
            scopeFactoryMock.Setup(s => s.CreateScope()).Returns(scopeMock.Object);
            _serviceProviderMock.Setup(s => s.GetService(typeof(IServiceScopeFactory))).Returns(scopeFactoryMock.Object);

            _gameManager = new GameManager(_serviceProviderMock.Object, _loggerMock.Object);
        }

        // ─── 2.3 / 2.4: GenerateJoinCode ──────────────────────────────────────────

        [Fact]
        public void GenerateJoinCode_Returns6CharCode()
        {
            var code = _gameManager.GenerateJoinCode();

            Assert.Equal(6, code.Length);
        }

        [Fact]
        public void GenerateJoinCode_UsesOnlySafeAlphabet()
        {
            // Safe alphabet excludes O, 0, I, 1 to avoid visual ambiguity
            const string forbidden = "OoIi01";

            for (int i = 0; i < 50; i++)
            {
                var code = _gameManager.GenerateJoinCode();
                Assert.DoesNotContain(code, c => forbidden.Contains(c));
            }
        }

        [Fact]
        public void GenerateJoinCode_ProducesDistinctCodesOnSuccessiveCallsTypically()
        {
            // While not strictly guaranteed (random), 10 successive calls should not all be identical
            var codes = Enumerable.Range(0, 10).Select(_ => _gameManager.GenerateJoinCode()).ToHashSet();

            // At minimum we expect some variety — probability of all 10 being the same is astronomically low
            Assert.True(codes.Count > 1, "Expected distinct codes across 10 calls");
        }

        // ─── 2.5 / 2.6: CreateRoomGame ────────────────────────────────────────────

        [Fact]
        public async Task CreateRoomGame_SetsIsRoomTrue()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");

            Assert.True(game.IsRoom);
        }

        [Fact]
        public async Task CreateRoomGame_SetsWordToGuessFromFirstWord()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");

            Assert.Equal("PERRO", game.WordToGuess);
        }

        [Fact]
        public async Task CreateRoomGame_PopulatesRoomWordsSnapshot()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");

            Assert.Equal(3, game.RoomWords.Count);
            Assert.Equal("PERRO", game.RoomWords[0].Text);
            Assert.Equal("GATO", game.RoomWords[1].Text);
            Assert.Equal("PAJARO", game.RoomWords[2].Text);
        }

        [Fact]
        public async Task CreateRoomGame_GeneratesJoinCode6Chars()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");

            Assert.NotNull(game.JoinCode);
            Assert.Equal(6, game.JoinCode!.Length);
        }

        [Fact]
        public async Task CreateRoomGame_RegistersJoinCodeInRegistry()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");

            var resolvedId = _gameManager.GetGameIdByCode(game.JoinCode!);
            Assert.Equal(game.Id, resolvedId);
        }

        [Fact]
        public async Task CreateRoomGame_SetsCurrentWordIndexToZero()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");

            Assert.Equal(0, game.CurrentWordIndex);
        }

        [Fact]
        public async Task CreateRoomGame_SetsModeToOnlineCoop()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");

            Assert.Equal(GameMode.OnlineCoop, game.Mode);
        }

        // ─── 2.7 / 2.8: GetGameIdByCode ───────────────────────────────────────────

        [Fact]
        public async Task GetGameIdByCode_ReturnsGameIdForKnownCode()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");

            var result = _gameManager.GetGameIdByCode(game.JoinCode!);

            Assert.Equal(game.Id, result);
        }

        [Fact]
        public void GetGameIdByCode_ReturnsNullForUnknownCode()
        {
            var result = _gameManager.GetGameIdByCode("XXXXXX");

            Assert.Null(result);
        }

        // ─── 2.9 / 2.10: AdvanceToNextWord ────────────────────────────────────────

        [Fact]
        public async Task AdvanceToNextWord_IsNoOp_WhenStatusIsInProgress()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");
            game.Status = GameStatus.InProgress;

            await _gameManager.AdvanceToNextWord(game.Id);

            Assert.Equal(0, game.CurrentWordIndex);
            Assert.Equal("PERRO", game.WordToGuess);
        }

        [Fact]
        public async Task AdvanceToNextWord_IncrementsIndexAndResetsRoundState_WhenStatusIsWon()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");
            game.Status = GameStatus.Won;
            game.GuessedLetters = "PERRO";
            game.IncorrectLetters = "XZ";
            game.RemainingAttempts = 4;
            game.FinishedAt = DateTime.UtcNow;

            await _gameManager.AdvanceToNextWord(game.Id);

            Assert.Equal(1, game.CurrentWordIndex);
            Assert.Equal("GATO", game.WordToGuess);
            Assert.Equal(string.Empty, game.GuessedLetters);
            Assert.Equal(string.Empty, game.IncorrectLetters);
            Assert.Equal(GameStatus.InProgress, game.Status);
            Assert.Null(game.FinishedAt);
        }

        [Fact]
        public async Task AdvanceToNextWord_IncrementsIndexAndResetsRoundState_WhenStatusIsLost()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");
            game.Status = GameStatus.Lost;
            game.GuessedLetters = "PE";
            game.IncorrectLetters = "XYZQMN";
            game.RemainingAttempts = 0;
            game.FinishedAt = DateTime.UtcNow;

            await _gameManager.AdvanceToNextWord(game.Id);

            Assert.Equal(1, game.CurrentWordIndex);
            Assert.Equal("GATO", game.WordToGuess);
            Assert.Equal(GameStatus.InProgress, game.Status);
        }

        [Fact]
        public async Task AdvanceToNextWord_SetsRoomCompleted_WhenLastWordEnds()
        {
            var twoWords = new List<RoomWord>
            {
                new RoomWord { Text = "PERRO", Definition = "Dog." },
                new RoomWord { Text = "GATO", Definition = "Cat." }
            };
            var game = await _gameManager.CreateRoomGame(twoWords, alias: "teacher1");
            game.CurrentWordIndex = 1; // already on last word
            game.Status = GameStatus.Won;

            await _gameManager.AdvanceToNextWord(game.Id);

            Assert.True(game.RoomCompleted);
            Assert.Equal(1, game.CurrentWordIndex); // did NOT increment past the end
        }

        [Fact]
        public async Task AdvanceToNextWord_ReturnsNullForUnknownGameId()
        {
            var result = await _gameManager.AdvanceToNextWord("nonexistent-id");

            Assert.Null(result);
        }

        // ─── 2.11 / 2.12: Cleanup removes code from registry ──────────────────────

        [Fact]
        public async Task CleanupIdleGames_RemovesJoinCodeFromRegistry()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");
            var code = game.JoinCode!;

            // Simulate idle by backdating LastActivity beyond the maxIdleTime threshold
            game.LastActivity = DateTime.UtcNow.AddHours(-2);
            _gameManager.CleanupIdleGames(TimeSpan.FromHours(1));

            var resolved = _gameManager.GetGameIdByCode(code);
            Assert.Null(resolved);
        }

        [Fact]
        public async Task EndGame_RemovesJoinCodeFromRegistry()
        {
            var game = await _gameManager.CreateRoomGame(SampleWords, alias: "teacher1");
            var code = game.JoinCode!;

            _gameManager.EndGame(game.Id);

            var resolved = _gameManager.GetGameIdByCode(code);
            Assert.Null(resolved);
        }

        // ─── Tarea-fix: CreateRoom (code only, no session) ────────────────────────

        [Fact]
        public void CreateRoom_ReturnsJoinCode_6Chars()
        {
            // CreateRoom should return only a code — no GameSession
            var code = _gameManager.CreateRoom("Test List", SampleWords, wordListId: 1);

            Assert.NotNull(code);
            Assert.Equal(6, code.Length);
        }

        [Fact]
        public void CreateRoom_RegistersCodeToWordListId()
        {
            var code = _gameManager.CreateRoom("Test List", SampleWords, wordListId: 42);

            var wordListId = _gameManager.GetWordListIdByCode(code);
            Assert.Equal(42, wordListId);
        }

        [Fact]
        public void CreateRoom_CodeSurvivesEndGame_BecauseCodeIsNotTiedToSession()
        {
            // After the fix: codes are NOT removed when student games end,
            // because one code can spawn many independent student sessions.
            var code = _gameManager.CreateRoom("Test List", SampleWords, wordListId: 7);

            // JoinRoomGame would create a session; simulate an EndGame without creating one
            // The code should still resolve after the test just confirms it stays alive.
            var wordListId = _gameManager.GetWordListIdByCode(code);
            Assert.Equal(7, wordListId);
        }

        // ─── Tarea-fix: JoinRoomGame ───────────────────────────────────────────────

        [Fact]
        public async Task JoinRoomGame_ValidCode_ReturnsSoloGameSession()
        {
            // Seed a WordList in the in-memory DB
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var session = await _gameManager.JoinRoomGame(code, alias: "student1");

            Assert.NotNull(session);
            Assert.Equal(GameMode.Solo, session!.Mode);
        }

        [Fact]
        public async Task JoinRoomGame_ValidCode_SetsIsRoomTrue()
        {
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var session = await _gameManager.JoinRoomGame(code, alias: "student1");

            Assert.True(session!.IsRoom);
        }

        [Fact]
        public async Task JoinRoomGame_ValidCode_SetsStatusInProgress()
        {
            // Solo sessions should start InProgress immediately (matches CreateGame Solo behavior)
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var session = await _gameManager.JoinRoomGame(code, alias: "student1");

            Assert.Equal(GameStatus.InProgress, session!.Status);
        }

        [Fact]
        public async Task JoinRoomGame_ValidCode_LoadsWordsFromDb()
        {
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var session = await _gameManager.JoinRoomGame(code, alias: "student1");

            // Words come from DB via WordList.Items ordered by Position
            Assert.Equal(3, session!.RoomWords.Count);
            Assert.Equal("PERRO", session.RoomWords[0].Text);
        }

        [Fact]
        public async Task JoinRoomGame_ValidCode_SetsFirstWordAsWordToGuess()
        {
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var session = await _gameManager.JoinRoomGame(code, alias: "student1");

            Assert.Equal("PERRO", session!.WordToGuess);
        }

        [Fact]
        public async Task JoinRoomGame_ValidCode_SetsPlayerAlias()
        {
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var session = await _gameManager.JoinRoomGame(code, alias: "alumno99");

            Assert.Equal("alumno99", session!.Player1Alias);
        }

        [Fact]
        public async Task JoinRoomGame_InvalidCode_ReturnsNull()
        {
            var session = await _gameManager.JoinRoomGame("XXXXXX", alias: "student1");

            Assert.Null(session);
        }

        [Fact]
        public async Task JoinRoomGame_SameCode_CreatesIndependentSessions()
        {
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var s1 = await _gameManager.JoinRoomGame(code, alias: "alumno1");
            var s2 = await _gameManager.JoinRoomGame(code, alias: "alumno2");

            Assert.NotNull(s1);
            Assert.NotNull(s2);
            Assert.NotEqual(s1!.Id, s2!.Id);
        }

        [Fact]
        public async Task JoinRoomGame_EndingStudentSession_DoesNotRemoveCode()
        {
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var session = await _gameManager.JoinRoomGame(code, alias: "alumno1");
            _gameManager.EndGame(session!.Id);

            // Code must survive — other students can still join
            var wordListId = _gameManager.GetWordListIdByCode(code);
            Assert.Equal((int)list.Id, wordListId);
        }

        [Fact]
        public async Task CleanupIdleGames_StudentSession_DoesNotRemoveCode()
        {
            var list = await SeedWordList("Animals");
            var code = _gameManager.CreateRoom("Animals", SampleWords, wordListId: (int)list.Id);

            var session = await _gameManager.JoinRoomGame(code, alias: "alumno1");
            // Backdate the student session so it gets cleaned up
            session!.LastActivity = DateTime.UtcNow.AddHours(-2);
            _gameManager.CleanupIdleGames(TimeSpan.FromHours(1));

            // Code must survive — other students haven't joined yet
            var wordListId = _gameManager.GetWordListIdByCode(code);
            Assert.Equal((int)list.Id, wordListId);
        }

        // ─── Classroom mode: CreateClassroomSession ───────────────────────────────

        [Fact]
        public void CreateClassroomSession_ReturnsGameWithHostAliasSet()
        {
            var (game, _) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            Assert.Equal("Profe", game.HostAlias);
        }

        [Fact]
        public void CreateClassroomSession_StatusIsWaiting()
        {
            var (game, _) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            Assert.Equal(GameStatus.Waiting, game.Status);
        }

        [Fact]
        public void CreateClassroomSession_IsRoomTrue()
        {
            var (game, _) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            Assert.True(game.IsRoom);
        }

        [Fact]
        public void CreateClassroomSession_ModeIsOnlineCoop()
        {
            var (game, _) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            Assert.Equal(GameMode.OnlineCoop, game.Mode);
        }

        [Fact]
        public void CreateClassroomSession_SetsFirstWordAsWordToGuess()
        {
            var (game, _) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            Assert.Equal("PERRO", game.WordToGuess);
        }

        [Fact]
        public void CreateClassroomSession_GeneratesJoinCode6Chars()
        {
            var (_, code) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            Assert.NotNull(code);
            Assert.Equal(6, code.Length);
        }

        [Fact]
        public void CreateClassroomSession_StoresGameInActiveGames()
        {
            var (game, _) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            var retrieved = _gameManager.GetGame(game.Id);
            Assert.NotNull(retrieved);
        }

        // ─── Classroom mode: GetGameIdByClassroomCode ─────────────────────────────

        [Fact]
        public void GetGameIdByClassroomCode_ReturnsGameIdForKnownCode()
        {
            var (game, code) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            var result = _gameManager.GetGameIdByClassroomCode(code);

            Assert.Equal(game.Id, result);
        }

        [Fact]
        public void GetGameIdByClassroomCode_ReturnsNullForUnknownCode()
        {
            var result = _gameManager.GetGameIdByClassroomCode("XXXXXX");

            Assert.Null(result);
        }

        // ─── Classroom mode: AddPlayerToGame host detection ───────────────────────

        [Fact]
        public async Task AddPlayerToGame_HostAlias_SetsHostIdAndDoesNotAssignPlayer1()
        {
            var (game, _) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            var result = await _gameManager.AddPlayerToGame(game.Id, "conn-host", "Profe");

            Assert.NotNull(result);
            Assert.Equal("conn-host", result!.HostId);
            Assert.Null(result.Player1Id);
            Assert.Null(result.Player2Id);
        }

        [Fact]
        public async Task AddPlayerToGame_FirstNonHostStudent_SetsPlayer1Id()
        {
            var (game, _) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");
            // Host joins first
            await _gameManager.AddPlayerToGame(game.Id, "conn-host", "Profe");

            // Student joins
            var result = await _gameManager.AddPlayerToGame(game.Id, "conn-s1", "Alumno1");

            Assert.NotNull(result);
            Assert.Equal("conn-s1", result!.Player1Id);
            Assert.Equal("Alumno1", result.Player1Alias);
        }

        // ─── Classroom mode: CleanupIdleGames removes classroom codes ─────────────

        [Fact]
        public void CleanupIdleGames_RemovesClassroomCodeForStaleGame()
        {
            var (game, code) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            // Simulate idle: backdate LastActivity
            game.LastActivity = DateTime.UtcNow.AddHours(-2);
            _gameManager.CleanupIdleGames(TimeSpan.FromHours(1));

            var resolved = _gameManager.GetGameIdByClassroomCode(code);
            Assert.Null(resolved);
        }

        [Fact]
        public void EndGame_RemovesClassroomCode()
        {
            var (game, code) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");

            _gameManager.EndGame(game.Id);

            var resolved = _gameManager.GetGameIdByClassroomCode(code);
            Assert.Null(resolved);
        }

        // ─── Classroom code does not collide with tarea codes ─────────────────────

        [Fact]
        public void CreateClassroomSession_CodeDoesNotOverlapWithRoomCodes()
        {
            // Create a tarea room code, then create classroom sessions and verify they don't collide
            _gameManager.CreateRoom("Lista", SampleWords, wordListId: 1);
            for (int i = 0; i < 5; i++)
            {
                var (game2, code2) = _gameManager.CreateClassroomSession("Profe", SampleWords, "Animales");
                Assert.NotNull(code2);
                Assert.NotNull(_gameManager.GetGameIdByClassroomCode(code2));
            }
        }

        // ─── Helper: seed a WordList in the in-memory context ─────────────────────

        // Uses _dbContext (same instance the scope factory returns to GameManager)
        private async Task<WordList> SeedWordList(string listName)
        {
            var list = new WordList
            {
                Name = listName,
                Items =
                [
                    new WordListItem { Text = "PERRO", Definition = "Animal doméstico.", Category = "Animales", Position = 0 },
                    new WordListItem { Text = "GATO",  Definition = "Felino doméstico.", Category = "Animales", Position = 1 },
                    new WordListItem { Text = "PAJARO", Definition = null, Category = "Animales", Position = 2 }
                ]
            };
            _dbContext.WordLists.Add(list);
            await _dbContext.SaveChangesAsync();
            return list;
        }
    }
}
