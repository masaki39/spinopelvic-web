// 頚椎8点の自動配置（spine-measure-assistで学習したONNXモデルを使用）。
// モデル本体とonnxruntime-webのWASMランタイムは apps/cervical/model/ に
// 素のファイルとして置いており、vite-plugin-singlefileのインライン化対象から
// 意図的に外している（WASMが13MB超あり、単一HTMLダウンロード版に含めると
// 配布物が肥大化するため）。そのためオンライン版（GitHub Pages）でのみ動作し、
// ダウンロードした単体HTMLではfetchが404してこの機能だけ使えなくなる
// （他の手動計測機能には影響しない）。
const MODEL_DIR = './model/';
const INPUT_SIZE = 512;

// preset.js の CERVICAL.required と同順（学習側 LANDMARK_ORDER にも一致）
const LANDMARK_IDS = ['c2c', 'c2a', 'c2p', 'c7sp', 'c7ia', 'c7ip', 't1a', 't1p'];

let readyPromise = null;

// 文字列prefixだと解決基準が呼び出し元によって変わる（import()はモジュール自身のURL基準、
// fetch()はdocument基準）ため、常にdocument基準の絶対URLへ揃えてから使う。
// cervical-ai.js自体はビルド後にindex.htmlへインライン化されるため import.meta.url は
// 環境によって変わるが、document.baseURI＝ページのURLは開発/本番で一貫している。
const abs = (name) => new URL(MODEL_DIR + name, document.baseURI).href;

// onnxruntime-web本体とONNXモデルは初回のみロードし、以降は使い回す
function getReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const ort = await import(/* @vite-ignore */ abs('ort.wasm.min.mjs'));
      ort.env.wasm.wasmPaths = {
        'ort-wasm-simd-threaded.wasm': abs('ort-wasm-simd-threaded.wasm'),
        'ort-wasm-simd-threaded.mjs': abs('ort-wasm-simd-threaded.mjs'),
      };
      ort.env.wasm.numThreads = 1; // file://やCOOP/COEP未設定でも動くようにする
      // 重みはonnx本体に埋め込まれておらず外部データファイルに分離されているため、
      // 明示的にfetchしてバイト列を渡す（pathはグラフ内部の参照名と一致させる必要がある）
      const extRes = await fetch(abs('cervical_best.onnx.data'));
      const extData = new Uint8Array(await extRes.arrayBuffer());
      const session = await ort.InferenceSession.create(abs('cervical_best.onnx'), {
        externalData: [{ path: 'cervical_best.onnx.data', data: extData }],
      });
      return { ort, session };
    })();
  }
  return readyPromise;
}

// 1-99パーセンタイルでクリップして[0,255]にコントラスト正規化する（学習時と同じ前処理）
function percentileClipNormalize(gray, w, h) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = w * h;
  const lo = percentileFromHist(hist, total, 0.01);
  const hi = percentileFromHist(hist, total, 0.99);
  const span = Math.max(hi - lo, 1e-6);
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = ((Math.min(Math.max(gray[i], lo), hi) - lo) / span) * 255;
  }
  return out;
}
function percentileFromHist(hist, total, p) {
  const target = total * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

function toGrayscale(imageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

// アスペクト比維持でINPUT_SIZE四方にレターボックス化しつつ、Float32のCHWテンソルを作る
function buildInputTensor(bitmap, w, h) {
  const srcCtx = bitmap.getContext('2d');
  const gray = toGrayscale(srcCtx.getImageData(0, 0, w, h));
  const normalized = percentileClipNormalize(gray, w, h);

  const grayCanvas = document.createElement('canvas');
  grayCanvas.width = w; grayCanvas.height = h;
  const grayCtx = grayCanvas.getContext('2d');
  const grayImg = grayCtx.createImageData(w, h);
  for (let i = 0, p = 0; i < grayImg.data.length; i += 4, p++) {
    grayImg.data[i] = grayImg.data[i + 1] = grayImg.data[i + 2] = normalized[p];
    grayImg.data[i + 3] = 255;
  }
  grayCtx.putImageData(grayImg, 0, 0);

  const scale = Math.min(INPUT_SIZE / h, INPUT_SIZE / w);
  const newW = Math.round(w * scale), newH = Math.round(h * scale);
  const padX = Math.floor((INPUT_SIZE - newW) / 2), padY = Math.floor((INPUT_SIZE - newH) / 2);

  const dst = document.createElement('canvas');
  dst.width = INPUT_SIZE; dst.height = INPUT_SIZE;
  const dstCtx = dst.getContext('2d');
  dstCtx.fillStyle = '#000';
  dstCtx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  dstCtx.imageSmoothingEnabled = true;
  dstCtx.imageSmoothingQuality = 'high';
  dstCtx.drawImage(grayCanvas, 0, 0, w, h, padX, padY, newW, newH);

  const px = dstCtx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const data = new Float32Array(INPUT_SIZE * INPUT_SIZE);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) data[p] = px[i] / 255;

  return { data, scale, padX, padY };
}

function argmax2d(heat, offset, size) {
  let best = -Infinity, bx = 0, by = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = heat[offset + y * size + x];
      if (v > best) { best = v; bx = x; by = y; }
    }
  }
  return { x: bx, y: by };
}

// bitmap(state.bitmap, w x h)から頚椎8点を推定し、id -> {x,y}（画像座標系）を返す
export async function detectCervicalLandmarks(bitmap, w, h) {
  const { ort, session } = await getReady();
  const { data, scale, padX, padY } = buildInputTensor(bitmap, w, h);
  const tensor = new ort.Tensor('float32', data, [1, 1, INPUT_SIZE, INPUT_SIZE]);
  const outputs = await session.run({ image: tensor });
  const heatmaps = outputs.heatmaps.data;
  const stride = INPUT_SIZE * INPUT_SIZE;

  const result = {};
  LANDMARK_IDS.forEach((id, ch) => {
    const { x, y } = argmax2d(heatmaps, ch * stride, INPUT_SIZE);
    result[id] = {
      x: Math.min(Math.max((x - padX) / scale, 0), w - 1),
      y: Math.min(Math.max((y - padY) / scale, 0), h - 1),
    };
  });
  return result;
}
