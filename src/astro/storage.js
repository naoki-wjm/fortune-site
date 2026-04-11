/**
 * チャートデータの永続化（localStorage）
 *
 * astro-viewer と同じキー名・データ構造を使用。
 * ドメインが異なるためデータは独立するが、エクスポート/インポートで相互運用可能。
 */

const STORAGE_KEY = 'astro-viewer-charts';

let chartsData = null;

function defaultData() {
  return {
    version: 1,
    settings: {
      houseSystem: 'P',
      orbs: { natal: 5, transit: 1, synastry: 3 },
      optionalBodies: {
        chiron: false, lilith: false, ceres: false,
        pallas: false, juno: false, vesta: false,
      },
    },
    charts: [],
  };
}

export function loadCharts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    chartsData = raw ? JSON.parse(raw) : defaultData();
  } catch {
    chartsData = defaultData();
  }
  return chartsData;
}

function saveCharts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chartsData));
}

export function getSettings() {
  return chartsData?.settings || {};
}

export function updateSettings(partial) {
  Object.assign(chartsData.settings, partial);
  saveCharts();
}

export function addChart(chart) {
  chart.id = crypto.randomUUID();
  chart.createdAt = new Date().toISOString();
  chartsData.charts.push(chart);
  saveCharts();
}

export function removeChart(id) {
  chartsData.charts = chartsData.charts.filter(c => c.id !== id);
  saveCharts();
}

export function getChartList() {
  return chartsData?.charts || [];
}

export function getChartById(id) {
  return chartsData?.charts.find(c => c.id === id) || null;
}

export function exportData() {
  const blob = new Blob([JSON.stringify(chartsData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'astro-viewer-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importData() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) { resolve(false); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.version || !Array.isArray(data.charts)) {
          alert('無効なデータ形式です');
          resolve(false);
          return;
        }
        chartsData = data;
        if (!chartsData.settings) chartsData.settings = defaultData().settings;
        saveCharts();
        resolve(true);
      } catch {
        alert('ファイルの読み込みに失敗しました');
        resolve(false);
      }
    });
    input.click();
  });
}
