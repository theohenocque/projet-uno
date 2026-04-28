# UNO Web

Projet de jeu UNO multijoueur en ligne réalisé en JavaScript avec Node.js et Socket.io.

## Fonctionnalités

- Inscription / connexion
- Création et gestion de salons
- Parties multijoueurs en temps réel
- Règles principales de UNO :
  - +2 / +4
  - Skip
  - Reverse
  - Joker
  - Bouton UNO
- Système de score

## Stack utilisée

- Front : HTML, CSS, JavaScript
- Back : Node.js, Express, Socket.io
- Base de données : SQLite

## Installation

Cloner le projet :

```bash
git clone <repo>
cd projet-uno
```

Installer les dépendances :

```bash
npm install
```

Lancer le serveur :

```bash
npm start
```

Puis ouvrir :

```bash
http://localhost:3000
```

## Structure

```bash
server/     # backend et logique du jeu
public/     # interface utilisateur
db/         # base SQLite
```

## Objectif du projet

Projet réalisé dans le cadre d’un projet d’école pour mettre en pratique :

- le temps réel avec Socket.io  
- la logique de jeu côté serveur  
- l’authentification  
- le développement full stack en JavaScript