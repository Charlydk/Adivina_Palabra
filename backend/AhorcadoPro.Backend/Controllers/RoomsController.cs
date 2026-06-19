using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AhorcadoPro.Backend.Data;
using AhorcadoPro.Backend.Models;
using AhorcadoPro.Backend.Services;

namespace AhorcadoPro.Backend.Controllers
{
    // ─── Request / Response DTOs ──────────────────────────────────────────────

    public class WordEntryDto
    {
        public string Text { get; set; } = string.Empty;
        public string? Definition { get; set; }
        public string? Category { get; set; }
    }

    public class CreateWordListRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? OwnerAlias { get; set; }
        public List<WordEntryDto> Words { get; set; } = [];
    }

    public class CreateRoomRequest
    {
        public long WordListId { get; set; }
        public string? Alias { get; set; }
        public int MaxAttempts { get; set; } = 6;
        public string? JoinCode { get; set; }
    }

    public class UpdateWordListRequest
    {
        public List<WordEntryDto> Words { get; set; } = [];
    }

    public class JoinRoomRequest
    {
        public string Code { get; set; } = string.Empty;
        public string? Alias { get; set; }
    }

    public class CreateClassroomRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Alias { get; set; }
        public int MaxAttempts { get; set; } = 6;
        public List<WordEntryDto> Words { get; set; } = [];
    }

    public class JoinClassroomRequest
    {
        public string Code { get; set; } = string.Empty;
        public string? Alias { get; set; }
    }

    // ─── Controller ───────────────────────────────────────────────────────────

    /// <summary>
    /// Guest-capable endpoints for teacher word rooms (no [Authorize] — AllowAnonymous by default
    /// since the controller has no [Authorize] attribute and the app-level policy allows unauthenticated).
    /// </summary>
    [ApiController]
    [AllowAnonymous]
    public class RoomsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly GameManager _gameManager;

        public RoomsController(ApplicationDbContext db, GameManager gameManager)
        {
            _db = db;
            _gameManager = gameManager;
        }

        // POST /api/wordlists — create a named word list
        [HttpPost("api/wordlists")]
        public async Task<IActionResult> CreateWordList([FromBody] CreateWordListRequest request)
        {
            // Validate: must have at least one word
            if (request.Words == null || request.Words.Count == 0)
                return BadRequest(new { error = "Word list must contain at least one word." });

            // Validate each word entry
            foreach (var (entry, idx) in request.Words.Select((e, i) => (e, i)))
            {
                if (string.IsNullOrWhiteSpace(entry.Text))
                    return BadRequest(new { error = $"Word at position {idx} is blank." });

                if (entry.Text.Trim().Length > 100)
                    return BadRequest(new { error = $"Word at position {idx} exceeds the 100-character limit." });
            }

            var wordList = new WordList
            {
                Name = request.Name?.Trim() ?? string.Empty,
                OwnerAlias = request.OwnerAlias?.Trim(),
                CreatedAt = DateTime.UtcNow,
                Items = request.Words
                    .Select((e, idx) => new WordListItem
                    {
                        Text = e.Text.Trim().ToUpper(),
                        Definition = e.Definition?.Trim(),
                        Category = e.Category?.Trim(),
                        Position = idx
                    })
                    .ToList()
            };

            _db.WordLists.Add(wordList);
            await _db.SaveChangesAsync();

            return CreatedAtAction(
                nameof(CreateWordList),
                new { id = wordList.Id },
                new { id = wordList.Id, name = wordList.Name, count = wordList.Items.Count });
        }

        // GET /api/wordlists?ownerAlias={alias} — list word lists for a teacher (up to 50, newest first)
        [HttpGet("api/wordlists")]
        public async Task<IActionResult> GetWordLists([FromQuery] string? ownerAlias)
        {
            var query = _db.WordLists.Include(w => w.Items).AsQueryable();

            if (!string.IsNullOrWhiteSpace(ownerAlias))
                query = query.Where(w => w.OwnerAlias == ownerAlias.Trim());

            var lists = await query
                .OrderByDescending(w => w.CreatedAt)
                .Take(50)
                .Select(w => new
                {
                    id = w.Id,
                    name = w.Name,
                    ownerAlias = w.OwnerAlias,
                    joinCode = w.JoinCode,
                    createdAt = w.CreatedAt,
                    wordCount = w.Items.Count
                })
                .ToListAsync();

            return Ok(lists);
        }

        // POST /api/rooms — register a room from an existing word list; teacher does NOT enter a game
        [HttpPost("api/rooms")]
        public async Task<IActionResult> CreateRoom([FromBody] CreateRoomRequest request)
        {
            var list = await _db.WordLists
                .Include(w => w.Items)
                .FirstOrDefaultAsync(w => w.Id == request.WordListId);

            if (list == null)
                return NotFound(new { error = $"Word list {request.WordListId} not found." });

            var items = list.Items.OrderBy(i => i.Position).ToList();

            if (items.Count == 0)
                return BadRequest(new { error = "Word list is empty — cannot create a room." });

            var roomWords = items.Select(i => new RoomWord
            {
                Text = i.Text,
                Definition = i.Definition,
                Category = i.Category
            }).ToList();

            // CreateRoom registers the code→wordListId mapping; no GameSession is created here.
            string joinCode;
            try
            {
                joinCode = _gameManager.CreateRoom(list.Name, roomWords, (int)list.Id, request.JoinCode);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }

            // Persist code to DB so it survives server restarts
            list.JoinCode = joinCode;
            await _db.SaveChangesAsync();

            return CreatedAtAction(
                nameof(CreateRoom),
                new { joinCode },
                new
                {
                    joinCode,
                    listName = list.Name,
                    totalWords = items.Count
                });
        }

        // GET /api/wordlists/{id} — returns full word list with items (for editing)
        [HttpGet("api/wordlists/{id}")]
        public async Task<IActionResult> GetWordList(long id)
        {
            var list = await _db.WordLists
                .Include(w => w.Items)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (list == null)
                return NotFound(new { error = "Word list not found." });

            return Ok(new
            {
                id = list.Id,
                name = list.Name,
                ownerAlias = list.OwnerAlias,
                joinCode = list.JoinCode,
                createdAt = list.CreatedAt,
                items = list.Items.OrderBy(i => i.Position).Select(i => new
                {
                    id = i.Id,
                    text = i.Text,
                    definition = i.Definition,
                    category = i.Category,
                    position = i.Position
                })
            });
        }

        // PUT /api/wordlists/{id} — replace all items in a word list
        [HttpPut("api/wordlists/{id}")]
        public async Task<IActionResult> UpdateWordList(long id, [FromBody] UpdateWordListRequest request)
        {
            if (request.Words == null || request.Words.Count == 0)
                return BadRequest(new { error = "Word list must contain at least one word." });

            foreach (var (entry, idx) in request.Words.Select((e, i) => (e, i)))
            {
                if (string.IsNullOrWhiteSpace(entry.Text))
                    return BadRequest(new { error = $"Word at position {idx} is blank." });
                if (entry.Text.Trim().Length > 100)
                    return BadRequest(new { error = $"Word at position {idx} exceeds the 100-character limit." });
            }

            var list = await _db.WordLists
                .Include(w => w.Items)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (list == null)
                return NotFound(new { error = "Word list not found." });

            _db.WordListItems.RemoveRange(list.Items);
            list.Items = request.Words.Select((e, idx) => new WordListItem
            {
                WordListId = list.Id,
                Text = e.Text.Trim().ToUpper(),
                Definition = e.Definition?.Trim(),
                Category = e.Category?.Trim(),
                Position = idx
            }).ToList();

            await _db.SaveChangesAsync();

            return Ok(new { id = list.Id, count = list.Items.Count });
        }

        // GET /api/rooms/resolve/{code} — returns list metadata for a known code (no gameId)
        [HttpGet("api/rooms/resolve/{code}")]
        public async Task<IActionResult> ResolveCode(string code)
        {
            // Check in-memory first, then fall back to DB join_code column (survives restarts)
            WordList? list;
            var wordListId = _gameManager.GetWordListIdByCode(code);
            if (wordListId != null)
            {
                list = await _db.WordLists.Include(w => w.Items).FirstOrDefaultAsync(l => l.Id == wordListId);
            }
            else
            {
                list = await _db.WordLists.Include(w => w.Items).FirstOrDefaultAsync(l => l.JoinCode == code);
            }

            if (list == null)
                return NotFound(new { error = "Join code not found or session has expired." });

            return Ok(new { listName = list.Name, totalWords = list.Items.Count });
        }

        // POST /api/rooms/join — student joins a room; creates an independent Solo GameSession
        [HttpPost("api/rooms/join")]
        public async Task<IActionResult> JoinRoom([FromBody] JoinRoomRequest request)
        {
            var code = request.Code?.Trim().ToUpper() ?? string.Empty;
            if (string.IsNullOrEmpty(code))
                return BadRequest(new { error = "Join code is required." });

            var session = await _gameManager.JoinRoomGame(code, request.Alias?.Trim());

            if (session == null)
                return NotFound(new { error = "Join code not found or session has expired." });

            return CreatedAtAction(
                nameof(JoinRoom),
                new { gameId = session.Id },
                new { gameId = session.Id });
        }

        // POST /api/rooms/clase — teacher creates a classroom session (ephemeral, no DB record)
        [HttpPost("api/rooms/clase")]
        public async Task<IActionResult> CreateClassroom([FromBody] CreateClassroomRequest request)
        {
            if (request.Words == null || request.Words.Count == 0)
                return BadRequest(new { error = "Word list must contain at least one word." });

            foreach (var (entry, idx) in request.Words.Select((e, i) => (e, i)))
            {
                if (string.IsNullOrWhiteSpace(entry.Text))
                    return BadRequest(new { error = $"Word at position {idx} is blank." });
            }

            var roomWords = request.Words.Select(w => new RoomWord
            {
                Text = w.Text.Trim().ToUpper(),
                Definition = w.Definition?.Trim(),
                Category = w.Category?.Trim()
            }).ToList();

            var (game, joinCode) = _gameManager.CreateClassroomSession(
                request.Alias?.Trim() ?? "Docente",
                roomWords,
                request.Name?.Trim() ?? string.Empty,
                request.MaxAttempts > 0 ? request.MaxAttempts : 6);

            await Task.CompletedTask; // no async work needed — satisfies async signature
            return CreatedAtAction(
                nameof(CreateClassroom),
                new { gameId = game.Id },
                new
                {
                    gameId = game.Id,
                    joinCode,
                    listName = game.ListName,
                    totalWords = game.TotalWords
                });
        }

        // POST /api/rooms/join-clase — student or teacher joins a classroom session by code
        [HttpPost("api/rooms/join-clase")]
        public async Task<IActionResult> JoinClassroom([FromBody] JoinClassroomRequest request)
        {
            var code = request.Code?.Trim().ToUpper() ?? string.Empty;
            if (string.IsNullOrEmpty(code))
                return BadRequest(new { error = "Join code is required." });

            var gameId = _gameManager.GetGameIdByClassroomCode(code);
            if (gameId == null)
                return NotFound(new { error = "Join code not found or classroom session has expired." });

            await Task.CompletedTask; // no async work needed — satisfies async signature
            return Ok(new { gameId });
        }

        // GET /api/rooms/{code}/scoreboard — returns live student progress for a room code
        [HttpGet("api/rooms/{code}/scoreboard")]
        public IActionResult GetScoreboard(string code, [FromQuery] string? excludeGameId = null)
        {
            var sessions = _gameManager.GetSessionsByCode(code.ToUpper(), excludeGameId);

            var entries = sessions.Select(g =>
            {
                int wordsCompleted = g.RoomCompleted
                    ? g.TotalWords
                    : (g.Status == GameStatus.Won || g.Status == GameStatus.Lost)
                        ? g.CurrentWordIndex + 1
                        : g.CurrentWordIndex;

                return new
                {
                    alias = g.Player1Alias ?? "Anónimo",
                    wordsCompleted,
                    totalWords = g.TotalWords,
                    currentErrors = g.IncorrectLetters.Length,
                    maxAttempts = g.MaxAttempts,
                    status = g.RoomCompleted ? "Completed" : g.Status.ToString(),
                };
            })
            .OrderByDescending(e => e.wordsCompleted)
            .ThenBy(e => e.currentErrors)
            .ToList();

            return Ok(entries);
        }
    }
}
