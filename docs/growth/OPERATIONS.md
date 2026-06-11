# Growth Operations — 運用手順

`MASTER_PLAN.md` を実行に落とすための運用ドキュメント。人間にしかできない初期設定と、定常運用（ほぼ自動）を分けて記載する。

## 1. 初期設定（人間の作業・1回だけ）

### 1-1. AdSense 広告ユニット作成（最重要・これをしないと収益ゼロ）
1. https://adsense.google.com/ → 広告 → サマリー → 「広告ユニットごと」
2. 「ディスプレイ広告」を2つ作成: `tool-content`（スクエア）、`blog-article`（スクエア）
3. 発行された **スロットID（数字）** を `src/config/ads.ts` の `toolContent` / `blogArticle` に記入してコミット
4. 任意: 「サイトごと」→ 自動広告を ON（コード変更不要で追加配信）

### 1-2. Search Console / GA4 / AdSense の API アクセス

**推奨ルート（現在の本番運用）**: AdSense / Search Console / GA4 を管理できる Google ユーザーの OAuth authorized-user credential を GitHub Secret `GOOGLE_OAUTH_CREDENTIALS` に登録する。GitHub Actions では `GOOGLE_QUOTA_PROJECT_ID=ro1-dev` を付けて API を呼ぶ。

1. Google Cloud Console で プロジェクト作成（既存でも可）
2. 「Search Console API」「Google Analytics Data API」「AdSense Management API」を有効化
3. 管理ユーザーで OAuth credential を作成し、GitHub リポジトリ → Settings → Secrets and variables → Actions → `GOOGLE_OAUTH_CREDENTIALS` に JSON 全文を登録
4. `.github/workflows/growth-metrics.yml` の `GOOGLE_QUOTA_PROJECT_ID` に課金/クォータ用プロジェクトIDを設定

**サービスアカウントのフォールバック**:

- `GOOGLE_SERVICE_ACCOUNT_KEY` もスクリプト上は対応している
- ただし 2026-06-11 時点で、Search Console / GA4 の管理画面は `growth-metrics@ro1-dev.iam.gserviceaccount.com` の直接追加を拒否した
- 現在は OAuth 経路で GSC / GA4 / AdSense の取得が成功しているため、サービスアカウントの直接追加は必須ではない

### 1-3. 動作確認
- Actions タブ → 「Weekly Growth Metrics」→ Run workflow（手動実行）
- `data/growth/reports/` にレポートが生成され、Issue が起票されればOK
- ローカル確認: `GOOGLE_OAUTH_CREDENTIALS="$(cat ~/.config/gcloud/application_default_credentials.json)" GOOGLE_QUOTA_PROJECT_ID=ro1-dev bun scripts/growth/fetch-metrics.ts`

## 2. 定常運用

### 週次（自動 + AI実行）
1. 毎週月曜 09:00 JST に GitHub Actions がメトリクス取得・レポート生成・Issue起票（label: `growth`）
2. AIエージェント（Codex のクラウドタスク / Claude Code）が Issue を開き、`docs/growth/playbooks/weekly-review.md` に従い 1〜3件の改善PRを作成
   - Claude Code の場合: `/adsense-growth` スキルを実行
   - Codex の場合: 「label:growth の最新Issueを読み、docs/growth/playbooks/weekly-review.md に従って改善を実装して」と指示（AGENTS.md にも記載済み）
3. 人間はPRをレビュー・マージ（deploy.yml が自動デプロイ）

### 月次（自動 + 必要時のみ人間）
1. 通常は週次 workflow が AdSense API から前月と当月MTDの `rrih.github.io` 推定収益を `data/growth/revenue.json` に同期する
2. APIで取得できない場合だけ、AdSense ダッシュボードで前月の見積もり収益を確認し、`entries` に `{ "month": "YYYY-MM", "estimatedEarnings": <金額> }` を追記してコミット
3. 月次目標との乖離は次回の週次レポートに自動反映される

### 障害対応
- 週次レポートに「NOT AVAILABLE」が出た場合: `GOOGLE_OAUTH_CREDENTIALS` の失効、`GOOGLE_QUOTA_PROJECT_ID` の不足、または対象 Google プロダクト権限の剥奪を疑い、1-2 を再確認
- Issue が起票されない場合: Actions の実行ログを確認（cron はリポジトリが60日間更新なしだと停止する点に注意）

## 3. 品質ゲート（全変更共通）

- すべてのコード変更は `bun run dev-check` を通すこと（CLAUDE.md の規約）
- 広告は1ページ最大2枠。コンテンツの薄いページに広告を置かない（AdSenseポリシー）
- UI文言は英語（`/ja/` 配下の日本語ローカライズは除く）、絵文字禁止、Lucideアイコン使用、アクセントカラー #0066cc

## 4. 関連ファイル一覧

| パス | 役割 |
|---|---|
| `docs/growth/MASTER_PLAN.md` | 6ヶ月計画・KPI・バックログ |
| `docs/growth/playbooks/weekly-review.md` | 週次レビュー＆改善実行手順（LLM用） |
| `docs/growth/playbooks/seo-content.md` | 記事・新ツール作成手順（LLM用） |
| `docs/growth/playbooks/ad-optimization.md` | 広告配置最適化手順（LLM用） |
| `src/config/ads.ts` | 広告スロットID設定 |
| `src/components/ads/ad-unit.tsx` | 広告ユニットコンポーネント |
| `scripts/growth/fetch-metrics.ts` | GSC/GA4 取得スクリプト |
| `data/growth/metrics/` | メトリクス履歴（JSON） |
| `data/growth/reports/` | 週次レポート（Markdown） |
| `data/growth/revenue.json` | 月次収益の手動記録 |
| `.github/workflows/growth-metrics.yml` | 週次自動化 |
| `.claude/skills/adsense-growth/` ほか | Claude Code 用スキル（playbooks への入口） |
