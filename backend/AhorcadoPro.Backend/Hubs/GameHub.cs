using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using AhorcadoPro.Backend.Models;
using AhorcadoPro.Backend.Services;

namespace AhorcadoPro.Backend.Hubs
{
    public class GameHub : Hub
    {
        private readonly GameManager _gameManager;
        private readonly ILogger<GameHub> _logger;
        private readonly IAiService _aiService;

        public GameHub(GameManager gameManager, ILogger<GameHub> logger, IAiService aiService)
        {
            _gameManager = gameManager;
            _logger = logger;
            _aiService = aiService;
        }

        public async Task JoinGame(string gameId, string alias)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, gameId);

            Guid? userId = null;
            if (Context.User?.Identity?.IsAuthenticated == true)
            {
                var sub = Context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (Guid.TryParse(sub, out var parsed)) userId = parsed;
            }

            var result = await _gameManager.AddPlayerToGame(gameId, Context.ConnectionId, alias, userId);
            if (result != null)
                await Clients.Group(gameId).SendAsync("GameUpdated", result);
        }

        public async Task ProcessLetter(string gameId, string letter)
        {
            var result = await _gameManager.ProcessLetter(gameId, Context.ConnectionId, letter);
            if (result != null)
                await Clients.Group(gameId).SendAsync("GameUpdated", result);
        }

        public async Task SendMessage(string gameId, string alias, string message)
        {
            await Clients.Group(gameId).SendAsync("ReceiveMessage", alias, message);
        }

        public async Task RequestHint(string gameId, string profile = "")
        {
            var game = _gameManager.GetGame(gameId);
            if (game == null) return;
            var hint = await _aiService.GetHintAsync(game.WordToGuess, game.Category, profile);
            await Clients.Caller.SendAsync("ReceiveHint", hint);
        }

        public async Task RequestDefinition(string gameId, string profile = "")
        {
            var game = _gameManager.GetGame(gameId);
            if (game == null) return;
            var result = await _aiService.GetWordDefinitionAsync(game.WordToGuess, game.Category, profile);
            await Clients.Group(gameId).SendAsync("ReceiveDefinition", result);
        }

        /// <summary>
        /// Advances a room session to the next word and broadcasts the updated state to all players.
        /// Guard: no-op when the session is still InProgress or has already completed all words.
        /// Any connected client may call this (guest-safe for MVP).
        /// </summary>
        public async Task NextRound(string gameId)
        {
            var updated = await _gameManager.AdvanceToNextWord(gameId);
            if (updated != null)
                await Clients.Group(gameId).SendAsync("GameUpdated", updated);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await _gameManager.HandleDisconnect(Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }
    }
}
