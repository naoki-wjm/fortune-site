/**
 * カード1枚分のHTML生成
 */
function renderCard(card, position = null) {
  const reversed = card.is_reversed;
  const reversedLabel = reversed ? '（逆位置）' : '（正位置）';

  // 意味の取得
  let meaning = '';
  if (card.meaning) {
    // 正逆なしカード
    meaning = card.meaning;
  } else if (reversed && card.meaning_reversed) {
    meaning = card.meaning_reversed;
  } else if (card.meaning_upright) {
    meaning = card.meaning_upright;
  }

  // キーワード（ルーン用）
  const keyword = card.keyword ? `<div class="card-keyword">${card.keyword}</div>` : '';

  // 正逆表示（正逆なしの場合は表示しない）
  const hasReversed = card.has_reversed !== undefined ? card.has_reversed : true;
  const directionLabel = hasReversed ? `<span class="${reversed ? 'reversed' : ''}">${reversedLabel}</span>` : '';

  return `
    <div class="card-item">
      ${position ? `<div class="position">${position}</div>` : ''}
      <div class="card-name">${card.name} ${directionLabel}</div>
      ${keyword}
      <div class="card-meaning">${meaning}</div>
    </div>
  `;
}

/**
 * カード結果をDOMに表示
 */
export function displayCards(container, cards, positions = null) {
  container.innerHTML = cards.map((card, i) => {
    const pos = positions ? positions[i] : null;
    return renderCard(card, pos);
  }).join('');
}

/**
 * テキスト形式の結果を生成（コピー用）
 */
export function generateResultText(deckName, spreadName, jumpedCards, drawnCards, positions) {
  let text = `【${deckName}】${spreadName}\n\n`;

  if (jumpedCards.length > 0) {
    text += `■ 飛び出しカード\n`;
    for (const card of jumpedCards) {
      text += formatCardText(card);
    }
    text += '\n';
  }

  text += `■ スプレッド\n`;
  drawnCards.forEach((card, i) => {
    const pos = positions[i];
    text += `${pos}: ${formatCardText(card)}`;
  });

  return text;
}

function formatCardText(card) {
  const hasReversed = card.has_reversed !== undefined ? card.has_reversed : true;
  const direction = hasReversed ? (card.is_reversed ? '（逆位置）' : '（正位置）') : '';

  let meaning = '';
  if (card.meaning) {
    meaning = card.meaning;
  } else if (card.is_reversed && card.meaning_reversed) {
    meaning = card.meaning_reversed;
  } else if (card.meaning_upright) {
    meaning = card.meaning_upright;
  }

  const keyword = card.keyword ? ` [${card.keyword}]` : '';
  return `${card.name}${direction}${keyword} — ${meaning}\n`;
}
