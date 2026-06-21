namespace AhorcadoPro.Backend.Models
{
    public class WordResultEntry
    {
        public int Position { get; set; }
        public string Word { get; set; } = string.Empty;
        public int Errors { get; set; }
        public bool Won { get; set; }
    }
}
