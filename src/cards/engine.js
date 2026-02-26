/**
 * Fisher-Yatesシャッフル
 */
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 飛び出し（ジャンプアウト）枚数を確率テーブルから決定
 * 0枚:92%, 1枚:6.5%, 2枚:3%, 3枚:1% → 合計102.5%なので正規化
 */
export function checkJumpOut() {
  const raw = [
    { count: 0, weight: 92 },
    { count: 1, weight: 6.5 },
    { count: 2, weight: 3 },
    { count: 3, weight: 1 },
  ];
  const total = raw.reduce((s, r) => s + r.weight, 0);
  const roll = Math.random() * total;
  let cumulative = 0;
  for (const r of raw) {
    cumulative += r.weight;
    if (roll < cumulative) return r.count;
  }
  return 0;
}

/**
 * カードに正逆を付与
 */
function assignReversed(card, deckHasReversed) {
  // ルーンは個別のhas_reversedフラグを持つ
  const cardHasReversed = card.has_reversed !== undefined ? card.has_reversed : deckHasReversed;
  const is_reversed = cardHasReversed ? Math.random() < 0.5 : false;
  return { ...card, is_reversed };
}

/**
 * デッキからカードをドローする
 * @param {object} deck - デッキデータ（cardsプロパティ含む）
 * @param {number} count - ドロー枚数
 * @param {number} jumpOutCount - 飛び出し枚数
 * @returns {{ jumpedCards: object[], drawnCards: object[] }}
 */
export function draw(deck, count, jumpOutCount = 0) {
  const deckReversed = deck.has_reversed === true;
  const shuffled = shuffle(deck.cards);

  // 飛び出しカード（先頭からjumpOutCount枚）
  const jumpedCards = shuffled.slice(0, jumpOutCount).map(c => assignReversed(c, deckReversed));

  // 残りからドロー
  const remaining = shuffled.slice(jumpOutCount);
  const drawnCards = remaining.slice(0, count).map(c => assignReversed(c, deckReversed));

  return { jumpedCards, drawnCards };
}
