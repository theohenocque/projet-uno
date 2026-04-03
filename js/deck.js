import { deck } from './card.js';

function melangerDeck(deck) {
    for (let i = 0; i < deck.length; i++) {
        const randomIndex = Math.floor(Math.random() * deck.length)
        const temp = deck[i];
        deck[i] = deck[randomIndex];
        deck[randomIndex] = temp;
    }
}

function piocherCarte(deck) {
    return deck.pop();
}