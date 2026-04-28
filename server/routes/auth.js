const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { run, get } = require('../db/database');
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS } = require('../config');

const router = express.Router();

// Validation simple du nom et mot de passe
function validateCredentials(username, password) {
  if (!username || typeof username !== 'string') return 'Nom d\'utilisateur requis';
  if (username.length < 3 || username.length > 20) return 'Le nom doit faire entre 3 et 20 caractères';
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Caractères autorisés : lettres, chiffres, _ et -';
  if (!password || typeof password !== 'string') return 'Mot de passe requis';
  if (password.length < 4) return 'Mot de passe trop court (4 caractères minimum)';
  return null;
}

// Inscription
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const err = validateCredentials(username, password);
    if (err) return res.status(400).json({ error: err });

    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hash]
    );

    const token = jwt.sign(
      { id: result.lastID, username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ token, user: { id: result.lastID, username } });
  } catch (e) {
    console.error('[AUTH] register:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        games_played: user.games_played,
        games_won: user.games_won
      }
    });
  } catch (e) {
    console.error('[AUTH] login:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Middleware de vérification du token (pour routes protégées si besoin)
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = auth.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// Profil
router.get('/me', authMiddleware, async (req, res) => {
  const user = await get(
    'SELECT id, username, games_played, games_won FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
});

module.exports = { router, authMiddleware };
