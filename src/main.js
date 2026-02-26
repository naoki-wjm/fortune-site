import './style.css';
import { isAuthenticated, authenticate, storePassword } from './auth.js';
import { showScreen, setupBackButtons } from './wizard.js';
import { SPREADS } from './cards/spreads.js';
import { checkJumpOut, draw } from './cards/engine.js';
import { displayCards, generateResultText } from './cards/display.js';
import { initSweph, isReady, calcNatal, calcYearly, calcTransit, calcLunarReturn, calcSynastry } from './astro/engine.js';
import { buildAstroForm, getAstroInput } from './astro/wizard.js';
import { displayAstroResult } from './astro/display.js';
import { buildCardPrompt, buildAstroPrompt, requestInterpretation } from './llm/interpret.js';
import { marked } from 'marked';

import enigmaOracle from './data/enigma-oracle.json';
import skyOracle from './data/sky-oracle.json';
import tarotMajor from './data/tarot-major.json';
import runeFuthark from './data/rune-futhark.json';

const DECKS = [enigmaOracle, skyOracle, tarotMajor, runeFuthark];

// 現在の選択状態
let currentDeck = null;
let currentSpread = null;
let currentAstroType = null;
let natalData = null; // ネイタル計算結果のキャッシュ

function init() {
  if (isAuthenticated()) {
    showScreen('main-menu');
  }

  setupBackButtons();
  setupAuth();
  setupMainMenu();
  setupDeckSelect();
  setupResultActions();
  setupAstroMenu();
  setupAstroCalc();

  // sweph-wasmのバックグラウンド初期化
  initSweph().then(() => {
    const status = document.getElementById('astro-status');
    if (status) status.textContent = '準備完了';
  }).catch(err => {
    const status = document.getElementById('astro-status');
    if (status) status.textContent = `初期化エラー: ${err.message}`;
  });
}

function setupAuth() {
  const input = document.getElementById('password-input');
  const btn = document.getElementById('auth-submit');
  const error = document.getElementById('auth-error');

  async function doAuth() {
    const pw = input.value;
    const ok = await authenticate(pw);
    if (ok) {
      storePassword(pw);
      error.classList.add('hidden');
      showScreen('main-menu');
    } else {
      error.classList.remove('hidden');
      input.focus();
    }
  }

  btn.addEventListener('click', doAuth);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doAuth();
  });
}

function setupMainMenu() {
  document.querySelectorAll('.menu-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.type === 'card') {
        showScreen('deck-select');
      } else if (btn.dataset.type === 'astro') {
        const status = document.getElementById('astro-status');
        if (!isReady()) status.textContent = '初期化中...';
        showScreen('astro-menu');
      }
    });
  });
}

function setupDeckSelect() {
  const container = document.getElementById('deck-buttons');
  for (const deck of DECKS) {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.textContent = `${deck.name}（${deck.cards.length}枚）`;
    btn.addEventListener('click', () => {
      currentDeck = deck;
      document.getElementById('selected-deck-name').textContent = deck.name;
      renderSpreadButtons();
      showScreen('spread-select');
    });
    container.appendChild(btn);
  }
}

function renderSpreadButtons() {
  const container = document.getElementById('spread-buttons');
  container.innerHTML = '';
  const availableSpreads = SPREADS.filter(s => s.count <= currentDeck.cards.length);
  for (const spread of availableSpreads) {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.textContent = `${spread.name}（${spread.count}枚）`;
    btn.addEventListener('click', () => {
      currentSpread = spread;
      performCardReading();
    });
    container.appendChild(btn);
  }
}

function performCardReading() {
  const jumpOutCount = checkJumpOut();
  const maxJump = Math.min(jumpOutCount, currentDeck.cards.length - currentSpread.count);
  const safeJump = Math.max(0, maxJump);

  const { jumpedCards, drawnCards } = draw(currentDeck, currentSpread.count, safeJump);

  document.getElementById('result-meta').textContent = `${currentDeck.name} / ${currentSpread.name}`;

  const jumpSection = document.getElementById('jump-out-section');
  const jumpContainer = document.getElementById('jump-out-cards');
  if (jumpedCards.length > 0) {
    jumpSection.classList.remove('hidden');
    displayCards(jumpContainer, jumpedCards);
  } else {
    jumpSection.classList.add('hidden');
    jumpContainer.innerHTML = '';
  }

  displayCards(document.getElementById('spread-cards'), drawnCards, currentSpread.positions);

  const text = generateResultText(
    currentDeck.name, currentSpread.name,
    jumpedCards, drawnCards, currentSpread.positions
  );
  document.getElementById('result-text').value = text;

  // LLM解釈用にデータを保存
  window.__lastCardResult = { deckName: currentDeck.name, spreadName: currentSpread.name, jumpedCards, drawnCards, positions: currentSpread.positions };

  // 前回の解釈をリセット
  document.getElementById('interpretation').classList.add('hidden');
  document.getElementById('interpretation-text').innerHTML = '';

  showScreen('card-result');
}

function setupResultActions() {
  document.getElementById('copy-result').addEventListener('click', () => {
    const textarea = document.getElementById('result-text');
    navigator.clipboard.writeText(textarea.value).then(() => {
      const btn = document.getElementById('copy-result');
      btn.textContent = 'コピーしました';
      setTimeout(() => { btn.textContent = 'テキストをコピー'; }, 1500);
    });
  });

  document.getElementById('retry-btn').addEventListener('click', () => {
    if (currentDeck && currentSpread) performCardReading();
  });

  document.getElementById('copy-astro-result').addEventListener('click', () => {
    const textarea = document.getElementById('astro-result-text');
    navigator.clipboard.writeText(textarea.value).then(() => {
      const btn = document.getElementById('copy-astro-result');
      btn.textContent = 'コピーしました';
      setTimeout(() => { btn.textContent = 'テキストをコピー'; }, 1500);
    });
  });

  // LLM解釈ボタン（カード占い）— Opus / Sonnet 共通ハンドラ
  function setupCardInterpretBtn(btnId, model, modelLabel) {
    const btn = document.getElementById(btnId);
    const originalText = btn.textContent;
    btn.addEventListener('click', async () => {
      const data = window.__lastCardResult;
      if (!data) return;
      const prompt = buildCardPrompt(data.deckName, data.spreadName, data.jumpedCards, data.drawnCards, data.positions);
      document.querySelectorAll('#card-result .interpret-btn').forEach(b => b.disabled = true);
      btn.textContent = '解釈中...';
      btn.classList.add('loading');
      const interpEl = document.getElementById('interpretation');
      const textEl = document.getElementById('interpretation-text');
      document.getElementById('interpretation-model-label').textContent = `解釈（${modelLabel}）`;
      textEl.innerHTML = '';
      interpEl.classList.remove('hidden');
      try {
        await requestInterpretation(prompt, model, (fullText) => {
          textEl.innerHTML = marked.parse(fullText);
          textEl.scrollTop = textEl.scrollHeight;
        });
      } catch (err) {
        alert(`解釈エラー: ${err.message}`);
      } finally {
        document.querySelectorAll('#card-result .interpret-btn').forEach(b => b.disabled = false);
        btn.textContent = originalText;
        btn.classList.remove('loading');
      }
    });
  }
  setupCardInterpretBtn('interpret-opus-btn', 'claude-opus-4-6', 'Opus');
  setupCardInterpretBtn('interpret-sonnet-btn', 'claude-sonnet-4-6', 'Sonnet');

  // 解釈コピー（カード）
  document.getElementById('copy-interpretation').addEventListener('click', () => {
    const text = document.getElementById('interpretation-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-interpretation');
      btn.textContent = 'コピーしました';
      setTimeout(() => { btn.textContent = '解釈をコピー'; }, 1500);
    });
  });

  // LLM解釈ボタン（占星術）— Opus / Sonnet 共通ハンドラ
  function setupAstroInterpretBtn(btnId, model, modelLabel) {
    const btn = document.getElementById(btnId);
    const originalText = btn.textContent;
    btn.addEventListener('click', async () => {
      const data = window.__lastAstroResult;
      if (!data) return;
      const prompt = buildAstroPrompt(data.text, data.type);
      document.querySelectorAll('#astro-result .interpret-btn').forEach(b => b.disabled = true);
      btn.textContent = '解釈中...';
      btn.classList.add('loading');
      const interpEl = document.getElementById('astro-interpretation');
      const textEl = document.getElementById('astro-interpretation-text');
      document.getElementById('astro-interpretation-model-label').textContent = `解釈（${modelLabel}）`;
      textEl.innerHTML = '';
      interpEl.classList.remove('hidden');
      try {
        await requestInterpretation(prompt, model, (fullText) => {
          textEl.innerHTML = marked.parse(fullText);
          textEl.scrollTop = textEl.scrollHeight;
        });
      } catch (err) {
        alert(`解釈エラー: ${err.message}`);
      } finally {
        document.querySelectorAll('#astro-result .interpret-btn').forEach(b => b.disabled = false);
        btn.textContent = originalText;
        btn.classList.remove('loading');
      }
    });
  }
  setupAstroInterpretBtn('interpret-astro-opus-btn', 'claude-opus-4-6', 'Opus');
  setupAstroInterpretBtn('interpret-astro-sonnet-btn', 'claude-sonnet-4-6', 'Sonnet');

  // 解釈コピー（占星術）
  document.getElementById('copy-astro-interpretation').addEventListener('click', () => {
    const text = document.getElementById('astro-interpretation-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-astro-interpretation');
      btn.textContent = 'コピーしました';
      setTimeout(() => { btn.textContent = '解釈をコピー'; }, 1500);
    });
  });
}

// --- 占星術 ---

function setupAstroMenu() {
  document.querySelectorAll('.astro-btn[data-astro]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isReady()) {
        alert('占星術エンジンの初期化中です。少々お待ちください。');
        return;
      }
      currentAstroType = btn.dataset.astro;
      buildAstroForm(currentAstroType);
      showScreen('astro-input');
    });
  });
}

function setupAstroCalc() {
  document.getElementById('astro-calc-btn').addEventListener('click', () => {
    try {
      const input = getAstroInput(currentAstroType);
      let resultText = '';

      switch (input.type) {
        case 'natal': {
          const result = calcNatal(input);
          natalData = result;
          resultText = result.output;
          break;
        }
        case 'synastry': {
          const result = calcSynastry(input);
          resultText = result.output;
          break;
        }
        case 'yearly': {
          // まずネイタル計算
          const natal = calcNatal(input.natal);
          natalData = natal;
          resultText = calcYearly({
            year: input.year,
            natalPositions: natal.positions,
            natalAngles: natal.angles,
          });
          break;
        }
        case 'monthly': {
          const natal = calcNatal(input.natal);
          natalData = natal;
          resultText = calcLunarReturn({
            year: input.year,
            month: input.month,
            pref: input.pref,
            cityName: input.cityName,
            natalPositions: natal.positions,
            natalAngles: natal.angles,
          });
          break;
        }
        case 'daily': {
          const natal = calcNatal(input.natal);
          natalData = natal;
          resultText = calcTransit({
            year: input.year,
            month: input.month,
            day: input.day,
            natalPositions: natal.positions,
            natalAngles: natal.angles,
          });
          break;
        }
      }

      displayAstroResult(resultText);
      window.__lastAstroResult = { text: resultText, type: currentAstroType };

      // 前回の解釈をリセット
      document.getElementById('astro-interpretation').classList.add('hidden');
      document.getElementById('astro-interpretation-text').innerHTML = '';

      showScreen('astro-result');
    } catch (err) {
      alert(`計算エラー: ${err.message}`);
    }
  });
}

init();
