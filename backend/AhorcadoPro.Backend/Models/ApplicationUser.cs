using System.Text.Json.Serialization;

namespace AhorcadoPro.Backend.Models
{
    public class SupabaseUser
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("user_metadata")]
        public Dictionary<string, object>? UserMetadata { get; set; }
    }
}
