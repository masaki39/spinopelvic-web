import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// ソースは src/ で分割管理し、配布用に単一の index.html へインライン化してビルドする。
// 出力(dist/index.html)は npm script でリポジトリ直下の index.html にコピーし、
// GitHub Pages 配信物・ローカル配布物・ローカル版ダウンロードのすべてを兼ねる。
export default defineConfig({
  root: 'src',
  base: './',          // file:// で直接開けるよう相対パスにする
  plugins: [viteSingleFile()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
  },
});
