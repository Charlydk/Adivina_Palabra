using AhorcadoPro.Backend.Services;

namespace AhorcadoPro.Backend.BackgroundServices
{
    public class GameCleanupService : BackgroundService
    {
        private readonly GameManager _gameManager;
        private readonly ILogger<GameCleanupService> _logger;
        private readonly TimeSpan _cleanupInterval = TimeSpan.FromMinutes(5);
        private readonly TimeSpan _maxIdleTime = TimeSpan.FromHours(1);

        public GameCleanupService(GameManager gameManager, ILogger<GameCleanupService> logger)
        {
            _gameManager = gameManager;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Game Cleanup Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogDebug("Running cleanup for idle games...");
                _gameManager.CleanupIdleGames(_maxIdleTime);

                await Task.Delay(_cleanupInterval, stoppingToken);
            }

            _logger.LogInformation("Game Cleanup Service is stopping.");
        }
    }
}
