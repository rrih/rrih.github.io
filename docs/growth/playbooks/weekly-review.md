# Playbook: Weekly Growth Review

対象: AIエージェント（Claude Code / Codex / その他）または人間。週次の「Weekly growth review」Issue（label: `growth`）を起点に、データから改善アクションを導出して実装する。

## 入力

1. 最新の週次レポート: `data/growth/reports/` の最新日付ファイル（Issue 本文にも同内容）
2. メトリクス履歴: `data/growth/metrics/latest.json` と過去スナップショット
3. 計画: `docs/growth/MASTER_PLAN.md`（KPI目標・バックログ）
4. 収益記録: `data/growth/revenue.json`

## 手順

### Step 1: 状態判定
レポートの「KPI vs Target」を読み、次のいずれかに分類する。

- **(a) データ欠損**（NOT AVAILABLE がある）→ 改善実装はせず、Issue に「認証情報の再設定が必要。OPERATIONS.md 1-2 参照」とコメントして終了
- **(b) 目標達成ペース**（PV が当月目標の 80% 以上）→ Step 2 の「攻め」を実行
- **(c) 目標未達ペース**（80% 未満）→ Step 2 の「底上げ」を実行

### Step 2: 改善アクションの選択（最大3件）

**底上げ（未達時の優先順）:**
1. `src/config/ads.ts` のスロットIDが空のままなら、Issue に「広告ユニット作成が必要（OPERATIONS.md 1-1）」とコメント（人間タスク）
2. Search Console「Top queries」で **表示回数100以上 × CTR 3%未満** のクエリを特定し、該当ページの title / meta description / h1 をクエリ意図に合わせてリライト
3. 「Top pages」上位だが内部リンクが少ないページに、関連ツール・関連記事へのリンクを追加
4. `MASTER_PLAN.md` 柱B のバックログ先頭のツールを新規実装（`playbooks/seo-content.md` の新ツール手順に従う）

**攻め（達成ペース時の優先順）:**
1. PV上位ページの広告体験を確認し `playbooks/ad-optimization.md` を実行
2. PV上位ツールの関連ブログ記事を1本作成（`playbooks/seo-content.md`）
3. PV上位の英語ツールページを `/ja/` にローカライズ
4. バックログの次ツールを実装

### Step 3: 実装

- ブランチを切り、選択したアクションを実装する
- 必ず `bun run dev-check` を通す（型・lint・テスト・ビルド）
- CLAUDE.md / AGENTS.md のコーディング規約に従う（絵文字禁止、英語UI、#0066cc、44pxタッチターゲット）

### Step 4: 出力

- 改善PRを作成し、本文に対象Issueを `Closes #<番号>` で紐付ける
- PR本文に「選んだアクション・期待されるKPIインパクト・根拠にしたデータ」を記載する
- 実装しなかった残アクションは Issue にチェックリストとしてコメントする

## 判断に迷ったら

- 1PRは1テーマに絞る（リライトとツール新規実装を混ぜない）
- データが2週分未満で傾向が読めない場合は、バックログ消化（新ツール/記事）を選ぶ
- ポリシーリスク（広告過多・薄いコンテンツ）のある変更は提案だけにとどめ、人間の判断を仰ぐ
