const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const { PORT, JWT_SECRET } = require('./config');
const { router: authRouter } = require('./routes/auth');
const { run } = require('./db/database');
const LobbyManager = require('./game/LobbyManager');

// --- App Express ---
const app = express();
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', 'public')));
app.use('/api/auth', authRouter);

// Route fallback : sert index.html pour les routes côté client
app.get(['/', '/login', '/lobby', '/game'], (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

// --- Serveur HTTP + Socket.io ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const lobbyManager = new LobbyManager();

// Authentification socket via JWT (envoyé en handshake.auth.token)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token manquant'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { id: payload.id, username: payload.username };
    next();
  } catch (e) {
    next(new Error('Token invalide'));
  }
});

// Helpers d'envoi d'état
function broadcastLobbyList() {
  io.emit('lobby:list', lobbyManager.listLobbies());
}

function emitLobbyState(lobby) {
  io.to(lobby.id).emit('lobby:state', {
    id: lobby.id,
    name: lobby.name,
    hostId: lobby.hostId,
    players: lobby.players.map(p => ({
      id: p.id, username: p.username, ready: p.ready, isHost: p.id === lobby.hostId
    })),
    maxPlayers: lobby.maxPlayers,
    status: lobby.status
  });
}

function emitGameState(lobby) {
  if (!lobby.game) return;
  for (const p of lobby.game.players) {
    if (!p.connected) continue;
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit('game:state', lobby.game.publicState(p.id));
  }
}

io.on('connection', (socket) => {
  const user = socket.user;
  console.log('[SOCKET]', user.username, 'connecté');

  socket.emit('auth:ok', { user });
  // Envoyer la liste des lobbies dès la connexion
  socket.emit('lobby:list', lobbyManager.listLobbies());

  // ---- LOBBY ----
  socket.on('lobby:create', ({ name, maxPlayers }, cb) => {
    const lobby = lobbyManager.createLobby({
      id: socket.id, userId: user.id, username: user.username
    }, name, maxPlayers);
    socket.join(lobby.id);
    cb && cb({ ok: true, lobbyId: lobby.id });
    emitLobbyState(lobby);
    broadcastLobbyList();
  });

  socket.on('lobby:join', ({ lobbyId }, cb) => {
    const result = lobbyManager.joinLobby(lobbyId, {
      id: socket.id, userId: user.id, username: user.username
    });
    if (!result.ok) return cb && cb(result);
    socket.join(lobbyId);
    cb && cb({ ok: true, lobbyId });
    emitLobbyState(result.lobby);
    broadcastLobbyList();
  });

  socket.on('lobby:leave', ({ lobbyId }, cb) => {
    const r = lobbyManager.leaveLobby(lobbyId, socket.id);
    socket.leave(lobbyId);
    cb && cb({ ok: true });
    if (r && r.lobby) emitLobbyState(r.lobby);
    broadcastLobbyList();
  });

  socket.on('lobby:ready', ({ lobbyId, ready }) => {
    const lobby = lobbyManager.setReady(lobbyId, socket.id, ready);
    if (lobby) emitLobbyState(lobby);
  });

  socket.on('lobby:start', ({ lobbyId }, cb) => {
    const r = lobbyManager.startGame(lobbyId, socket.id);
    if (!r.ok) return cb && cb(r);
    cb && cb({ ok: true });
    emitLobbyState(r.lobby);
    io.to(r.lobby.id).emit('game:start');
    emitGameState(r.lobby);
    broadcastLobbyList();
  });

  socket.on('lobby:list', () => {
    socket.emit('lobby:list', lobbyManager.listLobbies());
  });

  // ---- GAME ----
  socket.on('game:play', ({ lobbyId, cardId, chosenColor, callUno }, cb) => {
    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || !lobby.game) return cb && cb({ ok: false, error: 'Partie introuvable' });
    const r = lobby.game.playCard(socket.id, cardId, { chosenColor, callUno });
    cb && cb(r);
    emitGameState(lobby);
    if (r.gameEnded) {
      io.to(lobby.id).emit('game:end', { winner: r.winner });
      // Mise à jour stats
      try {
        for (const p of lobby.game.players) {
          run('UPDATE users SET games_played = games_played + 1 WHERE id = ?', [p.userId]);
          if (p.username === r.winner) {
            run('UPDATE users SET games_won = games_won + 1 WHERE id = ?', [p.userId]);
          }
        }
      } catch (e) { console.error(e); }
    } else if (r.roundEnded) {
      io.to(lobby.id).emit('game:roundEnd', { winner: r.winner, points: r.points });
    }
  });

  socket.on('game:draw', ({ lobbyId }, cb) => {
    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || !lobby.game) return cb && cb({ ok: false, error: 'Partie introuvable' });
    const r = lobby.game.drawAction(socket.id);
    cb && cb(r);
    emitGameState(lobby);
  });

  socket.on('game:passAfterDraw', ({ lobbyId }, cb) => {
    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || !lobby.game) return cb && cb({ ok: false, error: 'Partie introuvable' });
    const r = lobby.game.passAfterDraw(socket.id);
    cb && cb(r);
    emitGameState(lobby);
  });

  socket.on('game:callUno', ({ lobbyId }, cb) => {
    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || !lobby.game) return cb && cb({ ok: false, error: 'Partie introuvable' });
    const r = lobby.game.callUno(socket.id);
    cb && cb(r);
    emitGameState(lobby);
  });

  socket.on('game:denounceUno', ({ lobbyId, targetId }, cb) => {
    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || !lobby.game) return cb && cb({ ok: false, error: 'Partie introuvable' });
    const r = lobby.game.denounceUno(socket.id, targetId);
    cb && cb(r);
    emitGameState(lobby);
  });

  socket.on('game:nextRound', ({ lobbyId }, cb) => {
    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || !lobby.game) return cb && cb({ ok: false, error: 'Partie introuvable' });
    const r = lobby.game.nextRound();
    cb && cb(r);
    emitGameState(lobby);
  });

  // ---- DECONNEXION ----
  socket.on('disconnect', () => {
    console.log('[SOCKET]', user.username, 'déconnecté');
    // Retirer des lobbies
    for (const lobby of lobbyManager.lobbies.values()) {
      if (lobby.players.find(p => p.id === socket.id)) {
        if (lobby.status === 'playing' && lobby.game) {
          // Marquer comme déconnecté pour permettre reconnexion future
          const p = lobby.game.players.find(pp => pp.id === socket.id);
          if (p) p.connected = false;
          io.to(lobby.id).emit('game:playerLeft', { username: user.username });
        } else {
          const r = lobbyManager.leaveLobby(lobby.id, socket.id);
          if (r && r.lobby) emitLobbyState(r.lobby);
        }
      }
    }
    broadcastLobbyList();
  });
});

server.listen(PORT, () => {
  console.log('===========================================');
  console.log(`  UNO Web - Serveur lancé sur le port ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log('===========================================');
});
