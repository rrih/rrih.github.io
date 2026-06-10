---
name: growth-ad-optimization
description: AdSense広告配置の最適化。RPM改善のための広告ユニット追加・移動・分割を、ポリシーガードレール内で1変更ずつ実施する。
---

# Growth Ad Optimization

`docs/growth/playbooks/ad-optimization.md` を実行するスキル。

## 手順

1. `src/config/ads.ts` を確認。スロットIDが空なら配置最適化は不可能 — 人間タスク（`docs/growth/OPERATIONS.md` 1-1）として報告して終了
2. `data/growth/revenue.json` と `data/growth/metrics/latest.json` からRPMベースラインを計算する
3. `docs/growth/playbooks/ad-optimization.md` の改善候補を上から1つだけ選んで実装する（同時に複数変更しない）
4. ガードレール厳守: 1ページ最大2枠、操作UIとの間隔24px以上、固定オーバーレイ禁止、`min-h` によるCLS対策維持
5. `bun run dev-check` を通してPR作成。変更内容と比較開始日をPRとIssueに記録する
