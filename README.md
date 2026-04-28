# 🃏 UNO Web

Jeu de UNO multijoueur en ligne, réalisé en **JavaScript pur** (sans framework côté client) avec un backend Node.js.

> Projet réalisé dans le cadre d'un projet d'école — soutenance le 28 avril.

---

## 📋 Sommaire

- [Stack technique](#-stack-technique)
- [Fonctionnalités](#-fonctionnalités)
- [Installation](#-installation)
- [Lancement](#-lancement)
- [Parcours utilisateur](#-parcours-utilisateur)
- [Architecture du projet](#-architecture-du-projet)
- [Règles implémentées](#-règles-implémentées)

---

## 🛠 Stack technique

### Backend
- **Node.js** + **Express** : serveur HTTP et fichiers statiques
- **Socket.io** : communication temps réel via WebSocket
- **SQLite3** : base de données locale (un fichier `.sqlite`)
- **bcrypt** : chiffrement des mots de passe
- **jsonwebtoken (JWT)** : tokens d'authentification

### Frontend
- **HTML5 / CSS3 / JavaScript pur** : aucun framework
- **Socket.io client** (servi automatiquement par le serveur)
- Routage SPA fait maison (pushState API)

---

## ✨ Fonctionnalités

### 🔐 Authentification
- Page d'inscription / connexion avec formulaire à onglets
- Mots de passe hachés avec bcrypt
- Sessions persistantes via JWT (localStorage)
- Statistiques par joueur (parties jouées, parties gagnées)

### 🏠 Système de lobby
- Liste des salons en temps réel
- Création de salon (2 à 4 joueurs, nom personnalisé)
- Système "prêt / pas prêt" avant lancement
- Seul l'hôte peut lancer la partie quand tous sont prêts

### 🎮 Jeu UNO complet
- Distribution automatique de 7 cartes par joueur
- 108 cartes : 4 couleurs + cartes spéciales (+2, +4, Joker, Skip, Inversion)
- **Effets des cartes** :
  - **+2** : le joueur suivant pioche 2 cartes (chaînable avec un autre +2 → +4 cumulé)
  - **+4** : le joueur suivant pioche 4 cartes et passe son tour
  - **Joker** : permet de choisir la nouvelle couleur
  - **Skip (Passer)** : saute le tour du joueur suivant
  - **Reverse (Inversion)** : inverse le sens de jeu (= Skip à 2 joueurs)
- Choix de couleur via modal pour les cartes Joker / +4
- **Bouton "UNO!"** : à cliquer quand il reste 1 carte
- **Dénonciation UNO** : cliquer sur le badge UNO d'un adversaire qui a oublié → +2 cartes pour lui
- Calcul automatique des points en fin de manche
- Manches successives jusqu'à 500 points (paramétrable)
- Reshuffle automatique de la pioche depuis la défausse
- Gestion des déconnexions

### 🎨 Interface
- Design sombre, moderne, inspiré du style des cartes fournies
- Animations fluides (cartes qui flottent en home, hover des cartes en main, modals)
- Responsive (desktop + mobile)
- Indicateurs visuels : sens du jeu, couleur active, pioche restante, +X en attente
- Toasts pour les notifications

---

## 📦 Installation

### Prérequis
- Node.js v16 ou supérieur
- npm

### Étapes

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd uno-web

# 2. Installer les dépendances
npm install
```

> ⚠️ `bcrypt` et `sqlite3` sont des modules natifs : leur compilation peut prendre quelques minutes au premier `npm install`.

---

## 🚀 Lancement

```bash
npm start
```

Le serveur démarre sur **http://localhost:3000** (port modifiable via la variable d'environnement `PORT`).

```bash
PORT=8080 npm start   # autre port
```

La base SQLite est créée automatiquement au premier lancement dans `server/db/uno.sqlite`.

---

## 👤 Parcours utilisateur

1. **Page d'accueil** (`/`)
   Présentation du jeu et des fonctionnalités. Boutons **Jouer maintenant** / **Créer un compte**.

2. **Connexion / Inscription** (`/login`)
   Onglets "Connexion" et "Inscription". Validation côté serveur (bcrypt + JWT).

3. **Lobby** (`/lobby`)
   - Vue liste : voir tous les salons en attente, en créer un, en rejoindre un
   - Vue salon : voir les joueurs présents, se déclarer prêt, lancer la partie (hôte)

4. **Jeu** (`/game`)
   - Adversaires en haut (avec leur nombre de cartes et score)
   - Centre : pioche, défausse, indicateurs (couleur active, sens, etc.)
   - Ma main en bas (cartes jouables surlignées, non-jouables grisées)
   - Bouton **UNO!** quand il reste 1-2 cartes
   - Modal de choix de couleur pour Joker/+4
   - Modal de fin de manche avec scores

---

## 🗂 Architecture du projet

```
uno-web/
├── package.json
├── README.md
├── server/
│   ├── index.js              # Serveur Express + Socket.io
│   ├── config.js             # Configuration (port, JWT secret, etc.)
│   ├── routes/
│   │   └── auth.js           # Routes /api/auth/login, /register, /me
│   ├── game/
│   │   ├── deck.js           # Création/mélange du deck, valeurs
│   │   ├── Game.js           # Logique d'une partie (état, tours, règles)
│   │   └── LobbyManager.js   # Gestion des salons
│   └── db/
│       ├── database.js       # Helpers SQLite
│       └── uno.sqlite        # Base de données (créée au runtime)
└── public/
    ├── index.html            # SPA : toutes les vues dans un seul HTML
    ├── css/
    │   └── style.css         # Tout le style
    ├── js/
    │   ├── utils.js          # Helpers DOM, toasts, paths cartes
    │   ├── api.js            # Wrapper fetch
    │   ├── router.js         # Routeur SPA maison
    │   ├── auth.js           # Logique authentification
    │   ├── lobby.js          # Logique lobby
    │   ├── game.js           # Logique jeu (rendu)
    │   └── app.js            # Connexion Socket.io et démarrage
    └── assets/
        └── cards/
            ├── verts/        # 0-9, +2, skip, reverse en vert
            ├── bleus/
            ├── rouges/
            ├── jaunes/
            └── others/       # +4, wild, back (verso)
```

---

## 🎯 Règles implémentées

### Composition du deck (108 cartes)
- 4 couleurs × (1×0 + 2×1-9 + 2×+2 + 2×Skip + 2×Reverse) = **76 cartes colorées**
- 4× Joker (changement de couleur) + 4× +4 = **8 cartes noires**
- ...soit **108 cartes** au total ✅

### Règles de jeu
- ✅ Carte jouable = même couleur OU même valeur que la carte du dessus
- ✅ Joker / +4 jouables sur n'importe quelle carte
- ✅ +4 retourné en début de partie : replacé au hasard dans la pioche
- ✅ Skip retourné en début de partie : le 1er joueur passe son tour
- ✅ Reverse retourné en début de partie : on commence dans l'autre sens
- ✅ +2 retourné en début de partie : le 1er joueur pioche 2 cartes
- ✅ Chaînage des +2 (mais pas des +4)
- ✅ Si la pioche est vide, on remélange la défausse
- ✅ Bouton UNO + dénonciation avec pénalité de 2 cartes

### Points de fin de manche
- Cartes numérotées : valeur faciale (0-9)
- Skip / Reverse / +2 : 20 pts chacune
- Joker / +4 : 50 pts chacune
- Le gagnant additionne les points des cartes restantes des autres joueurs
- Partie terminée à **500 points**

---

## 👥 Équipe

> À compléter avec les noms du groupe.

## 📅 Soutenance

**28 avril** - Présentation orale (5 minutes minimum) sur l'organisation, les réalisations et les choix techniques.
