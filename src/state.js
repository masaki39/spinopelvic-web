import { SPINOPELVIC } from './preset.js';

//==================================================================
// 状態
//==================================================================
export const state = {
  preset: SPINOPELVIC,
  images: [],            // {file, name}
  index: -1,
  currentName: '',
  base: null,            // 元画像 (ImageBitmap)
  bitmap: null,          // 回転/反転適用後 (canvas)
  imgW:0, imgH:0,
  rotation:0, flipH:false,
  points:{},             // id -> {x,y}
  placedOrder:[],
  radius:60,
  radiusManual:false,     // 大腿骨頭円半径をユーザーが手動調整済みか（自動推定で上書きしないため）
  active:null,
  placingC7:false,
  scale:{ p1:null, p2:null, realMm:null, pxPerMm:null, setting:0 },
  caseId:'',
  rows:[],
  rowByIndex:{},          // 画像index -> rows内の位置（同じ画像の重複記録を防ぐ）
  csvSaved:false,         // rows を CSV 保存済みか（離脱警告の抑制に使用）
  dirty:false,            // 未記録の変更があるか
  result:null,
  view:{ scale:1, ox:0, oy:0 },
  mouseImg:null,
};

//==================================================================
// DOM参照
//==================================================================
export const $ = id=>document.getElementById(id);
export const canvas=$('canvas'), ctx=canvas.getContext('2d');
export const fileInput=$('fileInput');
