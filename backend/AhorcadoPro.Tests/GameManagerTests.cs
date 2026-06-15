using AhorcadoPro.Backend.Services;
using AhorcadoPro.Backend.Models;
using Microsoft.Extensions.Logging;
using Moq;
using Microsoft.Extensions.DependencyInjection;
using AhorcadoPro.Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace AhorcadoPro.Tests
{
    public class GameManagerTests
    {
        private readonly GameManager _gameManager;
        private readonly Mock<IServiceProvider> _serviceProviderMock;
        private readonly Mock<ILogger<GameManager>> _loggerMock;

        public GameManagerTests()
        {
            _serviceProviderMock = new Mock<IServiceProvider>();
            _loggerMock = new Mock<ILogger<GameManager>>();

            // Setup In-Memory DB for testing
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "TestDb")
                .Options;

            var context = new ApplicationDbContext(options);
            context.Words.Add(new Word { Text = "TEST", Category = "Test", IsActive = true });
            context.SaveChanges();

            var serviceScopeMock = new Mock<IServiceScope>();
            var serviceScopeFactoryMock = new Mock<IServiceScopeFactory>();

            serviceScopeMock.Setup(s => s.ServiceProvider.GetService(typeof(ApplicationDbContext))).Returns(context);
            serviceScopeFactoryMock.Setup(s => s.CreateScope()).Returns(serviceScopeMock.Object);
            _serviceProviderMock.Setup(s => s.GetService(typeof(IServiceScopeFactory))).Returns(serviceScopeFactoryMock.Object);

            _gameManager = new GameManager(_serviceProviderMock.Object, _loggerMock.Object);
        }

        [Fact]
        public async Task CreateGame_ShouldReturnGameWithWord()
        {
            var game = await _gameManager.CreateGame(GameMode.Solo, "Tester");

            Assert.NotNull(game);
            Assert.Equal("TEST", game.WordToGuess);
            Assert.Equal(GameStatus.Waiting, game.Status);
        }

        [Fact]
        public async Task ProcessLetter_CorrectLetter_ShouldUpdateGuessedLetters()
        {
            var game = await _gameManager.CreateGame(GameMode.Solo, "Tester");
            game.Status = GameStatus.InProgress;

            var result = await _gameManager.ProcessLetter(game.Id, "connection1", "T");

            Assert.Contains("T", result.GuessedLetters);
            Assert.Equal(6, result.RemainingAttempts);
        }

        [Fact]
        public async Task ProcessLetter_IncorrectLetter_ShouldDecreaseAttempts()
        {
            var game = await _gameManager.CreateGame(GameMode.Solo, "Tester");
            game.Status = GameStatus.InProgress;

            var result = await _gameManager.ProcessLetter(game.Id, "connection1", "Z");

            Assert.Contains("Z", result.IncorrectLetters);
            Assert.Equal(5, result.RemainingAttempts);
        }
    }
}
