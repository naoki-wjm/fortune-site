import { getCities } from './engine.js';

/**
 * 都道府県＋市区町村セレクトを生成するヘルパー
 */
function createLocationFields(prefix, container) {
  const cities = getCities();
  const prefNames = Object.keys(cities);

  const html = `
    <div class="form-row">
      <div class="form-group">
        <label>都道府県</label>
        <select id="${prefix}-pref">${prefNames.map(p => `<option value="${p}">${p}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>市区町村</label>
        <select id="${prefix}-city"></select>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);

  const prefSelect = document.getElementById(`${prefix}-pref`);
  const citySelect = document.getElementById(`${prefix}-city`);

  function updateCities() {
    citySelect.innerHTML = '';
    for (const city of cities[prefSelect.value]) {
      const opt = document.createElement('option');
      opt.value = city.name;
      opt.textContent = city.name;
      citySelect.appendChild(opt);
    }
  }

  prefSelect.addEventListener('change', updateCities);
  updateCities();

  return { prefSelect, citySelect };
}

/**
 * 生年月日＋出生時刻フィールド生成
 */
function createBirthFields(prefix, container, label = '') {
  const now = new Date();
  const html = `
    ${label ? `<h3>${label}</h3>` : ''}
    <div class="form-row-3">
      <div class="form-group">
        <label>年</label>
        <input type="number" id="${prefix}-year" value="1990" min="1900" max="2100">
      </div>
      <div class="form-group">
        <label>月</label>
        <input type="number" id="${prefix}-month" value="1" min="1" max="12">
      </div>
      <div class="form-group">
        <label>日</label>
        <input type="number" id="${prefix}-day" value="1" min="1" max="31">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>時</label>
        <input type="number" id="${prefix}-hour" value="12" min="0" max="23">
      </div>
      <div class="form-group">
        <label>分</label>
        <input type="number" id="${prefix}-minute" value="0" min="0" max="59">
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

/**
 * 日付フィールド生成（トランジット/ルナリターン用）
 */
function createDateFields(prefix, container, { showDay = true, showMonth = true } = {}) {
  const now = new Date();
  let html = '<div class="form-row-3">';
  html += `<div class="form-group"><label>年</label><input type="number" id="${prefix}-year" value="${now.getFullYear()}" min="1900" max="2100"></div>`;
  if (showMonth) html += `<div class="form-group"><label>月</label><input type="number" id="${prefix}-month" value="${now.getMonth() + 1}" min="1" max="12"></div>`;
  if (showDay) html += `<div class="form-group"><label>日</label><input type="number" id="${prefix}-day" value="${now.getDate()}" min="1" max="31"></div>`;
  html += '</div>';
  container.insertAdjacentHTML('beforeend', html);
}

function getValues(prefix) {
  const get = id => {
    const el = document.getElementById(`${prefix}-${id}`);
    return el ? (el.tagName === 'SELECT' ? el.value : parseInt(el.value)) : null;
  };
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour'), minute: get('minute'),
    pref: get('pref'), cityName: get('city'),
  };
}

/**
 * 占星術タイプごとのフォームを生成
 */
export function buildAstroForm(astroType) {
  const form = document.getElementById('astro-input-form');
  form.innerHTML = '';

  const titles = {
    natal: '性格（ネイタル）',
    synastry: '相性（シナストリー）',
    yearly: '年運',
    monthly: '月運（ルナリターン）',
    daily: '日運（トランジット）',
  };
  document.getElementById('astro-input-title').textContent = titles[astroType] || '';

  switch (astroType) {
    case 'natal':
      createBirthFields('natal', form);
      createLocationFields('natal', form);
      break;

    case 'synastry':
      createBirthFields('synA', form, 'Aさん');
      createLocationFields('synA', form);
      createBirthFields('synB', form, 'Bさん');
      createLocationFields('synB', form);
      break;

    case 'yearly':
      form.insertAdjacentHTML('beforeend', '<p>まずネイタルを入力してください</p>');
      createBirthFields('yr-natal', form, 'ネイタル');
      createLocationFields('yr-natal', form);
      createDateFields('yr-transit', form, { showDay: false, showMonth: false });
      break;

    case 'monthly':
      form.insertAdjacentHTML('beforeend', '<p>まずネイタルを入力してください</p>');
      createBirthFields('lr-natal', form, 'ネイタル');
      createLocationFields('lr-natal', form);
      form.insertAdjacentHTML('beforeend', '<h3>ルナリターン</h3>');
      createDateFields('lr-transit', form, { showDay: false });
      form.insertAdjacentHTML('beforeend', '<h3>ルナリターン計算地</h3>');
      createLocationFields('lr-loc', form);
      break;

    case 'daily':
      form.insertAdjacentHTML('beforeend', '<p>まずネイタルを入力してください</p>');
      createBirthFields('tr-natal', form, 'ネイタル');
      createLocationFields('tr-natal', form);
      form.insertAdjacentHTML('beforeend', '<h3>トランジット日</h3>');
      createDateFields('tr-transit', form);
      break;
  }
}

/**
 * フォームから入力値を取得
 */
export function getAstroInput(astroType) {
  switch (astroType) {
    case 'natal':
      return { type: 'natal', ...getValues('natal') };

    case 'synastry':
      return {
        type: 'synastry',
        a: getValues('synA'),
        b: getValues('synB'),
      };

    case 'yearly': {
      const natal = getValues('yr-natal');
      const transitYear = document.getElementById('yr-transit-year').value;
      return { type: 'yearly', natal, year: parseInt(transitYear) };
    }

    case 'monthly': {
      const natal = getValues('lr-natal');
      const year = parseInt(document.getElementById('lr-transit-year').value);
      const month = parseInt(document.getElementById('lr-transit-month').value);
      const pref = document.getElementById('lr-loc-pref').value;
      const cityName = document.getElementById('lr-loc-city').value;
      return { type: 'monthly', natal, year, month, pref, cityName };
    }

    case 'daily': {
      const natal = getValues('tr-natal');
      const year = parseInt(document.getElementById('tr-transit-year').value);
      const month = parseInt(document.getElementById('tr-transit-month').value);
      const day = parseInt(document.getElementById('tr-transit-day').value);
      return { type: 'daily', natal, year, month, day };
    }
  }
}
