# AdSense Growth Master Plan — rrih.github.io

目標: **2026-12 までに Google AdSense 収益 月5万円** を達成する。

このドキュメントは人間・LLM（Claude Code / Codex / その他）のどれが読んでも同じ施策を実行できるように書かれている。週次の実行手順は `docs/growth/playbooks/` を参照。

## 1. KPIツリー

```
収益 (¥/月)
├── ページビュー (PV/月)
│   ├── 検索流入 = 表示回数 × CTR (Search Console)
│   │   ├── インデックス済みページ数（ツール＋ブログ記事）
│   │   ├── 検索順位（コンテンツ品質・内部リンク・CWV）
│   │   └── CTR（title/description 最適化）
│   └── 再訪問（PWA・ブックマーク・URL共有機能）
└── RPM (¥/1000PV)
    ├── 広告ユニット数と配置（実装済み: toolContent / blogArticle）
    ├── ページのトピック単価（金融・保険・税金系 > 汎用開発ツール系）
    └── 日本語ページ比率（日本語広告在庫とのマッチ）
```

前提値: 日本語ツールサイトの RPM を ¥150〜400 と想定。中央値 ¥250 で逆算すると **必要PVは月200,000**。

## 2. 月次マイルストーン

| 月 | PV目標 (28日) | 収益目標 | 主要施策 |
|---|---|---|---|
| 2026-06 | 3,000 | ¥0 | 広告ユニット稼働開始、計測自動化、ベースライン確定 |
| 2026-07 | 30,000 | ¥2,500 | 高CPCツール 2本追加、ブログ週2本開始 |
| 2026-08 | 50,000 | ¥7,500 | 既存ツールの日本語ページ展開（i18n基盤活用） |
| 2026-09 | 80,000 | ¥15,000 | 検索順位改善（リライト・内部リンク強化） |
| 2026-10 | 120,000 | ¥25,000 | 広告配置A/B（位置・数）、RPM最適化 |
| 2026-11 | 160,000 | ¥37,500 | 当たりページへの集中投資（関連ツール・記事追加） |
| 2026-12 | 200,000 | ¥50,000 | 達成確認・継続運用体制へ移行 |

数値は `scripts/growth/fetch-metrics.ts` の `KPI_TARGETS` と同期している。変更時は両方を更新すること。

## 3. 戦略の柱

### 柱A: RPM（即効・最優先）
1. **広告ユニットの実配置** — `src/components/ads/ad-unit.tsx` 実装済み。AdSense管理画面でユニット作成後、`src/config/ads.ts` にスロットIDを記入すれば全ツール＋ブログで配信開始（人間の作業、`OPERATIONS.md` 参照）。
2. **Auto ads の有効化** — AdSense 管理画面の設定のみで追加配信。コード変更不要。
3. **高単価トピックへの展開** — 失業保険シミュレーターの系譜を拡大（下記バックログ）。

### 柱B: PV — 高CPC日本語ツールの量産
日本語の「計算機・シミュレーター」系は検索需要が安定し、金融・保険・税クエリは広告単価が高い。投資計算機・失業保険シミュレーターの実装パターンを再利用する。

バックログ（検索ボリューム×単価で優先度順）:
1. 手取り計算機（年収→手取り、税金・社会保険料内訳）
2. 退職金税金計算機
3. 住宅ローンシミュレーター（繰上返済比較）
4. 残業代計算機
5. 児童手当・扶養控除計算機
6. ふるさと納税限度額計算機
7. 電気代計算機（家電別）
8. 育休給付金計算機

### 柱C: PV — コンテンツSEO
- ブログ週1〜2本。各ツールに対し「使い方」「ユースケース」「比較」記事を作り内部リンク。
- 既存英語ツールページの `/ja/` 展開（i18n基盤あり。homework-tracker が先行例）。
- Search Console の「表示回数多 × CTR低」クエリを毎週リライト対象にする（playbook参照）。

### 柱D: 技術基盤
- Core Web Vitals 維持（Lighthouse 95+、広告によるCLS悪化を `min-h` で抑制済み）。
- sitemap / 構造化データは自動生成済み。新ツール追加時は `src/config/tools.tsx` 登録を忘れない。

## 4. 自動化アーキテクチャ

```
GitHub Actions (.github/workflows/growth-metrics.yml, 毎週月曜 09:00 JST)
  └─ bun scripts/growth/fetch-metrics.ts
       ├─ Search Console API + GA4 Data API から28日分取得
       ├─ data/growth/metrics/*.json に保存（履歴）
       └─ data/growth/reports/*.md にレポート生成
  └─ レポートを本文にした GitHub Issue「Weekly growth review」を自動起票 (label: growth)
       └─ Codex（クラウドタスク/自動化）または Claude Code が Issue を拾い、
          docs/growth/playbooks/weekly-review.md に従って改善PRを作成 ← 自動改善ループ
```

追加の攻め筋:

```
GitHub Actions (.github/workflows/revenue-accelerator.yml, 毎日 10:00 JST)
  ├─ bun scripts/growth/fetch-metrics.ts（失敗時は直近snapshotで継続）
  ├─ bun scripts/growth/revenue-accelerator.ts
  │    ├─ 月5万円目標に対する収益ギャップを算出
  │    ├─ rrih.github.io 配下限定の高単価ツール候補を優先度付け
  │    └─ data/growth/accelerator/latest.{json,md} を生成
  ├─ Issue「Revenue accelerator control tower」へ最新レポートを追記
  └─ Growth Autopilot PR をdispatchし、低リスク内部リンク改善を自動投入
```

- `data/growth/opportunities.json` が rrih.github.io 内だけで攻める大型候補の機械可読バックログ。
- 高単価・計算ロジック付きツールは `automationMode: "draft-pr"` とし、Codex Automation がPR作成までは進めるが、最初は人間レビューを残す。
- 低リスクな既存ページ改善や内部リンク改善は allowlist 検証後に自動マージする。
- 認証情報セットアップ手順は `OPERATIONS.md` 参照。

## 5. リスクと対策

| リスク | 対策 |
|---|---|
| AdSenseポリシー違反（広告過多・コンテンツ薄） | ツールページは必須SEOセクション（About/HowTo/FAQ）を維持。広告は1ページ2枠まで |
| GitHub Pages の規約（商用利用の度合い） | ツール提供が主・広告が従の構成を維持 |
| RPMが想定下振れ（¥150未満） | PV目標を1.5倍に引き上げ、高CPCページ比率を上げる |
| 検索アルゴリズム変動 | 特定クエリ依存を避け、ツール30本・記事30本以上に分散 |
| 自動化の停止（API鍵失効等） | 週次Issueにデータ欠損が明記される。OPERATIONS.md の障害対応に従う |

## 6. 達成判定

毎月第1月曜の週次レビューで前月実績を確定。2ヶ月連続でPV目標の60%未満の場合、マイルストーン表とバックログ優先度を見直す（見直しもIssue化して記録する）。
