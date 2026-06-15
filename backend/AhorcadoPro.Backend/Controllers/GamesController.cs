using AhorcadoPro.Backend.Models;
using AhorcadoPro.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace AhorcadoPro.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GamesController : ControllerBase
    {
        private readonly GameManager _gameManager;
        private readonly IAiService _aiService;

        // Cache en memoria: una palabra por día (se resetea al reiniciar el server)
        private static readonly Dictionary<string, DailyChallengeCache> _dailyCache = new();
        private static readonly object _dailyLock = new();

        public GamesController(GameManager gameManager, IAiService aiService)
        {
            _gameManager = gameManager;
            _aiService = aiService;
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateGame([FromBody] CreateGameRequest request)
        {
            var game = await _gameManager.CreateGame(
                request.Mode, request.Alias, request.MaxAttempts, request.Theme,
                educationalCategory: request.Category, profile: request.Profile);
            return Ok(game);
        }

        [HttpGet("daily")]
        public async Task<IActionResult> GetDailyChallenge()
        {
            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

            DailyChallengeCache? cached;
            lock (_dailyLock)
            {
                _dailyCache.TryGetValue(today, out cached);
            }

            if (cached == null)
            {
                // Generar palabra del día con Gemini
                string word, category, hint;
                var aiResult = await _aiService.GenerateWordAsync("palabra interesante para juego del ahorcado, tema variado y educativo");
                if (aiResult != null)
                {
                    word = aiResult.Word.ToUpper();
                    category = aiResult.Category;
                    hint = aiResult.Hint;
                }
                else
                {
                    // Fallback si Gemini no está configurado
                    word = "DEMOCRACIA";
                    category = "Política";
                    hint = "Sistema de gobierno donde el pueblo elige a sus representantes";
                }

                cached = new DailyChallengeCache(word, category, hint, today);
                lock (_dailyLock)
                {
                    _dailyCache[today] = cached;
                }
            }

            var game = await _gameManager.CreateGame(
                GameMode.Solo,
                null,
                6,
                wordOverride: cached.Word,
                categoryOverride: cached.Category
            );

            return Ok(new
            {
                gameId = game.Id,
                category = cached.Category,
                hint = cached.Hint,
                date = cached.Date,
                wordLength = cached.Word.Length
            });
        }

        [HttpGet("{gameId}")]
        public IActionResult GetGame(string gameId)
        {
            var game = _gameManager.GetGame(gameId);
            if (game == null) return NotFound();
            return Ok(game);
        }
    }

    public class CreateGameRequest
    {
        public GameMode Mode { get; set; }
        public string? Alias { get; set; }
        public int MaxAttempts { get; set; } = 6;
        public string? Theme { get; set; }
        public string? Category { get; set; }
        public string? Profile { get; set; }
    }

    public record DailyChallengeCache(string Word, string Category, string Hint, string Date);
}
