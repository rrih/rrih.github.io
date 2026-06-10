---
name: growth-weekly-review
description: 週次成長レビューの実行。最新のWeekly growth review Issue（label growth）とメトリクスを読み、改善アクションを1〜3件選んで実装PRを作る。
---

# Growth Weekly Review

`docs/growth/playbooks/weekly-review.md` を実行するスキル。

## 手順

1. `gh issue list --label growth --state open --limit 1` で最新の週次Issueを取得して読む（なければ `bun scripts/growth/fetch-metrics.ts` でレポート生成）
2. `data/growth/metrics/latest.json` と `docs/growth/MASTER_PLAN.md` を読む
3. `docs/growth/playbooks/weekly-review.md` の Step 1〜4 に厳密に従う:
   - 状態判定（データ欠損 / 達成ペース / 未達ペース）
   - アクション選択（最大3件、1PRは1テーマ）
   - 実装 + `bun run dev-check`
   - PR作成（`Closes #<Issue番号>`、データ根拠を本文に記載）
4. 実施しなかった候補アクションはIssueにチェックリストでコメントする
