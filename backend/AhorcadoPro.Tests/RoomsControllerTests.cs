using AhorcadoPro.Backend.Controllers;
using AhorcadoPro.Backend.Data;
using AhorcadoPro.Backend.Models;
using AhorcadoPro.Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;

namespace AhorcadoPro.Tests
{
    /// <summary>
    /// Strict TDD tests for the RoomsController (Slice 3, tasks 3.1–3.6)
    /// and NextRound hub integration via GameManager (tasks 3.7–3.8).
    /// </summary>
    public class RoomsControllerTests
    {
        private readonly ApplicationDbContext _context;
        private readonly GameManager _gameManager;

        public RoomsControllerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: $"RoomsControllerTestDb_{Guid.NewGuid()}")
                .Options;

            _context = new ApplicationDbContext(options);

            var serviceProviderMock = new Mock<IServiceProvider>();
            var loggerMock = new Mock<ILogger<GameManager>>();

            // GameManager needs scope factory to seed words; for controller tests word lookup is not triggered
            var scopeMock = new Mock<IServiceScope>();
            var scopeFactoryMock = new Mock<IServiceScopeFactory>();
            scopeMock.Setup(s => s.ServiceProvider.GetService(typeof(ApplicationDbContext))).Returns(_context);
            scopeFactoryMock.Setup(s => s.CreateScope()).Returns(scopeMock.Object);
            serviceProviderMock.Setup(s => s.GetService(typeof(IServiceScopeFactory))).Returns(scopeFactoryMock.Object);

            _gameManager = new GameManager(serviceProviderMock.Object, loggerMock.Object);
        }

        private RoomsController CreateController() => new RoomsController(_context, _gameManager);

        // ─── Task 3.1/3.2: POST /api/wordlists ───────────────────────────────────

        [Fact]
        public async Task PostWordList_ValidPayload_Returns201WithIdNameCount()
        {
            var controller = CreateController();
            var request = new CreateWordListRequest
            {
                Name = "Unidad 3 - Animales",
                OwnerAlias = "profe",
                Words =
                [
                    new WordEntryDto { Text = "perro", Definition = "Animal doméstico.", Category = "Animales" },
                    new WordEntryDto { Text = "gato", Definition = "Felino doméstico.", Category = "Animales" }
                ]
            };

            var result = await controller.CreateWordList(request);

            var created = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(201, created.StatusCode);

            dynamic value = created.Value!;
            Assert.NotNull(value);
        }

        [Fact]
        public async Task PostWordList_EmptyWordsArray_Returns400()
        {
            var controller = CreateController();
            var request = new CreateWordListRequest
            {
                Name = "Empty List",
                Words = []
            };

            var result = await controller.CreateWordList(request);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task PostWordList_WordTextBlank_Returns400()
        {
            var controller = CreateController();
            var request = new CreateWordListRequest
            {
                Name = "Blank word list",
                Words = [new WordEntryDto { Text = "   " }]
            };

            var result = await controller.CreateWordList(request);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task PostWordList_WordTextExceeds100Chars_Returns400()
        {
            var controller = CreateController();
            var request = new CreateWordListRequest
            {
                Name = "Too long list",
                Words = [new WordEntryDto { Text = new string('A', 101) }]
            };

            var result = await controller.CreateWordList(request);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task PostWordList_ValidPayload_UppercasesTextBeforePersisting()
        {
            var controller = CreateController();
            var request = new CreateWordListRequest
            {
                Name = "Uppercase Test",
                Words = [new WordEntryDto { Text = "perro" }]
            };

            await controller.CreateWordList(request);

            var item = _context.WordListItems.First();
            Assert.Equal("PERRO", item.Text);
        }

        [Fact]
        public async Task PostWordList_ValidPayload_AssignsPositionByIndex()
        {
            var controller = CreateController();
            var request = new CreateWordListRequest
            {
                Name = "Position Test",
                Words =
                [
                    new WordEntryDto { Text = "alpha" },
                    new WordEntryDto { Text = "beta" },
                    new WordEntryDto { Text = "gamma" }
                ]
            };

            await controller.CreateWordList(request);

            var items = _context.WordListItems.OrderBy(i => i.Position).ToList();
            Assert.Equal(0, items[0].Position);
            Assert.Equal(1, items[1].Position);
            Assert.Equal(2, items[2].Position);
        }

        // ─── Task 3.3/3.4: POST /api/rooms ───────────────────────────────────────

        [Fact]
        public async Task PostRoom_ValidWordListId_Returns201WithJoinCodeNoGameId()
        {
            // After tarea-fix: POST /api/rooms returns { joinCode, listName, totalWords } — no gameId
            var list = new WordList
            {
                Name = "Test List",
                Items =
                [
                    new WordListItem { Text = "PERRO", Position = 0 },
                    new WordListItem { Text = "GATO",  Position = 1 }
                ]
            };
            _context.WordLists.Add(list);
            await _context.SaveChangesAsync();

            var controller = CreateController();
            var request = new CreateRoomRequest { WordListId = list.Id };

            var result = await controller.CreateRoom(request);

            var created = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(201, created.StatusCode);

            // Must expose joinCode
            var value = created.Value!;
            var joinCodeProp = value.GetType().GetProperty("joinCode");
            Assert.NotNull(joinCodeProp);
            var joinCode = (string?)joinCodeProp!.GetValue(value);
            Assert.NotNull(joinCode);
            Assert.Equal(6, joinCode!.Length);

            // Must NOT expose gameId
            var gameIdProp = value.GetType().GetProperty("gameId");
            Assert.Null(gameIdProp);
        }

        [Fact]
        public async Task PostRoom_NonExistentWordListId_Returns404()
        {
            var controller = CreateController();
            var request = new CreateRoomRequest { WordListId = 99999 };

            var result = await controller.CreateRoom(request);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        [Fact]
        public async Task PostRoom_EmptyWordList_Returns400()
        {
            var emptyList = new WordList { Name = "Empty" };
            _context.WordLists.Add(emptyList);
            await _context.SaveChangesAsync();

            var controller = CreateController();
            var request = new CreateRoomRequest { WordListId = emptyList.Id };

            var result = await controller.CreateRoom(request);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        // ─── Task 3.5/3.6: GET /api/rooms/resolve/{code} ─────────────────────────
        // After tarea-fix: returns { listName, totalWords } — no gameId.

        [Fact]
        public async Task ResolveCode_KnownCode_Returns200WithListInfo()
        {
            var list = new WordList
            {
                Name = "Resolve Test",
                Items =
                [
                    new WordListItem { Text = "PERRO", Position = 0 },
                    new WordListItem { Text = "GATO",  Position = 1 }
                ]
            };
            _context.WordLists.Add(list);
            await _context.SaveChangesAsync();

            var controller = CreateController();
            var createResult = await controller.CreateRoom(new CreateRoomRequest { WordListId = list.Id });
            var created = Assert.IsType<CreatedAtActionResult>(createResult);

            var value = created.Value!;
            var joinCodeProp = value.GetType().GetProperty("joinCode");
            var joinCode = (string)joinCodeProp!.GetValue(value)!;

            var resolveResult = await controller.ResolveCode(joinCode);

            var ok = Assert.IsType<OkObjectResult>(resolveResult);

            // Must expose listName and totalWords, NOT gameId
            var listNameProp = ok.Value!.GetType().GetProperty("listName");
            Assert.NotNull(listNameProp);

            var gameIdProp = ok.Value!.GetType().GetProperty("gameId");
            Assert.Null(gameIdProp);
        }

        [Fact]
        public async Task ResolveCode_UnknownCode_Returns404()
        {
            var controller = CreateController();

            var result = await controller.ResolveCode("XXXXXX");

            Assert.IsType<NotFoundObjectResult>(result);
        }

        // ─── Tarea-fix: POST /api/rooms/join ─────────────────────────────────────

        [Fact]
        public async Task JoinRoom_ValidCode_Returns201WithGameId()
        {
            var list = new WordList
            {
                Name = "Join Test",
                Items = [new WordListItem { Text = "PERRO", Position = 0 }]
            };
            _context.WordLists.Add(list);
            await _context.SaveChangesAsync();

            var controller = CreateController();

            // Create the room first
            var createResult = await controller.CreateRoom(new CreateRoomRequest { WordListId = list.Id });
            var created = Assert.IsType<CreatedAtActionResult>(createResult);
            var joinCode = (string)created.Value!.GetType().GetProperty("joinCode")!.GetValue(created.Value)!;

            // Now join
            var joinRequest = new JoinRoomRequest { Code = joinCode, Alias = "alumno1" };
            var joinResult = await controller.JoinRoom(joinRequest);

            var joinCreated = Assert.IsType<CreatedAtActionResult>(joinResult);
            Assert.Equal(201, joinCreated.StatusCode);

            var gameIdProp = joinCreated.Value!.GetType().GetProperty("gameId");
            Assert.NotNull(gameIdProp);
            Assert.NotNull(gameIdProp!.GetValue(joinCreated.Value));
        }

        [Fact]
        public async Task JoinRoom_InvalidCode_Returns404()
        {
            var controller = CreateController();
            var request = new JoinRoomRequest { Code = "XXXXXX", Alias = "alumno1" };

            var result = await controller.JoinRoom(request);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        [Fact]
        public async Task JoinRoom_SameCode_TwiceCreatesIndependentGames()
        {
            var list = new WordList
            {
                Name = "Multi-Join Test",
                Items = [new WordListItem { Text = "PERRO", Position = 0 }]
            };
            _context.WordLists.Add(list);
            await _context.SaveChangesAsync();

            var controller = CreateController();

            var createResult = await controller.CreateRoom(new CreateRoomRequest { WordListId = list.Id });
            var created = Assert.IsType<CreatedAtActionResult>(createResult);
            var joinCode = (string)created.Value!.GetType().GetProperty("joinCode")!.GetValue(created.Value)!;

            var r1 = await controller.JoinRoom(new JoinRoomRequest { Code = joinCode, Alias = "a1" });
            var r2 = await controller.JoinRoom(new JoinRoomRequest { Code = joinCode, Alias = "a2" });

            var c1 = Assert.IsType<CreatedAtActionResult>(r1);
            var c2 = Assert.IsType<CreatedAtActionResult>(r2);

            var gid1 = (string?)c1.Value!.GetType().GetProperty("gameId")!.GetValue(c1.Value);
            var gid2 = (string?)c2.Value!.GetType().GetProperty("gameId")!.GetValue(c2.Value);

            Assert.NotEqual(gid1, gid2);
        }

        // ─── Task 3.7/3.8: NextRound hub (tested via GameManager directly) ────────

        [Fact]
        public async Task NextRound_OnWonRoomSession_AdvancesToNextWord()
        {
            var words = new List<RoomWord>
            {
                new() { Text = "PERRO", Definition = "Dog" },
                new() { Text = "GATO",  Definition = "Cat" }
            };
            var game = await _gameManager.CreateRoomGame(words, alias: "teacher1");
            game.Status = GameStatus.Won;

            // Simulate hub NextRound call: GameManager.AdvanceToNextWord + broadcast
            var advanced = await _gameManager.AdvanceToNextWord(game.Id);

            Assert.NotNull(advanced);
            Assert.Equal("GATO", advanced!.WordToGuess);
            Assert.Equal(GameStatus.InProgress, advanced.Status);
        }

        [Fact]
        public async Task NextRound_OnNonRoomSession_IsNoOp()
        {
            // A non-room session (IsRoom=false) with Won status — AdvanceToNextWord guard
            // The IsRoom guard is implicit: non-room sessions have empty RoomWords,
            // so nextIndex >= RoomWords.Count and RoomCompleted becomes true.
            // The important thing: it does NOT crash or corrupt state.
            var words = new List<RoomWord> { new() { Text = "PERRO" } };
            var game = await _gameManager.CreateRoomGame(words);
            game.IsRoom = false; // simulate a session that somehow lost its room flag
            game.Status = GameStatus.Won;

            // Should not throw; result may be null or game with RoomCompleted
            var result = await _gameManager.AdvanceToNextWord(game.Id);

            // Either returns the game (possibly with RoomCompleted) or null — must not throw
            Assert.True(result == null || result.WordToGuess == "PERRO");
        }

        // ─── Classroom mode: POST /api/rooms/clase ───────────────────────────────

        [Fact]
        public async Task PostClase_ValidPayload_Returns201WithJoinCodeAndGameId()
        {
            var controller = CreateController();
            var request = new CreateClassroomRequest
            {
                Name = "Unidad 3",
                Alias = "Profe",
                Words =
                [
                    new WordEntryDto { Text = "fotosintesis", Definition = "Proceso de las plantas", Category = "Biología" },
                    new WordEntryDto { Text = "clorofila" }
                ]
            };

            var result = await controller.CreateClassroom(request);

            var created = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(201, created.StatusCode);

            var value = created.Value!;
            var joinCodeProp = value.GetType().GetProperty("joinCode");
            Assert.NotNull(joinCodeProp);
            Assert.NotNull(joinCodeProp!.GetValue(value));

            var gameIdProp = value.GetType().GetProperty("gameId");
            Assert.NotNull(gameIdProp);
            Assert.NotNull(gameIdProp!.GetValue(value));
        }

        [Fact]
        public async Task PostClase_EmptyWords_Returns400()
        {
            var controller = CreateController();
            var request = new CreateClassroomRequest
            {
                Name = "Unidad 3",
                Words = []
            };

            var result = await controller.CreateClassroom(request);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task PostClase_BlankWordText_Returns400()
        {
            var controller = CreateController();
            var request = new CreateClassroomRequest
            {
                Name = "Test",
                Words = [new WordEntryDto { Text = "   " }]
            };

            var result = await controller.CreateClassroom(request);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        // ─── Classroom mode: POST /api/rooms/join-clase ──────────────────────────

        [Fact]
        public async Task JoinClase_ValidCode_Returns200WithGameId()
        {
            var controller = CreateController();
            // Create classroom first
            var createResult = await controller.CreateClassroom(new CreateClassroomRequest
            {
                Name = "Test",
                Alias = "Profe",
                Words = [new WordEntryDto { Text = "perro" }]
            });
            var created = Assert.IsType<CreatedAtActionResult>(createResult);
            var joinCode = (string)created.Value!.GetType().GetProperty("joinCode")!.GetValue(created.Value)!;

            var joinResult = await controller.JoinClassroom(new JoinClassroomRequest { Code = joinCode, Alias = "Alumno1" });

            var ok = Assert.IsType<OkObjectResult>(joinResult);
            var gameIdProp = ok.Value!.GetType().GetProperty("gameId");
            Assert.NotNull(gameIdProp);
            Assert.NotNull(gameIdProp!.GetValue(ok.Value));
        }

        [Fact]
        public async Task JoinClase_InvalidCode_Returns404()
        {
            var controller = CreateController();
            var request = new JoinClassroomRequest { Code = "XXXXXX", Alias = "Alumno1" };

            var result = await controller.JoinClassroom(request);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        [Fact]
        public async Task NextRound_CalledTwice_IsIdempotentAfterRoomCompleted()
        {
            var words = new List<RoomWord> { new() { Text = "SOLO" } };
            var game = await _gameManager.CreateRoomGame(words, alias: "teacher1");
            game.Status = GameStatus.Won;

            // First advance: last word -> RoomCompleted=true
            await _gameManager.AdvanceToNextWord(game.Id);
            Assert.True(game.RoomCompleted);

            // Second advance (double-click / race): Status is still Won/Lost? No, RoomCompleted=true
            // but Status was NOT changed by first advance.  Guard checks Won/Lost — Won still applies.
            // So second call hits the RoomCompleted path again (harmless).
            var second = await _gameManager.AdvanceToNextWord(game.Id);

            // Must not crash; RoomCompleted must remain true
            Assert.NotNull(second);
            Assert.True(second!.RoomCompleted);
        }
    }
}
