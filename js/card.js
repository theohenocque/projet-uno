const couleur = ['bleu', 'rouge', 'vert', 'jaune']

const valeur = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', '+2', 'reverse']

const deck = []

for (let i = 0; i < couleur.length; i++) {
    for (let j = 0; j < valeur.length; j++) {
        const card = {
            couleur : couleur[i],
            valeur : valeur[j]
        }
        deck.push(card)
    }
}