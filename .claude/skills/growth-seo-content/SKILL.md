---
name: growth-seo-content
description: PV成長のためのコンテンツ制作。ブログ記事作成、高CPC計算機ツールの新規実装、既存ページのCTR/順位リライトを標準手順で行う。
---

# Growth SEO Content

`docs/growth/playbooks/seo-content.md` を実行するスキル。

## 手順

1. 依頼内容を A（ブログ記事）/ B（新ツール実装）/ C（リライト）に分類する。指定がなければ `data/growth/metrics/latest.json` と `docs/growth/MASTER_PLAN.md` 柱Bのバックログから判断する
2. `docs/growth/playbooks/seo-content.md` の該当セクションに厳密に従う
   - 新ツールは `src/app/tools/investment-calculator/page.tsx` のパターンと CLAUDE.md のツールテンプレートに準拠
   - `<AdUnit slot="toolContent" />` の配置と `src/config/tools.tsx` への登録を忘れない
   - 計算ロジックは `src/lib/` に分離し `test/` にユニットテストを書く
3. `bun run dev-check` を通してPR作成
