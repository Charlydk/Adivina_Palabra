using Microsoft.AspNetCore.Mvc;
using AhorcadoPro.Backend.Services;

namespace AhorcadoPro.Backend.Controllers
{
    public class GenerateWordListRequest
    {
        public string Theme { get; set; } = string.Empty;
        public int Count { get; set; } = 10;
    }

    [ApiController]
    public class AiController : ControllerBase
    {
        private readonly IAiService _aiService;

        public AiController(IAiService aiService)
        {
            _aiService = aiService;
        }

        [HttpPost("api/ai/wordlist")]
        public async Task<IActionResult> GenerateWordList([FromBody] GenerateWordListRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Theme))
                return BadRequest(new { error = "El tema no puede estar vacío." });

            var count = Math.Clamp(request.Count, 3, 20);
            var words = await _aiService.GenerateWordListAsync(request.Theme, count);

            if (words.Count == 0)
                return StatusCode(503, new { error = "No se pudo generar la lista. Verificá la clave de API o intentá de nuevo." });

            return Ok(words.Select(w => new
            {
                text = w.Word,
                definition = w.Hint,
                category = w.Category,
            }));
        }
    }
}
