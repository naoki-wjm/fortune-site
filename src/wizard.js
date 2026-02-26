/**
 * 画面遷移ユーティリティ
 */
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

/**
 * 戻るボタンのイベントを一括セットアップ
 */
export function setupBackButtons() {
  document.querySelectorAll('.back-btn[data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      showScreen(btn.dataset.back);
    });
  });
}
