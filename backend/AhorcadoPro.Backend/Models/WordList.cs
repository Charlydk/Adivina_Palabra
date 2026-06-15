namespace AhorcadoPro.Backend.Models
{
    public class WordList
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? OwnerAlias { get; set; }
        public string? JoinCode { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public List<WordListItem> Items { get; set; } = [];
    }
}
