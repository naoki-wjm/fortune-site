import { getCities } from './engine.js';
import { getChartList } from './storage.js';

// 場所入力モード管理
const locModes = {};

/**
 * 都道府県＋市区町村セレクト＋緯度経度トグルを生成
 */
function createLocationFields(prefix, container) {
  const cities = getCities();
  const prefNames = Object.keys(cities);

  const html = `
    <div id="${prefix}-loc-select">
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
    </div>
    <div id="${prefix}-loc-coord" style="display:none">
      <div class="form-row-3">
        <div class="form-group">
          <label>緯度</label>
          <input type="number" id="${prefix}-lat" step="0.0001" placeholder="35.6762">
        </div>
        <div class="form-group">
          <label>経度</label>
          <input type="number" id="${prefix}-lng" step="0.0001" placeholder="139.6503">
        </div>
        <div class="form-group">
          <label>UTC差</label>
          <input type="number" id="${prefix}-tz" value="9" step="0.5">
        </div>
      </div>
    </div>
    <button type="button" class="loc-toggle-btn" id="${prefix}-loc-toggle">緯度経度で入力</button>
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

  // トグル
  locModes[prefix] = 'select';
  document.getElementById(`${prefix}-loc-toggle`).addEventListener('click', () => {
    toggleLocMode(prefix);
  });

  return { prefSelect, citySelect };
}

function toggleLocMode(prefix) {
  const btn = document.getElementById(`${prefix}-loc-toggle`);
  const selectEl = document.getElementById(`${prefix}-loc-select`);
  const coordEl = document.getElementById(`${prefix}-loc-coord`);
  if (locModes[prefix] === 'select') {
    locModes[prefix] = 'coord';
    selectEl.style.display = 'none';
    coordEl.style.display = '';
    btn.textContent = '都道府県に戻す';
  } else {
    locModes[prefix] = 'select';
    selectEl.style.display = '';
    coordEl.style.display = 'none';
    btn.textContent = '緯度経度で入力';
  }
}

/**
 * 生年月日＋出生時刻フィールド生成（時刻不明チェック付き）
 */
function createBirthFields(prefix, container, label = '') {
  const html = `
    ${label ? `<h3>${label}</h3>` : ''}
    <div class="form-row-3">
      <div class="form-group">
        <label>年</label>
        <input type="number" id="${prefix}-year" placeholder="1990" min="1900" max="2100">
      </div>
      <div class="form-group">
        <label>月</label>
        <input type="number" id="${prefix}-month" placeholder="1" min="1" max="12">
      </div>
      <div class="form-group">
        <label>日</label>
        <input type="number" id="${prefix}-day" placeholder="1" min="1" max="31">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>時</label>
        <input type="number" id="${prefix}-hour" placeholder="12" min="0" max="23">
      </div>
      <div class="form-group">
        <label>分</label>
        <input type="number" id="${prefix}-minute" placeholder="0" min="0" max="59">
      </div>
    </div>
    <label class="time-unknown-label">
      <input type="checkbox" id="${prefix}-time-unknown"> 出生時刻不明（12:00で計算）
    </label>
  `;
  container.insertAdjacentHTML('beforeend', html);

  // 時刻不明チェック
  const timeUnknown = document.getElementById(`${prefix}-time-unknown`);
  timeUnknown.addEventListener('change', (e) => {
    document.getElementById(`${prefix}-hour`).disabled = e.target.checked;
    document.getElementById(`${prefix}-minute`).disabled = e.target.checked;
  });
}

/**
 * 保存済みチャート選択セレクトを生成
 */
function createChartSelect(prefix, container, label = '保存済みチャートから入力') {
  const html = `
    <div class="form-group">
      <label>${label}</label>
      <select id="${prefix}-chart-select">
        <option value="">-- 手動で入力する --</option>
      </select>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);

  refreshChartSelect(prefix);

  document.getElementById(`${prefix}-chart-select`).addEventListener('change', (e) => {
    const chart = getChartList().find(c => c.id === e.target.value);
    if (chart) fillFormFromChart(chart, prefix);
  });
}

export function refreshAllChartSelects() {
  document.querySelectorAll('[id$="-chart-select"]').forEach(sel => {
    const prefix = sel.id.replace('-chart-select', '');
    refreshChartSelect(prefix);
  });
}

function refreshChartSelect(prefix) {
  const sel = document.getElementById(`${prefix}-chart-select`);
  if (!sel) return;
  const current = sel.value;
  const charts = getChartList();
  sel.innerHTML = '<option value="">-- 手動で入力する --</option>';
  for (const c of charts) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name || `${c.birthDate} ${c.birthTime || ''}`;
    sel.appendChild(opt);
  }
  sel.value = current;
}

function fillFormFromChart(chart, prefix) {
  const [y, mo, d] = chart.birthDate.split('-').map(Number);
  const [h, mi] = chart.birthTime ? chart.birthTime.split(':').map(Number) : [12, 0];
  const timeUnknown = !chart.birthTime;

  const yearEl = document.getElementById(`${prefix}-year`);
  if (yearEl) yearEl.value = y;
  const monthEl = document.getElementById(`${prefix}-month`);
  if (monthEl) monthEl.value = mo;
  const dayEl = document.getElementById(`${prefix}-day`);
  if (dayEl) dayEl.value = d;
  const hourEl = document.getElementById(`${prefix}-hour`);
  if (hourEl) { hourEl.value = h; hourEl.disabled = timeUnknown; }
  const minEl = document.getElementById(`${prefix}-minute`);
  if (minEl) { minEl.value = mi; minEl.disabled = timeUnknown; }
  const tuEl = document.getElementById(`${prefix}-time-unknown`);
  if (tuEl) tuEl.checked = timeUnknown;

  // 場所: 座標モードに切り替えてセット
  if (chart.location) {
    if (locModes[prefix] === 'select') toggleLocMode(prefix);
    const latEl = document.getElementById(`${prefix}-lat`);
    const lngEl = document.getElementById(`${prefix}-lng`);
    const tzEl = document.getElementById(`${prefix}-tz`);
    if (latEl) latEl.value = chart.location.lat;
    if (lngEl) lngEl.value = chart.location.lng;
    if (tzEl) tzEl.value = chart.location.utcOffset || 9;
  }
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

function getLocationValues(prefix) {
  if (locModes[prefix] === 'coord') {
    const lat = parseFloat(document.getElementById(`${prefix}-lat`)?.value);
    const lng = parseFloat(document.getElementById(`${prefix}-lng`)?.value);
    const tz = parseFloat(document.getElementById(`${prefix}-tz`)?.value);
    if (isNaN(lat) || isNaN(lng)) throw new Error('緯度・経度を入力してください');
    return { lat, lng, utcOffset: isNaN(tz) ? 9 : tz };
  }
  const prefEl = document.getElementById(`${prefix}-pref`);
  const cityEl = document.getElementById(`${prefix}-city`);
  return { pref: prefEl?.value, cityName: cityEl?.value };
}

function getValues(prefix) {
  const get = (id, fallback) => {
    const el = document.getElementById(`${prefix}-${id}`);
    if (!el) return null;
    if (el.tagName === 'SELECT') return el.value;
    const v = parseInt(el.value);
    if (isNaN(v)) {
      if (fallback !== undefined) return fallback;
      throw new Error(`${el.previousElementSibling?.textContent || id}を入力してください`);
    }
    return v;
  };

  const timeUnknownEl = document.getElementById(`${prefix}-time-unknown`);
  const timeUnknown = timeUnknownEl?.checked || false;

  const result = {
    year: get('year'), month: get('month'), day: get('day'),
    hour: timeUnknown ? 12 : get('hour', 12),
    minute: timeUnknown ? 0 : get('minute', 0),
  };

  // 場所
  if (locModes[prefix] === 'coord') {
    const lat = parseFloat(document.getElementById(`${prefix}-lat`)?.value);
    const lng = parseFloat(document.getElementById(`${prefix}-lng`)?.value);
    const tz = parseFloat(document.getElementById(`${prefix}-tz`)?.value);
    if (isNaN(lat) || isNaN(lng)) throw new Error('緯度・経度を入力してください');
    result.lat = lat;
    result.lng = lng;
    result.utcOffset = isNaN(tz) ? 9 : tz;
  } else {
    result.pref = get('pref');
    result.cityName = get('city');
  }

  return result;
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
      createChartSelect('natal', form);
      createBirthFields('natal', form);
      createLocationFields('natal', form);
      break;

    case 'synastry':
      createChartSelect('synA', form, 'Aさん（保存済みチャート）');
      createBirthFields('synA', form, 'Aさん（生年月日）');
      createLocationFields('synA', form);
      createChartSelect('synB', form, 'Bさん（保存済みチャート）');
      createBirthFields('synB', form, 'Bさん（生年月日）');
      createLocationFields('synB', form);
      break;

    case 'yearly':
      createChartSelect('yr-natal', form);
      createBirthFields('yr-natal', form, '生年月日');
      createLocationFields('yr-natal', form);
      createDateFields('yr-transit', form, { showDay: false, showMonth: false });
      break;

    case 'monthly':
      createChartSelect('lr-natal', form);
      createBirthFields('lr-natal', form, '生年月日');
      createLocationFields('lr-natal', form);
      form.insertAdjacentHTML('beforeend', '<h3>ルナリターン</h3>');
      createDateFields('lr-transit', form, { showDay: false });
      form.insertAdjacentHTML('beforeend', '<h3>ルナリターン計算地</h3>');
      createLocationFields('lr-loc', form);
      break;

    case 'daily':
      createChartSelect('tr-natal', form);
      createBirthFields('tr-natal', form, '生年月日');
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
      // ルナリターン計算地
      const loc = getLocationValues('lr-loc');
      return { type: 'monthly', natal, year, month, ...loc };
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

/**
 * 直近のネイタル入力情報を取得（保存用）
 */
export function getLastNatalValues(prefix) {
  try {
    return getValues(prefix);
  } catch {
    return null;
  }
}
