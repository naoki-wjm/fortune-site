const STORAGE_KEY = 'fortune-site-authed';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isAuthenticated() {
  return sessionStorage.getItem(STORAGE_KEY) === 'true';
}

export async function authenticate(password) {
  const expected = import.meta.env.VITE_SITE_PASSWORD;
  if (!expected) {
    // パスワード未設定なら何でも通す（開発時）
    sessionStorage.setItem(STORAGE_KEY, 'true');
    return true;
  }
  // 平文比較（ハッシュは環境変数側で管理しない方針）
  if (password === expected) {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    return true;
  }
  return false;
}

export function getPassword() {
  // LLM APIリクエスト時の二重チェック用
  return sessionStorage.getItem('fortune-site-pw') || '';
}

export function storePassword(pw) {
  sessionStorage.setItem('fortune-site-pw', pw);
}
