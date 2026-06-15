namespace AhorcadoPro.Backend.Models
{
    public class Score
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid? UserId { get; set; }
        public string? GuestAlias { get; set; }
        public int Points { get; set; }
        public string Mode { get; set; } = string.Empty;
        public string Word { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public bool Won { get; set; }
        public int AttemptsUsed { get; set; }
        public int MaxAttempts { get; set; }
        public int? DurationSeconds { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
