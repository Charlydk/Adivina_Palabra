namespace AhorcadoPro.Backend.Models
{
    public class WordListItem
    {
        public long Id { get; set; }
        public long WordListId { get; set; }
        public string Text { get; set; } = string.Empty;
        public string? Definition { get; set; }
        public string? Category { get; set; }
        public int Position { get; set; }
        public WordList WordList { get; set; } = null!;
    }
}
