// Net : gestionnaire de la connexion Socket.io
const Net = {
  socket: null,

  connect() {
    if (this.socket && this.socket.connected) return;
    if (!Auth.token) return;

    this.socket = io({ auth: { token: Auth.token } });

    this.socket.on('connect', () => {
      console.log('[NET] connecté avec id', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[NET] erreur', err.message);
      if (err.message.includes('Token')) {
        toast('Session expirée, reconnexion requise', 'error');
        Auth.logout();
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[NET] déconnecté');
    });

    // ==== Lobby events ====
    this.socket.on('lobby:list', (list) => {
      Lobby.setList(list);
    });

    this.socket.on('lobby:state', (lobby) => {
      // Vérifier que je suis dans ce lobby
      const meId = this.socket.id;
      if (lobby.players.find(p => p.id === meId)) {
        Lobby.setCurrentLobby(lobby);
        if (Router.current === '/' || Router.current === '/login') {
          Router.navigate('/lobby');
        }
      } else if (Lobby.current && Lobby.current.id === lobby.id) {
        // Je n'y suis plus
        Lobby.current = null;
        if (Router.current === '/lobby') Router.handle();
      }
    });

    // ==== Game events ====
    this.socket.on('game:start', () => {
      toast('La partie commence !', 'success');
      Router.navigate('/game');
    });

    this.socket.on('game:state', (state) => {
      Game.setState(state);
    });

    this.socket.on('game:roundEnd', ({ winner, points }) => {
      Game.showRoundEndModal(winner, points, false);
    });

    this.socket.on('game:end', ({ winner }) => {
      Game.showRoundEndModal(winner, 0, true);
    });

    this.socket.on('game:playerLeft', ({ username }) => {
      toast(username + ' a quitté la partie', 'info');
    });
  }
};

// ==== Initialisation ====
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
  Lobby.init();
  Game.init();
  Router.init();

  // Si on a un token, se connecter au socket
  if (Auth.token) {
    Net.connect();
  }
});
