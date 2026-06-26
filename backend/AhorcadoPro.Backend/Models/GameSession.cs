using System.Text.Json.Serialization;
using System.Threading;

namespace AhorcadoPro.Backend.Models
{
    public enum GameMode
    {
        Solo,
        VersusLocal,
        OnlineCoop,
        OnlineVersus
    }

    public enum GameStatus
    {
        Waiting,
        InProgress,
        Won,
        Lost,
        Aborted
    }

    public class GameSession
    {
        [JsonIgnore]
        public SemaphoreSlim StateLock { get; } = new SemaphoreSlim(1, 1);

        public string Id { get; set; } = Guid.NewGuid().ToString();
        public GameMode Mode { get; set; }
        public GameStatus Status { get; set; } = GameStatus.Waiting;

        public string WordToGuess { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;

        // Word-generation params remembered so "Play Again" keeps the same theme/category.
        public string? Theme { get; set; }
        public string? EducationalCategory { get; set; }
        public string? Profile { get; set; }

        // Classroom mode: teacher host (spectator, not a player slot)
        public string? HostId { get; set; }
        public string? HostAlias { get; set; }

        // For online modes
        public string? Player1Id { get; set; }
        public string? Player1Alias { get; set; }
        public string? Player2Id { get; set; }
        public string? Player2Alias { get; set; }

        public string GuessedLetters { get; set; } = string.Empty;
        public string IncorrectLetters { get; set; } = string.Empty;
        public int RemainingAttempts { get; set; }
        public int MaxAttempts { get; set; }

        public string? CurrentTurnPlayerId { get; set; }

        public string? CurrentTurnAlias =>
            CurrentTurnPlayerId == null ? null :
            CurrentTurnPlayerId == Player1Id ? Player1Alias :
            CurrentTurnPlayerId == Player2Id ? Player2Alias : null;

        public Guid? Player1UserId { get; set; }
        public Guid? Player2UserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? FinishedAt { get; set; }
        public DateTime LastActivity { get; set; } = DateTime.UtcNow;

        // For OnlineVersus (Option A: Race)
        // We might need separate states if they race on the same word but independently?
        // User said: "Both compete for guessing the same word simultaneously, the first to finish wins."
        // This means they each have their own progress on the same word.
        public string? Player1Progress { get; set; }
        public string? Player2Progress { get; set; }
        public string? Player1Incorrect { get; set; }
        public string? Player2Incorrect { get; set; }
        public int Player1RemainingAttempts { get; set; }
        public int Player2RemainingAttempts { get; set; }

        public string? WinnerAlias { get; set; }

        // Room session fields (teacher word rooms)
        public bool IsRoom { get; set; } = false;
        public List<RoomWord> RoomWords { get; set; } = new();
        public int CurrentWordIndex { get; set; } = 0;
        public bool RoomCompleted { get; set; } = false;
        public List<WordResultEntry> WordResults { get; set; } = new();
        public string? JoinCode { get; set; }
        public string? ListName { get; set; }
        public int TotalWords => RoomWords.Count;
        public string? CurrentDefinition =>
            IsRoom && CurrentWordIndex >= 0 && CurrentWordIndex < RoomWords.Count
                ? RoomWords[CurrentWordIndex].Definition
                : null;
    }
}
