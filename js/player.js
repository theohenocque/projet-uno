import { deck } from './card.js';
import { piocherCarte } from './deck.js';

function joueur(nom) {
    return {
        nom: nom,
        main: []
    }
}

function piocherpourjoueur(joueur, deck) {
    const carte = piocherCarte(deck);
        joueur.main.push(carte);
}