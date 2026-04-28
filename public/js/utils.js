// Helpers DOM
const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

// Toasts
function toast(message, type = 'success', duration = 3000) {
  const container = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 200ms';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 200);
  }, duration);
}

// Storage helper (localStorage avec fallback en mémoire)
const Storage = {
  _fallback: {},
  get(key) {
    try { return localStorage.getItem(key); }
    catch { return this._fallback[key] || null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); }
    catch { this._fallback[key] = value; }
  },
  remove(key) {
    try { localStorage.removeItem(key); }
    catch { delete this._fallback[key]; }
  }
};

// Génère le chemin d'image pour une carte
function cardImagePath(card) {
  if (card.color === 'wild') {
    if (card.value === 'wild') return '/assets/cards/others/wild.png';
    if (card.value === 'plus4') return '/assets/cards/others/plus4.png';
  }
  // colors -> dossier
  const folderMap = { rouge: 'rouges', vert: 'verts', bleu: 'bleus', jaune: 'jaunes' };
  const folder = folderMap[card.color];
  // value -> nom de fichier
  let valuePart;
  if (['plus2', 'skip', 'reverse'].includes(card.value)) valuePart = card.value;
  else valuePart = card.value;
  return `/assets/cards/${folder}/${valuePart}_${card.color}.png`;
}

function colorLabel(color) {
  return { rouge: 'Rouge', jaune: 'Jaune', vert: 'Vert', bleu: 'Bleu', wild: 'Joker' }[color] || color;
}

function valueLabel(card) {
  if (card.value === 'wild') return 'Joker';
  if (card.value === 'plus4') return '+4';
  if (card.value === 'plus2') return '+2';
  if (card.value === 'skip') return 'Passer';
  if (card.value === 'reverse') return 'Inverser';
  return card.value;
}
