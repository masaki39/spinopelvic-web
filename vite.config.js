import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const resolveSrc = p => fileURLToPath(new URL(p, import.meta.url));

// ソースは src/ で分割管理し、配布用に各ページを単一HTMLへインライン化してビルドする
// （マルチページ: src/index.html=ホーム, src/<app>/index.html=各計測アプリ）。
// vite-plugin-singlefile は単一エントリしか扱えない(inlineDynamicImportsの制約)ため、
// PAGE 環境変数でページごとに個別ビルドする（build script 側でページ数分呼び出す）。
// 出力(dist/*)は npm script でリポジトリ直下にコピーし、
// GitHub Pages 配信物・ローカル配布物・ローカル版ダウンロードのすべてを兼ねる。
const PAGES = {
  home:        'src/index.html',
  spinopelvic: 'src/spinopelvic/index.html',
};
const entry = PAGES[process.env.PAGE] || PAGES.home;

export default defineConfig({
  root: 'src',
  base: './',          // file:// で直接開けるよう相対パスにする
  plugins: [viteSingleFile()],
  build: {
    // 出力先はエントリのrootからの相対パスを保つので、両ページとも同じoutDirでよい
    // (home: dist/index.html, spinopelvic: dist/spinopelvic/index.html)
    outDir: '../dist',
    emptyOutDir: false, // dist/ 全体のクリアは build script 側の rm -rf dist で行う
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: resolveSrc(entry),
    },
  },
});
