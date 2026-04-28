const Game = {
  state: null,
  pendingPlayCard: null, // pour wild/+4 : carte à jouer après choix de couleur

  init() {
    $('#pile-draw').addEventListener('click', () => this.drawCard());
    $('#btn-call-uno').addEventListener('click', () => this.callUno());
    $('#btn-pass').addEventListener('click', () => this.passAfterDraw());
    $('#btn-next-round').addEventListener('click', () => this.nextRound());
    $('#btn-back-to-lobby').addEventListener('click', () => {
      hide($('#modal-round'));
      Lobby.current = null;
      Router.navigate('/lobby');
    });

    // Choix de couleur
    $$('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        if (this.pendingPlayCard) {
          this.sendPlayCard(this.pendingPlayCard, color);
          this.pendingPlayCard = null;
          hide($('#modal-color'));
        }
      });
    });
  },

  onEnterGame() {
    if (!this.state) {
      // Pas d'état = on n'a pas le droit d'être ici
      Router.navigate('/lobby');
    } else {
      this.render();
    }
  },

  setState(state) {
    this.state = state;
    if (Router.current === '/game') {
      this.render();
    }
  },

  render() {
    if (!this.state) return;
    const s = this.state;
    const meId = Net.socket?.id;
    const me = s.players.find(p => p.id === meId);
    const isMyTurn = s.currentPlayerId === meId;

    // ==== Adversaires ====
    const oppContainer = $('#opponents');
    oppContainer.innerHTML = '';
    // Trier les adversaires pour les afficher dans l'ordre naturel à partir du joueur actuel
    const myIdx = s.players.findIndex(p => p.id === meId);
    const ordered = [];
    if (myIdx !== -1) {
      for (let i = 1; i < s.players.length; i++) {
        ordered.push(s.players[(myIdx + i) % s.players.length]);
      }
    } else {
      ordered.push(...s.players);
    }
    for (const p of ordered) {
      const isCurrent = p.id === s.currentPlayerId;
      const showUnoBtn = p.handCount === 1 && !p.hasCalledUno;
      const opp = document.createElement('div');
      opp.className = 'opponent' + (isCurrent ? ' active' : '') + (!p.connected ? ' opp-disconnected' : '') + (showUnoBtn ? ' uno-warning' : '');
      let cardsHtml = '';
      const visibleCount = Math.min(p.handCount, 7);
      for (let i = 0; i < visibleCount; i++) {
        cardsHtml += '<div class="opp-card"></div>';
      }
      opp.innerHTML = `
        <div class="opp-name"></div>
        <div class="opp-meta">
          <span>🃏 ${p.handCount}</span>
          <span>⭐ ${p.score}</span>
        </div>
        <div class="opp-cards">${cardsHtml}</div>
      `;
      opp.querySelector('.opp-name').textContent = p.username;
      // Click on UNO badge to denounce
      if (showUnoBtn) {
        opp.addEventListener('click', () => {
          Net.socket.emit('game:denounceUno', { lobbyId: s.lobbyId, targetId: p.id }, (res) => {
            if (res && res.ok && res.penalty) {
              toast(p.username + ' a été pénalisé(e) ! +2 cartes', 'success');
            } else if (res && !res.ok) {
              // Trop tard ou pas applicable
            }
          });
        });
      }
      oppContainer.appendChild(opp);
    }

    // ==== Centre ====
    // Couleur active
    const colorEl = $('#current-color');
    colorEl.className = 'color-indicator';
    if (s.currentColor) colorEl.classList.add(s.currentColor);

    // Direction
    $('#direction-indicator').textContent = s.direction === 1 ? '→' : '←';

    // Pioche restante
    $('#draw-pile-count').textContent = s.drawPileSize;

    // Pending draw
    if (s.pendingDraw > 0) {
      show($('#pending-block'));
      $('#pending-count').textContent = s.pendingDraw;
    } else {
      hide($('#pending-block'));
    }

    // Défausse
    if (s.topCard) {
      $('#discard-img').src = cardImagePath(s.topCard);
      $('#discard-img').alt = colorLabel(s.topCard.color) + ' ' + valueLabel(s.topCard);
    }

    // Message
    const msg = $('#game-message');
    if (s.status === 'finished') {
      msg.textContent = '';
    } else if (isMyTurn) {
      if (s.pendingDraw > 0) {
        msg.textContent = `À toi ! Joue un +2 ou pioche ${s.pendingDraw} cartes.`;
      } else {
        msg.textContent = 'À toi de jouer !';
      }
      msg.className = 'game-message';
    } else {
      const cur = s.players.find(p => p.id === s.currentPlayerId);
      msg.textContent = cur ? `Tour de ${cur.username}` : '';
      msg.className = 'game-message';
    }

    // ==== Ma main ====
    const handContainer = $('#my-hand');
    handContainer.innerHTML = '';
    if (me && me.hand) {
      for (const card of me.hand) {
        const div = document.createElement('div');
        div.className = 'hand-card';
        const playable = isMyTurn && this.canPlayClient(card, s);
        div.classList.add(playable ? 'playable' : 'unplayable');
        const img = document.createElement('img');
        img.src = cardImagePath(card);
        img.alt = colorLabel(card.color) + ' ' + valueLabel(card);
        img.draggable = false;
        div.appendChild(img);
        div.addEventListener('click', () => this.tryPlay(card));
        handContainer.appendChild(div);
      }
    }

    // ==== Boutons ====
    // UNO bouton : actif si j'ai 2 cartes et c'est mon tour (avant de jouer la 2e)
    // ou si j'ai 1 carte et je viens de poser sans avoir crié UNO (rattrapage)
    const btnUno = $('#btn-call-uno');
    if (me && (me.hand?.length === 2 || me.hand?.length === 1)) {
      show(btnUno);
      btnUno.disabled = !!me.hasCalledUno;
    } else {
      hide(btnUno);
    }

    // Pile draw clickable seulement si mon tour
    $('#pile-draw').style.cursor = isMyTurn ? 'pointer' : 'not-allowed';
    $('#pile-draw').style.opacity = isMyTurn ? '1' : '0.6';

    // Bouton Pass
    hide($('#btn-pass'));
  },

  // Vérifie si une carte est jouable côté client (pour highlight visuel)
  canPlayClient(card, s) {
    if (!s.topCard) return true;
    if (s.pendingDraw > 0) return card.value === 'plus2';
    if (card.color === 'wild') return true;
    if (card.color === s.currentColor) return true;
    if (card.value === s.topCard.value) return true;
    return false;
  },

  tryPlay(card) {
    const s = this.state;
    const meId = Net.socket?.id;
    if (s.currentPlayerId !== meId) {
      toast('Ce n\'est pas ton tour', 'error');
      return;
    }
    if (!this.canPlayClient(card, s)) {
      toast('Carte non jouable', 'error');
      return;
    }
    // Si carte wild/+4 : demander la couleur
    if (card.color === 'wild') {
      this.pendingPlayCard = card;
      show($('#modal-color'));
      return;
    }
    this.sendPlayCard(card, null);
  },

  sendPlayCard(card, chosenColor) {
    if (!Net.socket) return;
    const me = this.state.players.find(p => p.id === Net.socket.id);
    // Si après ce coup il me reste 1 carte, je peux ajouter callUno=true automatiquement
    // (option : on suppose qu'il a cliqué sur UNO ou pas avant)
    const willHaveOne = me && me.hand && me.hand.length === 2;
    Net.socket.emit('game:play', {
      lobbyId: this.state.lobbyId,
      cardId: card.id,
      chosenColor,
      callUno: willHaveOne ? me.hasCalledUno : false
    }, (res) => {
      if (!res.ok) toast(res.error, 'error');
    });
  },

  drawCard() {
    const s = this.state;
    if (!s) return;
    const meId = Net.socket?.id;
    if (s.currentPlayerId !== meId) {
      toast('Ce n\'est pas ton tour', 'error');
      return;
    }
    Net.socket.emit('game:draw', { lobbyId: s.lobbyId }, (res) => {
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      if (res.forced) {
        toast('Tu as été contraint de piocher ' + res.drawn.length + ' cartes', 'info');
      } else if (res.canPlayDrawn) {
        // Le joueur peut jouer la carte piochée -> on le laisse cliquer dessus.
        // On affiche le bouton "passer mon tour" pour qu'il puisse renoncer.
        show($('#btn-pass'));
        $('#game-message').textContent = 'Tu peux jouer la carte piochée, ou passer ton tour.';
      } else {
        // Pas jouable -> avancer le tour
        Net.socket.emit('game:passAfterDraw', { lobbyId: s.lobbyId });
      }
    });
  },

  passAfterDraw() {
    const s = this.state;
    if (!s) return;
    Net.socket.emit('game:passAfterDraw', { lobbyId: s.lobbyId });
    hide($('#btn-pass'));
  },

  callUno() {
    const s = this.state;
    if (!s) return;
    Net.socket.emit('game:callUno', { lobbyId: s.lobbyId }, (res) => {
      if (res.ok) toast('UNO !', 'success');
      else toast(res.error, 'error');
    });
  },

  nextRound() {
    if (!this.state) return;
    Net.socket.emit('game:nextRound', { lobbyId: this.state.lobbyId }, (res) => {
      if (res.ok) hide($('#modal-round'));
      else toast(res.error || 'Erreur', 'error');
    });
  },

  showRoundEndModal(winner, points, gameEnded) {
    const titleEl = $('#round-title');
    const textEl = $('#round-text');
    const scoresEl = $('#round-scores');
    const btnNext = $('#btn-next-round');
    const btnBack = $('#btn-back-to-lobby');

    if (gameEnded) {
      titleEl.textContent = '🏆 ' + winner + ' a gagné la partie !';
      textEl.textContent = `Score atteint : ${this.state?.targetScore || 500} points.`;
      hide(btnNext);
      show(btnBack);
    } else {
      titleEl.textContent = winner + ' remporte la manche !';
      textEl.textContent = '+' + points + ' points pour ' + winner;
      show(btnNext);
      hide(btnBack);
    }

    // Liste des scores
    if (this.state) {
      scoresEl.innerHTML = '';
      const sorted = this.state.players.slice().sort((a, b) => b.score - a.score);
      for (const p of sorted) {
        const row = document.createElement('div');
        row.className = 'round-score-row' + (p.username === winner && gameEnded ? ' winner' : '');
        row.innerHTML = '<span class="score-name"></span><strong></strong>';
        row.querySelector('.score-name').textContent = p.username;
        row.querySelector('strong').textContent = p.score + ' pts';
        scoresEl.appendChild(row);
      }
    }

    show($('#modal-round'));
  }
};
