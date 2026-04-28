const Lobby = {
  current: null, // salon dans lequel on est, ou null
  list: [],

  init() {
    $('#btn-create-lobby').addEventListener('click', () => this.openCreateModal());
    $('#btn-cancel-create').addEventListener('click', () => this.closeCreateModal());
    $('#btn-confirm-create').addEventListener('click', () => this.createLobby());
    $('#btn-refresh-lobbies').addEventListener('click', () => {
      if (Net.socket) Net.socket.emit('lobby:list');
    });
    $('#btn-leave-lobby').addEventListener('click', () => this.leaveLobby());
    $('#btn-ready').addEventListener('click', () => this.toggleReady());
    $('#btn-start-game').addEventListener('click', () => this.startGame());

    // Modal close on backdrop
    $('#modal-create').addEventListener('click', (e) => {
      if (e.target.id === 'modal-create') this.closeCreateModal();
    });
  },

  onEnterLobby() {
    if (!this.current) {
      show($('#lobby-list-view'));
      hide($('#lobby-room-view'));
      if (Net.socket) Net.socket.emit('lobby:list');
    } else {
      show($('#lobby-room-view'));
      hide($('#lobby-list-view'));
      this.renderRoom(this.current);
    }
  },

  // ==== Vue liste des salons ====
  setList(list) {
    this.list = list;
    this.renderList();
  },

  renderList() {
    const container = $('#lobby-list');
    if (!this.list.length) {
      container.innerHTML = '<div class="lobby-empty">Aucun salon disponible. Créez-en un !</div>';
      return;
    }
    container.innerHTML = '';
    for (const lobby of this.list) {
      const card = document.createElement('div');
      card.className = 'lobby-card';
      const statusLabel = lobby.status === 'waiting' ? 'En attente' : 'En cours';
      const statusClass = lobby.status === 'waiting' ? 'status-waiting' : 'status-playing';
      card.innerHTML = `
        <div class="lobby-card-header">
          <div>
            <div class="lobby-card-name"></div>
            <div class="lobby-card-host">par <span class="lobby-card-host-name"></span></div>
          </div>
          <span class="lobby-card-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="lobby-card-info">
          <span>👥 ${lobby.playerCount} / ${lobby.maxPlayers} joueurs</span>
        </div>
        <button class="btn btn-primary btn-block btn-join" ${lobby.status !== 'waiting' || lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
          ${lobby.status !== 'waiting' ? 'Partie en cours' : (lobby.playerCount >= lobby.maxPlayers ? 'Complet' : 'Rejoindre')}
        </button>
      `;
      // Texte sécurisé (prévenir XSS)
      card.querySelector('.lobby-card-name').textContent = lobby.name;
      card.querySelector('.lobby-card-host-name').textContent = lobby.host;
      const btn = card.querySelector('.btn-join');
      btn.addEventListener('click', () => this.joinLobby(lobby.id));
      container.appendChild(card);
    }
  },

  // ==== Création d'un salon ====
  openCreateModal() {
    show($('#modal-create'));
    $('#new-lobby-name').value = '';
    setTimeout(() => $('#new-lobby-name').focus(), 50);
  },
  closeCreateModal() {
    hide($('#modal-create'));
  },

  createLobby() {
    const name = $('#new-lobby-name').value.trim();
    const maxPlayers = parseInt($('#new-lobby-max').value, 10);
    if (!Net.socket) return toast('Connexion en cours, réessayez dans un instant', 'error');
    Net.socket.emit('lobby:create', { name, maxPlayers }, (res) => {
      if (res.ok) {
        this.closeCreateModal();
        toast('Salon créé !', 'success');
      } else {
        toast(res.error || 'Erreur', 'error');
      }
    });
  },

  joinLobby(lobbyId) {
    if (!Net.socket) return;
    Net.socket.emit('lobby:join', { lobbyId }, (res) => {
      if (!res.ok) toast(res.error || 'Erreur', 'error');
    });
  },

  leaveLobby() {
    if (!this.current || !Net.socket) return;
    const lobbyId = this.current.id;
    Net.socket.emit('lobby:leave', { lobbyId }, () => {
      this.current = null;
      Router.handle();
    });
  },

  toggleReady() {
    if (!this.current || !Net.socket) return;
    const me = this.current.players.find(p => p.id === Net.socket.id);
    if (!me) return;
    Net.socket.emit('lobby:ready', { lobbyId: this.current.id, ready: !me.ready });
  },

  startGame() {
    if (!this.current || !Net.socket) return;
    Net.socket.emit('lobby:start', { lobbyId: this.current.id }, (res) => {
      if (!res.ok) toast(res.error || 'Erreur', 'error');
    });
  },

  // ==== Vue dans un salon ====
  setCurrentLobby(lobby) {
    this.current = lobby;
    if (Router.current === '/lobby') {
      hide($('#lobby-list-view'));
      show($('#lobby-room-view'));
      this.renderRoom(lobby);
    }
  },

  renderRoom(lobby) {
    $('#room-name').textContent = lobby.name;
    const meId = Net.socket?.id;
    const me = lobby.players.find(p => p.id === meId);
    const isHost = me && me.id === lobby.hostId;

    // Player tiles
    const grid = $('#room-players');
    grid.innerHTML = '';
    for (let i = 0; i < lobby.maxPlayers; i++) {
      const p = lobby.players[i];
      const tile = document.createElement('div');
      if (p) {
        tile.className = 'room-player' + (p.ready ? ' ready' : '');
        tile.innerHTML = `
          ${p.isHost ? '<span class="host-badge" title="Hôte">👑</span>' : ''}
          <div class="player-avatar"></div>
          <div class="player-name"></div>
          <div class="player-status">${p.ready ? '✓ Prêt' : 'En attente...'}</div>
        `;
        tile.querySelector('.player-name').textContent = p.username;
        tile.querySelector('.player-avatar').textContent = p.username.charAt(0).toUpperCase();
      } else {
        tile.className = 'room-player';
        tile.style.opacity = '0.4';
        tile.innerHTML = `
          <div class="player-avatar" style="background: var(--bg-elev-2)">+</div>
          <div class="player-name">Place libre</div>
          <div class="player-status">En attente...</div>
        `;
      }
      grid.appendChild(tile);
    }

    // Bouton "prêt"
    const btnReady = $('#btn-ready');
    if (me) {
      btnReady.textContent = me.ready ? '✓ Prêt' : 'Je suis prêt';
      btnReady.classList.toggle('btn-primary', me.ready);
      btnReady.classList.toggle('btn-secondary', !me.ready);
    }

    // Bouton "lancer"
    const btnStart = $('#btn-start-game');
    if (isHost) {
      show(btnStart);
      const allReady = lobby.players.every(p => p.ready || p.id === lobby.hostId);
      const enough = lobby.players.length >= 2;
      btnStart.disabled = !(allReady && enough);
      btnStart.textContent = !enough ? 'En attente d\'autres joueurs...' : (!allReady ? 'En attente des "prêts"...' : 'Lancer la partie');
    } else {
      hide(btnStart);
    }
  }
};
