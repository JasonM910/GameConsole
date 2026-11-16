export const SYMBOLS = ['★', '☀', '☂', '♥', '♞', '✿', '♫', '◆'];

export class MemoryCard {
  constructor({ id, symbol, matched = false }) { Object.assign(this, { id, symbol, matched }); }
}

export function makeCards(pairCount, random = Math.random) {
  const cards = SYMBOLS.slice(0, pairCount).flatMap((symbol, pair) => [
    new MemoryCard({ id: `C${pair * 2}`, symbol }), new MemoryCard({ id: `C${pair * 2 + 1}`, symbol }),
  ]);
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [cards[index], cards[next]] = [cards[next], cards[index]];
  }
  return cards;
}
