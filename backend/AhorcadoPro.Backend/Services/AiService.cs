namespace AhorcadoPro.Backend.Services
{
    using System.Text;
    using System.Text.Json;
    using System.Text.Json.Serialization;

    public interface IAiService
    {
        Task<string> GetHintAsync(string word, string category, string profile = "");
        Task<AiWordResult?> GenerateWordAsync(string? theme = null);
        Task<WordDefinitionResult> GetWordDefinitionAsync(string word, string category, string profile);
    }

    public class AiWordResult
    {
        public string Word { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Hint { get; set; } = string.Empty;
    }

    public record WordDefinitionResult(string Definition, string? Bonus);

    public class GroqService : IAiService
    {
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;
        private readonly ILogger<GroqService> _logger;

        private const string Model = "llama-3.3-70b-versatile";
        private const string ApiUrl = "https://api.groq.com/openai/v1/chat/completions";

        public GroqService(IConfiguration configuration, HttpClient httpClient, ILogger<GroqService> logger)
        {
            _configuration = configuration;
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<string> GetHintAsync(string word, string category, string profile = "")
        {
            string prompt = profile == "adultos_mayores"
                ? $"Generá una pista descriptiva y cálida para la palabra '{word}' de la categoría '{category}'. La pista debe asociar la palabra con recuerdos cotidianos o experiencias de vida, en español simple. Máximo 2 oraciones. No revelar la palabra."
                : $"Eres un asistente de un juego de ahorcado educativo. La palabra es '{word}' de la categoría '{category}'. Dame UNA pista simple y clara en español, adecuada para un niño de primaria (10-12 años), sin revelar la palabra. Máximo 2 oraciones.";
            return await CallGroqAsync(prompt) ?? "No hay pistas disponibles.";
        }

        public async Task<WordDefinitionResult> GetWordDefinitionAsync(string word, string category, string profile)
        {
            string prompt = profile == "adultos_mayores"
                ? $"Definí la palabra '{word}' en español simple y cálido, como si se lo explicaras a un adulto mayor. Respondé ÚNICAMENTE con un JSON válido sin markdown: {{\"definition\":\"definición en 1-2 oraciones\",\"bonus\":\"mensaje motivador breve (ej: ¡Muy bien! Tu mente está activa)\"}}"
                : $"Definí la palabra '{word}' de la categoría '{category}' en español, adecuado para un niño de primaria. Respondé ÚNICAMENTE con un JSON válido sin markdown: {{\"definition\":\"definición clara en 1-2 oraciones\",\"bonus\":\"¿Sabías que...? dato curioso breve sobre la palabra\"}}";

            var json = await CallGroqAsync(prompt);
            if (string.IsNullOrEmpty(json)) return new WordDefinitionResult("Sin definición disponible.", null);

            try
            {
                var clean = json.Trim();
                if (clean.StartsWith("```")) clean = clean[(clean.IndexOf('\n') + 1)..];
                if (clean.EndsWith("```")) clean = clean[..clean.LastIndexOf("```")];
                clean = clean.Trim();
                var parsed = JsonSerializer.Deserialize<JsonElement>(clean);
                var def = parsed.GetProperty("definition").GetString() ?? "";
                string? bonus = parsed.TryGetProperty("bonus", out var b) ? b.GetString() : null;
                return new WordDefinitionResult(def, bonus);
            }
            catch
            {
                return new WordDefinitionResult(json.Length > 300 ? json[..300] : json, null);
            }
        }

        public async Task<AiWordResult?> GenerateWordAsync(string? theme = null)
        {
            var themeInstruction = string.IsNullOrEmpty(theme)
                ? "Elegí un tema aleatorio interesante."
                : $"El tema debe ser: {theme}.";

            var prompt = $"Generá una palabra en español para el juego del ahorcado. {themeInstruction} " +
                         "Respondé ÚNICAMENTE con un objeto JSON válido, sin markdown, sin texto adicional. " +
                         "Formato exacto: {{\"word\":\"PALABRA\",\"category\":\"Categoría\",\"hint\":\"Pista corta\"}} " +
                         "La palabra debe estar en MAYÚSCULAS y sin acentos. La pista debe ser en español y no revelar la palabra.";

            var jsonResponse = await CallGroqAsync(prompt);
            if (string.IsNullOrEmpty(jsonResponse)) return null;

            try
            {
                var clean = jsonResponse.Trim();
                // Strip markdown code blocks if present
                if (clean.StartsWith("```")) clean = clean[(clean.IndexOf('\n') + 1)..];
                if (clean.EndsWith("```")) clean = clean[..clean.LastIndexOf("```")];
                clean = clean.Trim();

                return JsonSerializer.Deserialize<AiWordResult>(clean, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse Groq JSON response: {Response}", jsonResponse);
                return null;
            }
        }

        private async Task<string?> CallGroqAsync(string prompt)
        {
            var apiKey = _configuration["Groq:ApiKey"];
            if (string.IsNullOrEmpty(apiKey))
            {
                _logger.LogWarning("Groq API Key is missing.");
                return null;
            }

            var requestBody = new
            {
                model = Model,
                messages = new[] { new { role = "user", content = prompt } },
                temperature = 0.7,
                max_tokens = 200
            };

            var request = new HttpRequestMessage(HttpMethod.Post, ApiUrl);
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            try
            {
                var response = await _httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Groq API error: {StatusCode} - {Error}", response.StatusCode, error);
                    return null;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var groqResponse = JsonSerializer.Deserialize<GroqResponse>(responseJson);
                return groqResponse?.Choices?[0].Message?.Content?.Trim();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Groq API");
                return null;
            }
        }

        private class GroqResponse
        {
            [JsonPropertyName("choices")]
            public GroqChoice[]? Choices { get; set; }
        }

        private class GroqChoice
        {
            [JsonPropertyName("message")]
            public GroqMessage? Message { get; set; }
        }

        private class GroqMessage
        {
            [JsonPropertyName("content")]
            public string? Content { get; set; }
        }
    }
}
