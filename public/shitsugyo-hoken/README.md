# 失業保険シミュレーター（/shitsugyo-hoken/）

雇用保険の基本手当（失業保険）の受給額・給付日数・受給スケジュールの目安を計算する、純静的なWebアプリです。ビルド不要・依存ゼロで、`public/` 配下に置くだけで Next.js の静的エクスポートにそのままコピーされ、`https://rrih.github.io/shitsugyo-hoken/` で公開されます。

## 構成

```
public/shitsugyo-hoken/
├── index.html            # シミュレーター本体（ツールファースト）
├── guide/index.html      # 申請の流れ・必要書類ガイド
├── nissu/index.html      # 所定給付日数の早見表
├── keisanshiki/index.html# 基本手当日額の計算式の詳細
├── faq/index.html        # FAQ 20問（FAQPage構造化データ）
├── about/index.html      # 運営者情報（noindex）
├── privacy/index.html    # プライバシーポリシー（noindex）
├── disclaimer/index.html # 免責事項（noindex）
├── sitemap.xml           # サブサイトマップ（ルートsitemapにも登録済み）
└── assets/
    ├── style.css         # 共通スタイル（ダークモード・印刷対応）
    ├── app.js            # 計算エンジン＋UI（URL同期・localStorage・共有）
    └── og.png            # OGP画像 1200x630
```

## 年次メンテナンス（毎年8月・最重要）

賃金日額の上限・下限、給付率の屈折点は**毎年8月1日に改定**されます。改定後にやること:

1. 厚労省のプレスリリース「雇用保険の基本手当日額の変更」を入手
   （例: https://www.mhlw.go.jp/stf/newpage_59748.html の後継ページ）
2. `assets/app.js` 冒頭の `RATES` 定数を更新
   - `validFrom` / `validTo` / `label`
   - `wageMin`（賃金日額下限）, `dailyMin`（基本手当日額下限）
   - `k1`, `k2`, `k2s`（給付率の屈折点）
   - `caps[]`（年齢区分別の賃金日額上限・基本手当日額上限）
3. `keisanshiki/index.html` の表と具体例、`index.html` の説明文中の上限額を更新
4. 各ページの「最終更新」日付と適用期間表記を更新
5. プレスリリースに記載の計算例（賃金日額6,000円/9,000円のケース）で検算

検算用のテストは `/tmp/fix-test.js`（作業ログ参照）の方式で、`dailyAllowance()` にプレスリリースの例を食わせて一致確認する。

## 法改正ウォッチ

- 給付制限（現在: 自己都合1か月、5年内3回以上で3か月）→ `restrictionMonths()`
- 所定給付日数表 → `DAYS_GENERAL` / `DAYS_SPECIFIC`
- 雇止め離職者を特定受給資格者並みの日数とする暫定措置（延長の有無を確認）

## 広告

- AdSense Auto ads（`ca-pub-6426570202991325`）を全ページ`<head>`で読み込み
- `ads.txt` はサイトルート（`public/ads.txt`）に設定済み
- 手動ユニットを足す場合は `.ad-slot` div にスロットコードを挿入し、`min-height` を実寸に合わせてCLSを防ぐ
