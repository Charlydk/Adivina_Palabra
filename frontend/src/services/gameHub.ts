import * as signalR from '@microsoft/signalr';

const HUB_URL = import.meta.env.VITE_HUB_URL || 'http://localhost:5000/hubs/game';

class GameHubService {
  private connection: signalR.HubConnection | null = null;

  async startConnection(accessToken?: string) {
    if (this.connection) {
      try { await this.connection.stop(); } catch { /* ignore */ }
      this.connection = null;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
        accessTokenFactory: accessToken ? () => Promise.resolve(accessToken) : undefined
      })
      .withAutomaticReconnect()
      .build();

    try {
      await this.connection.start();
    } catch (err) {
      console.error('SignalR connection error:', err);
    }
  }

  async joinGame(gameId: string, alias: string) {
    await this.connection?.invoke('JoinGame', gameId, alias);
  }

  async processLetter(gameId: string, letter: string) {
    await this.connection?.invoke('ProcessLetter', gameId, letter);
  }

  async sendMessage(gameId: string, alias: string, message: string) {
    await this.connection?.invoke('SendMessage', gameId, alias, message);
  }

  async requestHint(gameId: string, profile: string = '') {
    await this.connection?.invoke('RequestHint', gameId, profile);
  }

  async requestDefinition(gameId: string, profile: string = '') {
    await this.connection?.invoke('RequestDefinition', gameId, profile);
  }

  /** Advance the room session to the next word. No-op when round is still InProgress. */
  async nextRound(gameId: string) {
    await this.connection?.invoke('NextRound', gameId);
  }

  /** Restart a concluded non-room game with a new word for the same connected players. */
  async playAgain(gameId: string) {
    await this.connection?.invoke('PlayAgain', gameId);
  }

  async stopConnection() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onGameUpdated(cb: (game: any) => void) { this.connection?.on('GameUpdated', cb); }
  onReceiveMessage(cb: (alias: string, message: string) => void) { this.connection?.on('ReceiveMessage', cb); }
  onReceiveHint(cb: (hint: string) => void) { this.connection?.on('ReceiveHint', cb); }
  onReceiveDefinition(cb: (data: { definition: string; bonus?: string }) => void) { this.connection?.on('ReceiveDefinition', cb); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offGameUpdated(cb: (game: any) => void) { this.connection?.off('GameUpdated', cb); }
  offReceiveMessage(cb: (alias: string, message: string) => void) { this.connection?.off('ReceiveMessage', cb); }
  offReceiveHint(cb: (hint: string) => void) { this.connection?.off('ReceiveHint', cb); }
  offReceiveDefinition(cb: (data: { definition: string; bonus?: string }) => void) { this.connection?.off('ReceiveDefinition', cb); }
}

export const gameHub = new GameHubService();
