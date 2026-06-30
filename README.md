# Spinopelvic Analyzer (Web)

Spinopelvic parameters (**PI / PT / SS / LL / SVA**) を計測するローカルWebアプリ。
単一の `index.html` だけで動作し、**ダウンロードしてダブルクリックで起動**できます。
画像は端末外に送信されず、すべてブラウザ内で処理されます（Research use only）。

**🔗 オンライン版: https://masaki39.net/spinopelvic-web/**
（ブラウザ上で開いても画像はアップロードされず、端末内でのみ処理されます）

## 使い方

1. `index.html` をダブルクリックして開く（Google Chrome 推奨）。
2. **画像を開く (O)** で X 線画像を選択（複数選択・フォルダのドラッグ&ドロップ可）。
3. 表示される指示に従い、クリックでランドマークを配置：
   左大腿骨頭中心 → 右大腿骨頭中心 → S1前/後縁 → L1前/後縁。
   配置後、**矢印キーで微調整**（⇧=5px, ⌥=0.2px）。
4. 4点+大腿骨頭が揃うと右パネルに **PI / PT / SS / LL** が表示されます。
5. **C** で C7 前/後縁を追加すると **SVA** を算出（mm 換算は **S** のスケール校正後）。
6. **Enter（=記録して次へ）** で結果を蓄積し、次の画像へ自動で進みます。
7. **D** で蓄積した全結果を 1 つの CSV（UTF-8 BOM 付き）に保存。

## ホットキー

| キー | 動作 | キー | 動作 |
|---|---|---|---|
| `O` | 画像を開く | `R` / `⇧R` | 右 / 左 90°回転 |
| `F` | 左右反転 | `S` | スケール校正 |
| クリック | ランドマーク配置 | ドラッグ | 点の移動 / 余白でパン |
| 矢印 | 選択点を微調整 (1px) | `⇧`/`⌥`+矢印 | 5px / 0.2px |
| `Z` / `⌫` | 直前の点を取消 | `C` | C7 入力（SVA） |
| `Enter` / `E` | 記録して次の画像へ | `N` / `P` | 次 / 前の画像 |
| `D` | 蓄積 CSV を保存 | `+` `-` `0` | ズーム / フィット |
| ホイール | カーソル位置でズーム | `?` | ヘルプ表示 |

## エクスポート方式

- **蓄積→一括保存**（既定）: `Enter` で各画像の結果をメモリに蓄積し、`D` で 1 CSV にまとめて保存。
- **バッチ自動遷移**: `Enter` で記録後、自動的に次の画像へ。
- **1枚ごとDL**: ツールバーの「1枚ごとDL」を ON にすると、記録ごとに CSV 行＋注釈 PNG を都度ダウンロード。
- **スケール維持**: 「スケール維持」を ON にすると、同一倍率で撮影したバッチで、一度校正したスケールを次の画像へ自動で引き継ぎます。

同じ画像を再度 `Enter` で記録すると行が**置き換え**られ（重複しません）、配置済みで未記録のまま別画像へ移動しようとすると確認が出ます。

## CSV 列

`patient_id, image_name, saved_at, PI_deg, PT_deg, SS_deg, LL_deg, SVA_px, SVA_mm,
scale_px_per_mm, scale_real_mm, scale_p1_x..p2_y, left/right_femoral_x/y,
common_femoral_radius, S1/L1/C7 の anterior/posterior x/y`（旧 Flutter 版と互換、1 画像 = 1 行）。

## 計測定義

- **PI**: S1 終板の垂線と寛骨臼軸線（S1中点→寛骨臼軸中点）の鋭角
- **PT**: 寛骨臼軸線と鉛直線の鋭角
- **SS**: S1 終板と水平線の鋭角
- **LL**: L1 終板と S1 終板の Cobb 角
- **SVA**: C7 中点と S1 後縁の水平距離（px、スケール校正で mm）

計測式は既存 Flutter 版（`spinopelvic_app/lib/main.dart`）と同一です。
ブラウザのコンソールで `runSelfTest()` を実行すると、既知ケースで式の妥当性を検証できます。

## 動作環境

- 推奨: Google Chrome / Microsoft Edge（最新）。
- `file://`（ダウンロードしてダブルクリック）でも全機能が動作します。サーバー不要。

## 開発（ソースの分割管理 / ビルド）

ソースは [Vite](https://vite.dev/) で `src/` 配下に分割管理し、配布用に
**単一の `index.html`** へインライン化してビルドします（[vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)）。

```bash
npm install      # 依存をインストール
npm run dev      # 開発サーバ（HMR）
npm run build    # src/ をビルドし、単一ファイルをリポジトリ直下の index.html に出力
```

| ファイル | 役割 |
|---|---|
| `src/index.html` | 画面のマークアップ（テンプレート） |
| `src/style.css` | スタイル |
| `src/geometry.js` | 幾何ユーティリティ（純粋関数） |
| `src/preset.js` | 計測定義（ランドマーク・計測式・CSV スキーマ） |
| `src/state.js` | アプリ状態と DOM 参照 |
| `src/render.js` | キャンバス描画・ビュー変換 |
| `src/app.js` | 画像入出力・計測・UI・イベント配線 |
| `src/main.js` | エントリ（CSS と app を読み込む） |

ビルド成果物のルート `index.html` が、GitHub Pages 配信物・ローカル配布物・
「ローカル版ダウンロード」の実体を兼ねます。`npm run build` 後にコミットしてください。

## ライセンス / 謝辞

- 本アプリは **Apache License 2.0** で公開しています（[LICENSE](LICENSE)）。
- 計測ロジック・仕様は Takashi Sono 氏による原著
  [tsono1-netizen/spinopelvic_app](https://github.com/tsono1-netizen/spinopelvic_app)
  （Apache-2.0）の Web 再実装です。ライセンスを継承しています。
