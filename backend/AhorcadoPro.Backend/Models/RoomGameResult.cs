namespace AhorcadoPro.Backend.Models
{
    public class RoomGameResult
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string JoinCode { get; set; } = string.Empty;
        public string ListName { get; set; } = string.Empty;
        public string PlayerAlias { get; set; } = string.Empty;
        public int WordsCompleted { get; set; }
        public int TotalWords { get; set; }
        public int TotalErrors { get; set; }
        public int MaxAttempts { get; set; }
        public string Status { get; set; } = "Completed";
        public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
        public string? WordBreakdownJson { get; set; }
    }
}
