const { buildDeck, shuffle, cardPoints, canPlay, COLORS } = require('./deck');

/**
 * Représente une partie UNO.
 * État interne :
 *  - players: [{ id, username, hand: [], score, hasCalledUno }]
 *  - drawPile, discardPile
 *  - currentColor (utile pour wild/+4)
 *  - currentPlayerIdx
 *  - direction: +1 (horaire) ou -1 (antihoraire)
 *  - status: 'waiting' | 'playing' | 'round_end' | 'finished'
 *  - pendingDraw: nombre de cartes accumulées par les +2 (chaînage)
 */
class Game {
  constructor(lobbyId, players, options = {}) {
    this.lobbyId = lobbyId;
    this.players = players.map(p => ({
      id: p.id,            // socket id ou user id selon contexte
      userId: p.userId,
      username: p.username,
      hand: [],
      score: 0,
      hasCalledUno: false,
      connected: true
    }));
    this.targetScore = options.targetScore || 500;
    this.status = 'waiting';
    this.history = []; // events utiles pour le client (logs)
    this.resetForRound();
  }

  resetForRound() {
    this.drawPile = shuffle(buildDeck());
    this.discardPile = [];
    this.currentColor = null;
    this.currentPlayerIdx = 0;
    this.direction = 1;
    this.pendingDraw = 0;
    this.awaitingColorChoice = false; // après wild/+4
    this.lastPlayerWhoNeedsToCallUno = null; // joueur qui vient de poser sa avant-dernière carte
    this.history = [];
    for (const p of this.players) {
      p.hand = [];
      p.hasCalledUno = false;
    }
  }

  // Démarre une manche : distribue 7 cartes à chacun, retourne la 1re carte
  startRound() {
    this.resetForRound();
    // Distribuer 7 cartes
    for (let i = 0; i < 7; i++) {
      for (const p of this.players) {
        p.hand.push(this.drawPile.pop());
      }
    }
    // Première carte : on retourne du dessus, mais si c'est un +4 on le replace
    let first;
    do {
      first = this.drawPile.pop();
      if (first.value === 'plus4') {
        // replacer au hasard
        const idx = Math.floor(Math.random() * this.drawPile.length);
        this.drawPile.splice(idx, 0, first);
        first = null;
      }
    } while (first === null);

    this.discardPile.push(first);
    this.currentColor = first.color === 'wild' ? COLORS[Math.floor(Math.random() * 4)] : first.color;

    // Effets si la carte de départ est spéciale (selon règles)
    if (first.value === 'skip') {
      // le 1er joueur passe son tour
      this.advanceTurn();
    } else if (first.value === 'reverse') {
      this.direction = -1;
      // En 2 joueurs reverse = skip, sinon le donneur joue (on fait simple : avance)
      if (this.players.length === 2) this.advanceTurn();
      // Sinon : on inverse, donc on commence par le dernier joueur
      else this.currentPlayerIdx = this.players.length - 1;
    } else if (first.value === 'plus2') {
      this.pendingDraw = 2;
    }

    this.status = 'playing';
    this.pushEvent({ type: 'round_start', firstCard: first, currentColor: this.currentColor });
  }

  pushEvent(event) {
    this.history.push({ ...event, timestamp: Date.now() });
    if (this.history.length > 50) this.history.shift();
  }

  topCard() {
    return this.discardPile[this.discardPile.length - 1];
  }

  currentPlayer() {
    return this.players[this.currentPlayerIdx];
  }

  // Retourne le joueur qui jouera après le courant (sans modifier l'état)
  peekNextPlayer(skip = 0) {
    const n = this.players.length;
    let idx = (this.currentPlayerIdx + this.direction * (1 + skip) + n * 10) % n;
    return this.players[idx];
  }

  advanceTurn(skip = 0) {
    const n = this.players.length;
    this.currentPlayerIdx = (this.currentPlayerIdx + this.direction * (1 + skip) + n * 10) % n;
  }

  // Repioche depuis la défausse si la pioche est vide
  refillDrawPile() {
    if (this.drawPile.length === 0 && this.discardPile.length > 1) {
      const top = this.discardPile.pop();
      this.drawPile = shuffle(this.discardPile);
      this.discardPile = [top];
      this.pushEvent({ type: 'reshuffle' });
    }
  }

  drawCards(player, count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      this.refillDrawPile();
      if (this.drawPile.length === 0) break;
      const c = this.drawPile.pop();
      player.hand.push(c);
      drawn.push(c);
    }
    player.hasCalledUno = false; // si on pioche, on perd l'état UNO
    return drawn;
  }

  // Appel manuel de UNO (avant-dernière carte)
  callUno(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { ok: false, error: 'Joueur introuvable' };
    if (player.hand.length !== 2 && player.hand.length !== 1) {
      return { ok: false, error: 'Vous ne pouvez crier UNO qu\'avec 1 ou 2 cartes' };
    }
    player.hasCalledUno = true;
    this.pushEvent({ type: 'uno_called', player: player.username });
    return { ok: true };
  }

  // Dénonce un joueur qui a oublié de crier UNO
  // -> il pioche 2 cartes en pénalité
  denounceUno(accuserId, targetId) {
    const target = this.players.find(p => p.id === targetId);
    if (!target) return { ok: false, error: 'Cible introuvable' };
    if (target.hand.length === 1 && !target.hasCalledUno) {
      this.drawCards(target, 2);
      this.pushEvent({ type: 'uno_penalty', player: target.username });
      return { ok: true, penalty: true };
    }
    return { ok: false, error: 'Pas de pénalité applicable' };
  }

  /**
   * Joue une carte. options.chosenColor pour wild/+4.
   * Retourne { ok, error?, roundEnded?, gameEnded? }
   */
  playCard(playerId, cardId, options = {}) {
    if (this.status !== 'playing') return { ok: false, error: 'Partie pas en cours' };
    const player = this.currentPlayer();
    if (player.id !== playerId) return { ok: false, error: 'Ce n\'est pas votre tour' };

    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { ok: false, error: 'Carte introuvable dans votre main' };
    const card = player.hand[cardIdx];

    // Si pendingDraw > 0 : seul un +2 peut être joué (chaînage de +2)
    if (this.pendingDraw > 0) {
      if (card.value !== 'plus2') {
        return { ok: false, error: 'Vous devez piocher ' + this.pendingDraw + ' cartes ou jouer un +2' };
      }
    }

    const top = this.topCard();
    if (!canPlay(card, top, this.currentColor)) {
      return { ok: false, error: 'Carte non jouable' };
    }

    // Carte wild / plus4 : il faut une couleur choisie
    if (card.color === 'wild') {
      if (!options.chosenColor || !COLORS.includes(options.chosenColor)) {
        return { ok: false, error: 'Couleur à choisir' };
      }
    }

    // Retirer la carte de la main et la mettre sur la défausse
    player.hand.splice(cardIdx, 1);
    this.discardPile.push(card);

    // Mise à jour de la couleur active
    if (card.color === 'wild') {
      this.currentColor = options.chosenColor;
    } else {
      this.currentColor = card.color;
    }

    this.pushEvent({
      type: 'play',
      player: player.username,
      card,
      chosenColor: card.color === 'wild' ? options.chosenColor : null
    });

    // Si le joueur a maintenant 1 carte, il est susceptible de pénalité s'il n'a pas crié UNO
    // On vérifie si pendant le tour il a explicitement appelé UNO via callUno()
    // Si options.callUno = true et il lui reste 1 carte, on valide
    if (player.hand.length === 1) {
      if (options.callUno) {
        player.hasCalledUno = true;
      }
      this.lastPlayerWhoNeedsToCallUno = player.id;
    }

    // Vérifier fin de manche
    if (player.hand.length === 0) {
      return this.endRound(player);
    }

    // Effets de la carte
    let skip = 0;
    if (card.value === 'skip') {
      skip = 1;
    } else if (card.value === 'reverse') {
      this.direction *= -1;
      if (this.players.length === 2) skip = 1; // en 2 joueurs reverse = skip
    } else if (card.value === 'plus2') {
      this.pendingDraw += 2;
    } else if (card.value === 'plus4') {
      // Le joueur suivant pioche 4 et passe son tour
      // (Pas de chaînage du +4 dans la règle classique présentée)
      const next = this.peekNextPlayer();
      this.drawCards(next, 4);
      this.pushEvent({ type: 'forced_draw', player: next.username, count: 4 });
      skip = 1;
    }

    // Avancer le tour, en appliquant un skip si nécessaire
    this.advanceTurn(skip);

    // Si pendingDraw était dû à un +2 et le joueur suivant a joué un +2,
    // on continue. Sinon, à l'arrivée chez le joueur suivant on lui fait piocher.
    // -> géré dans handlePendingDrawIfNeeded au début de son tour côté serveur (gestion).
    // On force ici la pioche si le joueur suivant n'a aucun +2 ? Non : règle = il peut choisir.
    // Si le joueur ne peut pas chaîner, il devra piocher pendingDraw via une action explicite.
    // On laisse le client gérer, mais le serveur impose : tant que pendingDraw>0, seul +2 jouable.

    return { ok: true };
  }

  // Le joueur courant pioche (volontairement, ou contraint par +2 chaîné)
  drawAction(playerId) {
    if (this.status !== 'playing') return { ok: false, error: 'Partie pas en cours' };
    const player = this.currentPlayer();
    if (player.id !== playerId) return { ok: false, error: 'Ce n\'est pas votre tour' };

    if (this.pendingDraw > 0) {
      // Pioche forcée : pioche pendingDraw et passe son tour
      const drawn = this.drawCards(player, this.pendingDraw);
      this.pushEvent({ type: 'forced_draw', player: player.username, count: this.pendingDraw });
      this.pendingDraw = 0;
      this.advanceTurn();
      return { ok: true, drawn, forced: true };
    }

    // Pioche normale : 1 carte
    const drawn = this.drawCards(player, 1);
    this.pushEvent({ type: 'draw', player: player.username });
    return { ok: true, drawn, canPlayDrawn: drawn.length > 0 && canPlay(drawn[0], this.topCard(), this.currentColor) };
  }

  // Le joueur passe son tour après avoir pioché (s'il ne souhaite pas/peut pas jouer la carte tirée)
  passAfterDraw(playerId) {
    if (this.status !== 'playing') return { ok: false, error: 'Partie pas en cours' };
    const player = this.currentPlayer();
    if (player.id !== playerId) return { ok: false, error: 'Ce n\'est pas votre tour' };
    this.advanceTurn();
    return { ok: true };
  }

  endRound(winner) {
    this.status = 'round_end';
    let total = 0;
    for (const p of this.players) {
      if (p.id === winner.id) continue;
      for (const c of p.hand) total += cardPoints(c);
    }
    winner.score += total;
    this.pushEvent({ type: 'round_end', winner: winner.username, points: total });

    if (winner.score >= this.targetScore) {
      this.status = 'finished';
      this.pushEvent({ type: 'game_end', winner: winner.username });
      return { ok: true, roundEnded: true, gameEnded: true, winner: winner.username, points: total };
    }
    return { ok: true, roundEnded: true, gameEnded: false, winner: winner.username, points: total };
  }

  // Démarre la prochaine manche (appelé après round_end)
  nextRound() {
    if (this.status !== 'round_end') return { ok: false, error: 'Pas en fin de manche' };
    // Le gagnant devient le donneur, donc le 1er à jouer = personne à sa gauche
    this.startRound();
    // Avancer pour que le 1er joueur soit celui à gauche du gagnant
    return { ok: true };
  }

  // État public à envoyer aux clients (chacun ne voit pas les mains des autres)
  publicState(forPlayerId = null) {
    return {
      lobbyId: this.lobbyId,
      status: this.status,
      direction: this.direction,
      currentColor: this.currentColor,
      pendingDraw: this.pendingDraw,
      topCard: this.topCard() || null,
      drawPileSize: this.drawPile.length,
      currentPlayerIdx: this.currentPlayerIdx,
      currentPlayerId: this.currentPlayer() ? this.currentPlayer().id : null,
      targetScore: this.targetScore,
      players: this.players.map(p => ({
        id: p.id,
        username: p.username,
        score: p.score,
        handCount: p.hand.length,
        hasCalledUno: p.hasCalledUno,
        connected: p.connected,
        // Si c'est le joueur demandeur, on lui envoie sa main
        hand: forPlayerId === p.id ? p.hand : undefined
      })),
      history: this.history.slice(-15)
    };
  }
}

module.exports = Game;
