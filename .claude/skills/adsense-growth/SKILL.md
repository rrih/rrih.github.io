---
name: adsense-growth
description: AdSense収益成長プログラムのマスタースキル。週次レビューIssueやメトリクスから現状を判定し、適切なplaybookを選んで改善を実装する。「収益」「AdSense」「成長」「growth」関連の依頼で使用。
---

# AdSense Growth (Master)

rrih.github.io を2026-12までに月1万円のAdSense収益に到達させるプログラムの実行スキル。

## 手順

1. **現状把握**
   - `data/growth/metrics/latest.json` と `data/growth/reports/` の最新レポートを読む
   - 存在しない・古い場合: `bun scripts/growth/fetch-metrics.ts` を実行（要 `GOOGLE_APPLICATION_CREDENTIALS`。なければデータ欠損として扱う）
   - GitHub Issue（label: `growth`）の最新「Weekly growth review」も確認: `gh issue list --label growth --limit 3`

2. **計画との突合**
   - `docs/growth/MASTER_PLAN.md` の月次マイルストーンと実績を比較

3. **実行**
   - `docs/growth/playbooks/weekly-review.md` の手順（状態判定 → アクション選択 → 実装 → PR）に厳密に従う
   - 記事・新ツール作成は `docs/growth/playbooks/seo-content.md`
   - 広告配置調整は `docs/growth/playbooks/ad-optimization.md`

4. **品質ゲート**
   - 変更後は必ず `bun run dev-check` を通す
   - `DEVELOPMENT_HISTORY.md` を更新する

## 注意

- `src/config/ads.ts` のスロットIDが空の場合、広告は配信されていない。最優先で人間に広告ユニット作成（`docs/growth/OPERATIONS.md` 1-1）を依頼すること
- 広告は1ページ最大2枠。AdSenseポリシー（誤クリック誘導・薄いコンテンツ）に抵触する変更はしない
