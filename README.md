# Spine Analyzer Tools

脊椎X線画像から計測値を算出するローカルWebアプリ集。`index.html` がホームページで、
各計測アプリへのリンクを掲載します。**ダウンロードしてダブルクリックで起動**でき、
画像は端末外に送信されず、すべてブラウザ内で処理されます（Research use only）。

**🔗 オンライン版: https://masaki39.net/spinopelvic-web/**
（ブラウザ上で開いても画像はアップロードされず、端末内でのみ処理されます）

## アプリ一覧

| アプリ | パス | 計測値 |
|---|---|---|
| **Spinopelvic Analyzer** | `apps/spinopelvic/` | PI / PT / SS / LL / SVA |
| **Cervical Analyzer** | `apps/cervical/` | C2C7_angle / T1S / SVA |

Cervical Analyzer のランドマーク定義は
[masaki39/spine-measure-assist](https://github.com/masaki39/spine-measure-assist) の
`CervicalMeasureAssist`（C2椎体中心・C2/C7下終板・C7上後隅角・T1上終板）に準拠しています
（計算式自体はこのアプリの左右反転不変の流儀で実装）。

## 使い方（共通の流れ）

1. `index.html`（ホーム）から使いたいアプリを開くか、`apps/<アプリ名>/index.html` を
   直接ダブルクリックして開く（Google Chrome 推奨）。
2. **画像を開く (O)** で X 線画像を選択（複数選択・フォルダのドラッグ&ドロップ可）。
3. 表示される指示に従い、クリックでランドマークを配置。配置後、**矢印キーで微調整**
   （⇧=5px, ⌥=0.2px）。
4. 必須点が揃うと右パネルに計測値が表示されます。
5. 必要に応じて **S** でスケール校正（Spinopelvic Analyzer は **C** で C7 前/後縁を
   追加して SVA を算出）。
6. **Enter（=記録して次へ）** で結果を蓄積し、次の画像へ自動で進みます。
7. **D** で蓄積した全結果を 1 つの CSV（UTF-8 BOM 付き）に保存。

## ホットキー

| キー | 動作 | キー | 動作 |
|---|---|---|---|
| `O` | 画像を開く | `R` / `⇧R` | 右 / 左 90°回転 |
| `F` | 左右反転 | `S` | スケール校正 |
| クリック | ランドマーク配置 | ドラッグ | 点の移動 / 余白でパン |
| 矢印 | 選択点を微調整 (1px) | `⇧`/`⌥`+矢印 | 5px / 0.2px |
| `Z` / `⌫` | 直前の点を取消 | `C` | C7 入力（SVA、Spinopelvic Analyzer のみ） |
| `Enter` / `E` | 記録して次の画像へ | `N` / `P` | 次 / 前の画像 |
| `D` | 蓄積 CSV を保存 | `+` `-` `0` | ズーム / フィット |
| ホイール | カーソル位置でズーム | `?` | ヘルプ表示 |

`S` / `C` はそのアプリの計測値メニュー（サイドバー）に該当ボタンがある場合のみ有効です
（`preset.extras` で宣言、上部の共通ツールバーには置きません）。

## エクスポート方式

- **蓄積→一括保存**（既定）: `Enter` で各画像の結果をメモリに蓄積し、`D` で 1 CSV にまとめて保存。
- **バッチ自動遷移**: `Enter` で記録後、自動的に次の画像へ。
- **計測値付き画像保存**: サイドバーの「画像保存（計測値付き）」で、補助線と計測値を焼き込んだ PNG をその場で保存。

同じ画像を再度 `Enter` で記録すると行が**置き換え**られ（重複しません）、配置済みで未記録のまま別画像へ移動しようとすると確認が出ます。

## CSV 列

- **Spinopelvic Analyzer**: `patient_id, image_name, saved_at, PI_deg, PT_deg, SS_deg,
  LL_deg, SVA_px, SVA_mm, scale_px_per_mm, scale_real_mm, scale_p1_x..p2_y,
  left/right_femoral_x/y, common_femoral_radius, S1/L1/C7 の anterior/posterior x/y`
  （旧 Flutter 版と互換、1 画像 = 1 行）。
- **Cervical Analyzer**: `patient_id, image_name, saved_at, C2C7_angle_deg, T1S_deg,
  SVA_px, SVA_mm, scale_px_per_mm, scale_real_mm, scale_p1_x..p2_y, C2_center_x/y,
  C2/C7下終板/C7上後隅角/T1 の anterior/posterior x/y`。

## 計測定義

計測値は**符号付き**です。前後ランドマークから「前方向」を導出して角度の正負を決めるため、
画像を左右反転しても一貫した符号が得られます。

**Spinopelvic Analyzer**（前後ランドマーク: `s1a/s1p`, `l1a/l1p`）

- **PI**: S1 終板の垂線と寛骨臼軸線（S1中点→寛骨臼軸中点）の角度（`PI = PT + SS`）
- **PT**: 寛骨臼軸線と鉛直線の角度（寛骨臼軸が前方＝正）
- **SS**: S1 終板と水平線の角度（前縁が頭側＝正）
- **LL**: L1 終板と S1 終板の Cobb 角（**前弯＝正 / 後弯＝負**）
- **SVA**: C7 中点と S1 後縁の水平距離（C7 が前方＝正。px、スケール校正で mm）

**Cervical Analyzer**（前後ランドマーク: `C2下終板`）

- **C2C7_angle**: C2 下終板と C7 下終板の Cobb 角（**前弯＝正 / 後弯＝負**）
- **T1S**: T1 上終板と水平線の角度
- **SVA**: C2 椎体中心と C7 上後隅角の水平距離（C2 が前方＝正。px、スケール校正で mm）

ブラウザのコンソールで `runSelfTest()` を実行すると（Spinopelvic Analyzer 上で）、既知ケース・
左右反転不変性・恒等式 `PI = PT + SS` で式の妥当性を検証できます。

## 動作環境

- 推奨: Google Chrome / Microsoft Edge（最新）。
- `file://`（ダウンロードしてダブルクリック）でも全機能が動作します。サーバー不要。
- **モバイル / タッチ対応**: 狭幅画面ではツールバーが横スクロール 1 行になり、
  計測値パネルは下からの開閉式ボトムシート（**📊 計測値** で開閉）になります。
  ホットキー表示は隠れ、画面左の **＋ / － / ⊡** ボタンでズーム / 全体表示できます
  （ロジックはデスクトップと共通）。

## 開発（ソースの分割管理 / ビルド）

ソースは [Vite](https://vite.dev/) で `src/` 配下に**マルチページ**として分割管理し、
ページごとに配布用の単一HTMLへインライン化してビルドします
（[vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)）。
`src/index.html` がホーム、`src/apps/<アプリ名>/index.html` が各計測アプリのエントリです
（アプリはリポジトリ直下が増え続けないよう `apps/` 配下にまとめています）。

```bash
pnpm install  # 依存をインストール
pnpm dev      # 開発サーバ（HMR）。 / がホーム、/apps/spinopelvic/ 等がアプリ
pnpm build    # 各ページをビルドし、単一ファイルをリポジトリ直下にコピー
              # (index.html=ホーム, apps/<アプリ名>/index.html=各アプリ)
```

| ファイル | 役割 |
|---|---|
| `src/index.html` | ホームページ（アプリ一覧・案内） |
| `src/home.js` / `src/home.css` | ホームページのエントリ / 専用スタイル |
| `src/apps/spinopelvic/index.html` | Spinopelvic Analyzer の画面マークアップ |
| `src/apps/cervical/index.html` | Cervical Analyzer の画面マークアップ |
| `src/style.css` | 計測アプリ共通のスタイル |
| `src/geometry.js` | 幾何ユーティリティ（純粋関数） |
| `src/preset.js` | 計測定義一式（`PRESETS` レジストリ。ランドマーク・描画・計測式・CSV・計測値メニュー） |
| `src/state.js` | アプリ状態。`<body data-preset="...">` を見て `PRESETS` から使用プリセットを選ぶ |
| `src/render.js` | キャンバス描画・ビュー変換（`preset.steps/lines/plumbLines/drawExtra` を汎用解釈） |
| `src/app.js` | 画像入出力・計測・UI・イベント配線（全アプリ共通、プリセット固有の分岐なし） |
| `src/main.js` | 計測アプリのエントリ（CSS と app を読み込む。全アプリ共通） |

ビルド成果物のルート `index.html`（ホーム）・`apps/<アプリ名>/index.html`（各アプリ）が、
GitHub Pages 配信物・ローカル配布物・「ローカル版ダウンロード」の実体を兼ねます。
`pnpm build` 後、変更されたファイルをすべてコミットしてください。

### 新しい計測アプリを追加するには

`main.js` / `app.js` / `render.js` はプリセットに依存しない共通コードなので、
基本的に**新しいプリセットを1つ定義するだけ**で新アプリを追加できます。

1. `src/preset.js` に新しいプリセットを追加し、`PRESETS` レジストリに登録する。
   - `steps`: ランドマーク定義（id・label・color。半径ハンドル付き円にしたい点は `kind:'circle'`）
   - `lines`: 2点を結ぶ終板ラインなど（`extend:true` で破線延長）
   - `plumbLines`: SVA のような垂直落下線+水平距離ラベル
   - `compute` / `metrics` / `csvColumns` / `csvRow` / `extras`（計測値メニューの追加操作）
   - 点/線の宣言だけで表せない幾何（PIの補助線など）だけ `drawExtra(H, P, res, ds, k)` に書く
2. `src/apps/<アプリ名>/index.html` を作成（既存アプリの index.html を雛形に、
   `<body data-preset="...">` を新しいプリセットidに、`#extras` コンテナ・`定義` セクションの
   テキスト・タイトルを差し替える。`<script src="/main.js">` は変更不要）。
3. `vite.config.js` の `PAGES` にエントリを追加し、`package.json` の `build` スクリプトへ
   ビルド呼び出しとコピーを追加。
4. `src/index.html`（ホーム）の `.apps` にリンクカードを追加。

## ライセンス / 謝辞

- 本アプリは **Apache License 2.0** で公開しています（[LICENSE](LICENSE)）。
- 計測ロジック・仕様は Takashi Sono 氏による原著
  [tsono1-netizen/spinopelvic_app](https://github.com/tsono1-netizen/spinopelvic_app)
  （Apache-2.0）の Web 再実装です。ライセンスを継承しています。
