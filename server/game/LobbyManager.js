const Game = require('./Game');

/**
 * Lobby:
 *   id, name, hostId, players: [{ id (socketId), userId, username, ready }],
 *   maxPlayers, status: 'waiting'|'playing'|'finished',
 *   game: Game instance | null
 */
class LobbyManager {
  constructor() {
    this.lobbies = new Map();
    this.counter = 1;
  }

  createLobby(host, name, maxPlayers = 4) {
    const id = 'lobby_' + (this.counter++);
    const lobby = {
      id,
      name: name || ('Salon de ' + host.username),
      hostId: host.id,
      players: [{
        id: host.id,
        userId: host.userId,
        username: host.username,
        ready: false
      }],
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 4),
      status: 'waiting',
      game: null
    };
    this.lobbies.set(id, lobby);
    return lobby;
  }

  listLobbies() {
    return Array.from(this.lobbies.values())
      .filter(l => l.status !== 'finished')
      .map(l => ({
        id: l.id,
        name: l.name,
        playerCount: l.players.length,
        maxPlayers: l.maxPlayers,
        status: l.status,
        host: l.players.find(p => p.id === l.hostId)?.username || '???'
      }));
  }

  getLobby(id) {
    return this.lobbies.get(id);
  }

  joinLobby(id, player) {
    const lobby = this.lobbies.get(id);
    if (!lobby) return { ok: false, error: 'Salon introuvable' };
    if (lobby.status !== 'waiting') return { ok: false, error: 'Partie déjà commencée' };
    if (lobby.players.length >= lobby.maxPlayers) return { ok: false, error: 'Salon complet' };
    if (lobby.players.find(p => p.userId === player.userId)) {
      return { ok: false, error: 'Vous êtes déjà dans ce salon' };
    }
    lobby.players.push({
      id: player.id,
      userId: player.userId,
      username: player.username,
      ready: false
    });
    return { ok: true, lobby };
  }

  leaveLobby(id, playerId) {
    const lobby = this.lobbies.get(id);
    if (!lobby) return null;
    lobby.players = lobby.players.filter(p => p.id !== playerId);
    if (lobby.players.length === 0) {
      this.lobbies.delete(id);
      return { deleted: true };
    }
    if (lobby.hostId === playerId) {
      lobby.hostId = lobby.players[0].id;
    }
    return { lobby };
  }

  setReady(id, playerId, ready) {
    const lobby = this.lobbies.get(id);
    if (!lobby) return null;
    const p = lobby.players.find(pl => pl.id === playerId);
    if (!p) return null;
    p.ready = !!ready;
    return lobby;
  }

  startGame(id, playerId) {
    const lobby = this.lobbies.get(id);
    if (!lobby) return { ok: false, error: 'Salon introuvable' };
    if (lobby.hostId !== playerId) return { ok: false, error: 'Seul l\'hôte peut lancer la partie' };
    if (lobby.players.length < 2) return { ok: false, error: 'Il faut au moins 2 joueurs' };
    if (!lobby.players.every(p => p.ready || p.id === lobby.hostId)) {
      return { ok: false, error: 'Tous les joueurs ne sont pas prêts' };
    }

    lobby.status = 'playing';
    lobby.game = new Game(lobby.id, lobby.players);
    lobby.game.startRound();
    return { ok: true, lobby };
  }

  // Pour le cas où un joueur se déconnecte pendant une partie
  removePlayerFromGame(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || !lobby.game) return null;
    const p = lobby.game.players.find(pl => pl.id === playerId);
    if (p) p.connected = false;
    return lobby;
  }
}

module.exports = LobbyManager;
