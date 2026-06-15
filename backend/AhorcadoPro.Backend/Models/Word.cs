namespace AhorcadoPro.Backend.Models
{
    public class Word
    {
        public long Id { get; set; }
        public string Text { get; set; } = string.Empty;
        public string Category { get; set; } = "general";
        public string Difficulty { get; set; } = "medium";
        public bool IsActive { get; set; } = true;
        public string TargetProfile { get; set; } = "ambos";
        public string GradeLevel { get; set; } = "todos";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
