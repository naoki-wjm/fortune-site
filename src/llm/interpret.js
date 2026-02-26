import { getPassword } from '../auth.js';

/**
 * カード占いのプロンプトを組み立てる
 */
export function buildCardPrompt(deckName, spreadName, jumpedCards, drawnCards, positions) {
  let prompt = `あなたは優れた占い師です。以下のカード占いの結果を、温かく丁寧に解釈してください。\n\n`;
  prompt += `デッキ: ${deckName}\n`;
  prompt += `スプレッド: ${spreadName}\n\n`;

  if (jumpedCards.length > 0) {
    prompt += `【飛び出しカード】（シャッフル中に飛び出したカード。全体を補足するメッセージ）\n`;
    for (const card of jumpedCards) {
      prompt += formatCardForPrompt(card);
    }
    prompt += '\n';
  }

  prompt += `【スプレッド結果】\n`;
  drawnCards.forEach((card, i) => {
    prompt += `${positions[i]}: ${formatCardForPrompt(card)}`;
  });

  prompt += `\n各カードの意味と位置の関係を踏まえ、全体を統合した読み解きをお願いします。`;
  prompt += `占い結果は相談者に向けた「あなた」への語りかけの形でお願いします。`;
  return prompt;
}

function formatCardForPrompt(card) {
  const hasReversed = card.has_reversed !== undefined ? card.has_reversed : true;
  const direction = hasReversed ? (card.is_reversed ? '（逆位置）' : '（正位置）') : '';
  let meaning = card.meaning || (card.is_reversed ? card.meaning_reversed : card.meaning_upright) || '';
  const keyword = card.keyword ? ` [${card.keyword}]` : '';
  return `${card.name}${direction}${keyword}: ${meaning}\n`;
}

/**
 * 占星術のプロンプトを組み立てる
 */
export function buildAstroPrompt(resultText, astroType) {
  const typeLabels = {
    natal: '性格・人物像',
    synastry: '二人の相性',
    yearly: '年間の運勢',
    monthly: '今月の運勢',
    daily: '今日の運勢',
  };
  const label = typeLabels[astroType] || '運勢';

  let prompt = `あなたは優れた西洋占星術師です。以下の占星術の計算結果から、${label}を温かく丁寧に解釈してください。\n\n`;
  prompt += resultText;
  prompt += `\n\n天体の配置、アスペクト、ハウスの意味を総合的に読み解いてください。`;
  prompt += `占い結果は相談者に向けた「あなた」への語りかけの形でお願いします。`;
  return prompt;
}

/**
 * LLM解釈APIを呼び出す
 */
export async function requestInterpretation(prompt) {
  const password = getPassword();
  const res = await fetch('/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}
