# Playbook: SEO Content Production

対象: AIエージェントまたは人間。PV成長のためのブログ記事作成・新ツール実装・リライトの標準手順。

## A. ブログ記事の作成

1. **テーマ選定**: 次の優先順で選ぶ
   - Search Console「Top queries」にあるが専用ページがないクエリ
   - 既存ツールの「使い方 / ユースケース / トラブルシュート」（内部リンク先になる）
   - `MASTER_PLAN.md` 柱Bの金融・保険・税金トピックの解説記事
2. **作成**: `content/blog/<slug>.mdx` を既存記事のfrontmatter形式に合わせて作成
   - 1,500語以上、見出し構造（h2/h3）、具体例・手順を含める
   - `relatedTools` に関連ツールを必ず設定（内部リンク）
   - 一次情報（制度・税率等）は公式ソースを確認し、年度を明記する
3. **ビルド確認**: `bun run build` でOG画像とsitemapが自動生成されることを確認
4. `bun run dev-check` を通してPR作成

## B. 新ツールの実装（高CPC計算機系）

1. `MASTER_PLAN.md` 柱Bのバックログ先頭から着手する
2. **実装パターンの踏襲**: `src/app/tools/investment-calculator/page.tsx`（計算機系の先行例）と CLAUDE.md「WEB TOOL DEVELOPMENT STANDARDS」のテンプレートに完全準拠する
   - Hero / Main Interface / Features / About / How to Use / Examples / FAQ(8問以上)
   - `useUrlSharing` による共有、localStorage 保存、クリア確認
   - `<AdUnit slot="toolContent" className="mb-8 sm:mb-12" />` をSEOコンテンツセクション直前に配置
3. **登録**: `src/config/tools.tsx` にツールを追加（sitemapは自動生成）
4. **計算ロジック**: `src/lib/<tool-name>/` に分離し、`test/` にユニットテストを追加（税率・境界値のテスト必須）
5. **法令データ**: 計算根拠（税率表・給付率等）はコード内に定数と出典コメントで明記し、年度更新しやすくする
6. `bun run dev-check` を通してPR作成

## C. 既存ページのリライト（CTR/順位改善）

1. `data/growth/metrics/latest.json` の `searchConsole.topQueries` から、表示回数が多いのにクリックが少ないクエリを特定
2. 該当ページの metadata（title / description）をクエリ意図に合わせて書き直す
   - title: 主要クエリを先頭付近に、32文字以内（日本語ページ）/ 60字以内（英語）
   - description: 行動喚起を含む 80〜120字（日本語）
3. 本文側: クエリに答える h2 セクションや FAQ 項目を追加
4. 順位10〜30位のページを優先（リライト効果が出やすい）
5. `bun run dev-check` を通してPR作成。PR本文に対象クエリと現状の表示回数/CTR/順位を記録する

## 共通の禁止事項

- 検索向けだけの薄いページ（doorway page）を作らない
- 制度・税務の断定的アドバイスを書かない（必ず「概算」「目安」と免責を明記）
- 絵文字・カスタム色・日本語UI（`/ja/` 以外）は使用しない
