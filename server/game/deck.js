// Représentation d'une carte UNO :
// { id, color: 'rouge'|'vert'|'bleu'|'jaune'|'wild', value: '0'..'9'|'plus2'|'skip'|'reverse'|'wild'|'plus4' }

const COLORS = ['rouge', 'vert', 'bleu', 'jaune'];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function buildDeck() {
  const deck = [];
  for (const color of COLORS) {
    // Un seul 0 par couleur
    deck.push({ id: uid(), color, value: '0' });
    // Deux exemplaires de 1 à 9
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: uid(), color, value: String(n) });
      deck.push({ id: uid(), color, value: String(n) });
    }
    // Deux +2, deux Skip, deux Reverse par couleur
    for (let i = 0; i < 2; i++) {
      deck.push({ id: uid(), color, value: 'plus2' });
      deck.push({ id: uid(), color, value: 'skip' });
      deck.push({ id: uid(), color, value: 'reverse' });
    }
  }
  // 4 Joker (Change couleur) et 4 +4
  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid(), color: 'wild', value: 'wild' });
    deck.push({ id: uid(), color: 'wild', value: 'plus4' });
  }
  return deck;
}

// Mélange Fisher-Yates
function shuffle(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Valeur en points d'une carte (pour le calcul de fin de manche)
function cardPoints(card) {
  if (card.value === 'wild' || card.value === 'plus4') return 50;
  if (['plus2', 'skip', 'reverse'].includes(card.value)) return 20;
  return parseInt(card.value, 10);
}

// Vérifie si une carte peut être jouée sur la carte du dessus
function canPlay(card, top, currentColor) {
  // Wild et +4 toujours jouables
  if (card.color === 'wild') return true;
  // Couleur identique
  if (card.color === currentColor) return true;
  // Même valeur (numéro ou symbole) - mais seulement si le top n'est pas wild sans couleur
  if (top.value === card.value) return true;
  return false;
}

module.exports = { COLORS, buildDeck, shuffle, cardPoints, canPlay, uid };
