# fortune-site

パスワード保護つきの個人用総合占いサイト。カード占いと西洋占星術を備え、結果を Claude に解釈してもらえます。

## 機能

- **カード占い** — タロット大アルカナ／ルーン（Futhark）／エニグマ・オラクル／スカイ・オラクルの4デッキ。スプレッド・正逆位置・飛び出しカードに対応
- **西洋占星術** — Swiss Ephemeris による計算。ネイタル／シナストリー／年運／月運（ルナリターン）／日運。小惑星（キロン・リリス・セレス・パラス・ジュノー・ヴェスタ）オプションあり
- **AI 解釈** — 引いた結果を Claude にストリーミングで解釈依頼（`api/interpret.js` の Vercel Function 経由）
- チャートは localStorage に保存、JSON でエクスポート／インポート可（[astro-tool](https://github.com/naoki-wjm/astro-tool) とデータ互換）

## 技術

- Vanilla JS（ESM）＋ Vite 7、フレームワーク非依存
- [sweph-wasm](https://github.com/ptprashanttripathi/sweph-wasm)（Swiss Ephemeris の WASM 版）
- `@anthropic-ai/sdk`（AI 解釈）／ `marked`（Markdown 表示）
- デプロイ先は Vercel

## 開発

```bash
npm install
npm run dev      # 開発サーバー（/api/interpret は動かない）
npm run build    # dist/ へビルド
```

`/api/interpret` は Vercel Functions のため、ローカルで試すには `vercel dev` 相当が必要です。

環境変数（`.env` は非コミット）:

- `VITE_SITE_PASSWORD` — サイト入場パスワード（フロント側）
- `SITE_PASSWORD` — API 側の再検証用
- `ANTHROPIC_API_KEY` — Claude API キー

## ライセンス

[AGPL-3.0](./LICENSE)

Swiss Ephemeris を利用しているため、本プロジェクトも AGPL-3.0 で公開しています。
