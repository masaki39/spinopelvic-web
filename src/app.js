import { state, $, canvas, fileInput } from './state.js';
import { G } from './geometry.js';
import { fileStamp, csvEsc, download, deriveId } from './utils.js';
import { render, fit, zoomAt, toScreen, toImg, canvasBlob } from './render.js';

//==================================================================
// 画像読み込み・回転
//==================================================================
function setFiles(files){
  const imgs=[...files].filter(f=>f.type.startsWith('image/'))
                       .sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true}));
  if(!imgs.length) return;
  state.images=imgs.map(f=>({file:f, name:f.name}));
  state.rows=[]; state.rowByIndex={};   // 新しいバッチ＝記録をリセット
  loadImage(0);
}

let _loadToken=0;
async function loadImage(i){
  if(i<0||i>=state.images.length) return;
  const token=++_loadToken;
  const it=state.images[i];
  const prevScale = state.keepScale ? {...state.scale} : null;
  const base=await createImageBitmap(it.file);
  if(token!==_loadToken) return;        // 連打で追い越された読み込みは破棄
  state.index=i; state.currentName=it.name; state.base=base;
  state.rotation=0; state.flipH=false;
  buildWorking();
  resetPoints();
  if(prevScale && prevScale.pxPerMm){ state.scale={...prevScale, setting:0}; recompute(); }
  $('caseId').value = state.caseId = deriveId(it.name);
  fit(); updateUI(); render();
}

function buildWorking(){
  const r=((state.rotation%360)+360)%360;
  const swap=(r===90||r===270);
  const bw=state.base.width, bh=state.base.height;
  const w=swap?bh:bw, h=swap?bw:bh;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d');
  x.save();
  x.translate(w/2,h/2);
  x.rotate(r*Math.PI/180);
  if(state.flipH) x.scale(-1,1);
  x.drawImage(state.base, -bw/2, -bh/2);
  x.restore();
  state.bitmap=c; state.imgW=w; state.imgH=h;
}

function resetPoints(){
  state.points={}; state.placedOrder=[]; state.radius=60;
  state.active=null; state.placingC7=false; state.result=null; state.dirty=false;
  state.scale={ p1:null, p2:null, realMm:null, pxPerMm:null, setting:0 };
}

function rotate(deg){
  if(!state.base) return;
  if(hasUnsaved() && !confirm('回転すると配置済みの点・スケールが失われます。続けますか？')) return;
  state.rotation+=deg; buildWorking(); resetPoints(); fit(); recompute(); updateUI(); render();
}
function flip(){
  if(!state.base) return;
  if(hasUnsaved() && !confirm('反転すると配置済みの点・スケールが失われます。続けますか？')) return;
  state.flipH=!state.flipH; buildWorking(); resetPoints(); fit(); recompute(); updateUI(); render();
}

//==================================================================
// 計測・記録
//==================================================================
function recompute(){ state.result=state.preset.compute(state.points, state.scale.pxPerMm); }
function recalcScale(){
  const sc=state.scale;
  if(sc.p1&&sc.p2&&sc.realMm) sc.pxPerMm=G.distance(sc.p1,sc.p2)/sc.realMm;
}
function pendingStepId(){
  for(const id of state.preset.required) if(!state.points[id]) return id;
  if(state.placingC7){ if(!state.points.c7a) return 'c7a'; if(!state.points.c7p) return 'c7p'; }
  return null;
}
const labelOf = id => (state.preset.steps.find(s=>s.id===id)||{}).label||id;

function place(id, p){
  state.points[id]=p; state.placedOrder.push(id); state.active=id; state.dirty=true;
  if(id==='femR'&&state.points.femL){
    const est=G.distance(state.points.femL, state.points.femR)/4;
    state.radius=Math.max(20, Math.min(120, est));
  }
  if(id==='c7p') state.placingC7=false;
  recompute();
}
function undo(){
  const id=state.placedOrder.pop();
  if(!id) return;
  delete state.points[id];
  if(id==='c7a'||id==='c7p') state.placingC7=false;
  state.active=state.placedOrder[state.placedOrder.length-1]||null;
  state.dirty=true; recompute(); updateUI(); render();
}

function hasUnsaved(){ return state.dirty && state.placedOrder.length>0; }
function navTo(i){
  if(i<0||i>=state.images.length) return;
  if(hasUnsaved() && !confirm('未記録の変更があります。記録せずに移動しますか？')) return;
  loadImage(i);
}

async function recordAndNext(){
  recompute();
  if(!state.result){ setStatus('必須点（大腿骨頭L/R・S1・L1）が未配置です'); return; }
  state.caseId=$('caseId').value.trim();
  const row=state.preset.csvRow(state, state.result);
  const pos=state.rowByIndex[state.index];
  if(pos!==undefined){ state.rows[pos]=row; }          // 同じ画像の再記録は置換
  else { state.rowByIndex[state.index]=state.rows.length; state.rows.push(row); }
  state.dirty=false;
  const base=(state.caseId||state.currentName||'case').replace(/[\\/:*?"<>| ]/g,'_');

  if(state.out.perImage){
    download(csvBlob([row]), base+'.csv');
    download(await canvasBlob(), base+'.png');
  }

  if(state.index < state.images.length-1){
    loadImage(state.index+1);
  }else{
    setStatus('全画像の記録完了（計 '+state.rows.length+' 件）。CSV保存(D)で書き出せます。');
    updateUI();
  }
}

//==================================================================
// CSV / ファイル出力
//==================================================================
function csvText(rows){
  return [state.preset.csvColumns, ...rows].map(r=>r.map(csvEsc).join(',')).join('\r\n');
}
function csvBlob(rows){ return new Blob(['﻿'+csvText(rows)], {type:'text/csv;charset=utf-8'}); }
function saveCsv(){
  if(!state.rows.length){ setStatus('記録がありません（Enterで記録してから保存）'); return; }
  download(csvBlob(state.rows), `spinopelvic_batch_${fileStamp()}.csv`);
}

//==================================================================
// ヒットテスト・ポインタ操作
//==================================================================
function hitTest(sp){
  const thr=10, P=state.points;
  for(const [id,center] of [['femL',P.femL],['femR',P.femR]]){
    if(!center) continue;
    const h=toScreen({x:center.x+state.radius, y:center.y});
    if(Math.hypot(sp.x-h.x,sp.y-h.y)<thr) return {type:id==='femL'?'radiusL':'radiusR'};
  }
  for(const s of state.preset.steps){ const p=P[s.id]; if(!p) continue;
    const c=toScreen(p); if(Math.hypot(sp.x-c.x,sp.y-c.y)<thr) return {type:'point', id:s.id}; }
  for(const [id,p] of [['scale1',state.scale.p1],['scale2',state.scale.p2]]){ if(!p) continue;
    const c=toScreen(p); if(Math.hypot(sp.x-c.x,sp.y-c.y)<thr) return {type:id}; }
  return null;
}
function applyDrag(hit, ip){
  const P=state.points, sc=state.scale;
  state.dirty=true;
  switch(hit.type){
    case 'point': P[hit.id]=ip; state.active=hit.id; break;
    case 'radiusL': if(P.femL) state.radius=Math.max(10,G.distance(ip,P.femL)); break;
    case 'radiusR': if(P.femR) state.radius=Math.max(10,G.distance(ip,P.femR)); break;
    case 'scale1': sc.p1=ip; recalcScale(); break;
    case 'scale2': sc.p2=ip; recalcScale(); break;
  }
  recompute();
}
function scaleTap(ip){
  const sc=state.scale;
  if(sc.setting===1){ sc.p1=ip; sc.setting=2; setStatus('スケール: 基準線の終点をクリック'); }
  else if(sc.setting===2){
    sc.p2=ip; sc.setting=0;
    const v=prompt('基準線の実長 (mm) を入力', '100');
    const mm=parseFloat(v);
    if(mm>0){ sc.realMm=mm; recalcScale(); state.dirty=true; setStatus(`スケール設定: 1mm = ${sc.pxPerMm.toFixed(2)}px`); }
    else { sc.p1=null; sc.p2=null; setStatus('スケール校正をキャンセルしました'); }
    recompute();
  }
}
function placeOrSelect(ip){
  const pid=pendingStepId();
  if(pid){ place(pid, ip); return; }
  // 最近傍点を選択
  let best=null, bd=20;
  for(const s of state.preset.steps){ const p=state.points[s.id]; if(!p) continue;
    const c=toScreen(p), d=Math.hypot(c.x-toScreen(ip).x, c.y-toScreen(ip).y); if(d<bd){ bd=d; best=s.id; } }
  if(best) state.active=best;
}

let down=null;
canvas.addEventListener('pointerdown', e=>{
  if(!state.bitmap) return;
  canvas.setPointerCapture(e.pointerId);
  const sp={x:e.offsetX,y:e.offsetY};
  down={sx:sp.x, sy:sp.y, hit:hitTest(sp), moved:0, ox:state.view.ox, oy:state.view.oy};
});
canvas.addEventListener('pointermove', e=>{
  const sp={x:e.offsetX,y:e.offsetY};
  if(state.bitmap) state.mouseImg=toImg(sp);
  if(down){
    const dx=sp.x-down.sx, dy=sp.y-down.sy;
    down.moved=Math.max(down.moved, Math.hypot(dx,dy));
    if(down.hit) applyDrag(down.hit, toImg(sp));
    else if(down.moved>=5){ state.view.ox=down.ox+dx; state.view.oy=down.oy+dy; }
  }
  render();
  if(down) updateUI();
});
canvas.addEventListener('pointerup', e=>{
  if(!down) return;
  const sp={x:e.offsetX,y:e.offsetY}, ip=toImg(sp), tap=down.moved<5;
  if(state.scale.setting>0 && tap) scaleTap(ip);
  else if(tap){
    if(down.hit&&down.hit.type==='point') state.active=down.hit.id;
    else if(!down.hit) placeOrSelect(ip);
  }
  down=null; updateUI(); render();
});
canvas.addEventListener('pointerleave', ()=>{ state.mouseImg=null; render(); });
canvas.addEventListener('wheel', e=>{ if(!state.bitmap) return; e.preventDefault();
  zoomAt(e.offsetX, e.offsetY, e.deltaY<0?1.1:1/1.1); }, {passive:false});

//==================================================================
// キーボード
//==================================================================
function nudge(dx,dy){
  if(!state.active||!state.points[state.active]) return;
  const p=state.points[state.active]; p.x+=dx; p.y+=dy; state.dirty=true; recompute(); updateUI(); render();
}
window.addEventListener('keydown', e=>{
  const inField = document.activeElement && document.activeElement.tagName==='INPUT';
  if(inField){ if(e.key==='Escape') document.activeElement.blur(); else return; }
  if(e.metaKey||e.ctrlKey) return;        // ブラウザのCmd/Ctrlショートカットを優先
  if($('help').classList.contains('show')){   // ヘルプ表示中はキー操作を遮断
    if(['Escape','?','h','H'].includes(e.key)) $('help').classList.remove('show');
    return;
  }
  const step = e.shiftKey?5 : (e.altKey?0.2 : 1);
  switch(e.key){
    case 'o': case 'O': fileInput.click(); break;
    case 'r': rotate(90); break;
    case 'R': rotate(-90); break;
    case 'f': case 'F': flip(); break;
    case 'z': case 'Z': case 'Backspace': e.preventDefault(); undo(); break;
    case 'c': case 'C': startC7(); break;
    case 's': case 'S': startScale(); break;
    case 'Enter': case 'e': case 'E': e.preventDefault(); recordAndNext(); break;
    case 'n': case 'N': navTo(state.index+1); break;
    case 'p': case 'P': navTo(state.index-1); break;
    case 'd': case 'D': saveCsv(); break;
    case '+': case '=': zoomAt(canvas.clientWidth/2, canvas.clientHeight/2, 1.2); break;
    case '-': case '_': zoomAt(canvas.clientWidth/2, canvas.clientHeight/2, 1/1.2); break;
    case '0': fit(); render(); break;
    case 'ArrowLeft':  e.preventDefault(); nudge(-step,0); break;
    case 'ArrowRight': e.preventDefault(); nudge(step,0); break;
    case 'ArrowUp':    e.preventDefault(); nudge(0,-step); break;
    case 'ArrowDown':  e.preventDefault(); nudge(0,step); break;
    case '?': case 'h': case 'H': toggleHelp(); break;
    case 'Escape': if(state.scale.setting){ state.scale.setting=0; setStatus('校正中止'); } $('help').classList.remove('show'); break;
  }
});

function startC7(){
  if(!state.result){ setStatus('先にPI/PT/SS/LL計測を完了してください'); return; }
  state.placingC7=true;
  delete state.points.c7a; delete state.points.c7p;
  state.placedOrder=state.placedOrder.filter(id=>id!=='c7a'&&id!=='c7p');
  state.active=null;
  setStatus('C7前縁→C7後縁をクリック（SVA算出）'); updateUI(); render();
}
function startScale(){
  if(!state.bitmap) return;
  state.scale={ p1:null,p2:null,realMm:null,pxPerMm:null, setting:1 };
  recompute(); setStatus('スケール: 基準線の始点をクリック'); updateUI(); render();
}

//==================================================================
// UI 更新
//==================================================================
function setStatus(t){ $('status').textContent=t; }
function updateUI(){
  const has=!!state.bitmap;
  $('empty').style.display = has ? 'none' : 'flex';
  document.querySelectorAll('.dataonly').forEach(b=>b.disabled=!has);
  $('btnPrev').disabled=!has||state.index<=0;
  $('btnNext').disabled=!has||state.index>=state.images.length-1;
  const rec = has && state.rowByIndex[state.index]!==undefined;
  $('counter').textContent = has
    ? `画像 ${state.index+1} / ${state.images.length}` + (rec?' ✓記録済':'') + (hasUnsaved()?' ●未記録':'')
    : '画像なし';

  // 計測値
  const res=state.result, m=$('metrics');
  if(res){
    m.innerHTML = state.preset.metrics.map(mt=>
      `<div class="metric"><div class="k">${mt.key}</div><div class="v">${res[mt.key].toFixed(1)}${mt.unit}</div></div>`
    ).join('');
    const sv=$('svaInfo');
    if(res.svaPx!=null){
      sv.innerHTML = res.svaMm!=null
        ? `<b>SVA:</b> ${res.svaMm.toFixed(1)} mm <span style="color:#999">(${res.svaPx.toFixed(1)} px)</span>`
        : `<b>SVA:</b> ${res.svaPx.toFixed(1)} px <span style="color:#999">（mm換算はスケール校正が必要）</span>`;
    } else sv.innerHTML = `<span style="color:#999">SVA未計測（C入力でC7配置）</span>`;
  } else {
    m.innerHTML = `<div class="note" style="grid-column:1/3">必須点を配置すると計測値が表示されます。</div>`;
    $('svaInfo').innerHTML='';
  }

  // スケール表示
  const sc=state.scale, sb=$('scaleInfo');
  if(sc.pxPerMm){ sb.style.background='#fff3e0'; sb.style.border='1px solid #ffb74d';
    sb.innerHTML=`📏 スケール: ${sc.realMm.toFixed(1)}mm / ${sc.pxPerMm.toFixed(2)} px/mm`; }
  else { sb.style.background='#eee'; sb.style.border='1px solid #ccc';
    sb.innerHTML='📏 スケール未校正（SVAはpx表示）'; }

  // ステータス（校正中でなければ）
  if(sc.setting===0){
    const pid=pendingStepId();
    setStatus(pid ? `次: ${labelOf(pid)} をクリック（矢印キーで微調整）`
                  : '計測完了。Enter/Eで記録して次へ。点はドラッグで調整可。');
  }
}

//==================================================================
// ヘルプ
//==================================================================
function toggleHelp(){ $('help').classList.toggle('show'); }
$('help').innerHTML = `
  <h2>Spinopelvic Analyzer (Web) — ホットキー</h2>
  <table>
    <tr><td><kbd>O</kbd></td><td>画像を開く（複数選択可）</td><td><kbd>R</kbd> / <kbd>⇧R</kbd></td><td>右/左90°回転</td></tr>
    <tr><td><kbd>F</kbd></td><td>左右反転</td><td><kbd>S</kbd></td><td>スケール校正</td></tr>
    <tr><td>クリック</td><td>現在のランドマークを配置</td><td>ドラッグ</td><td>点の移動 / 余白でパン</td></tr>
    <tr><td>矢印</td><td>選択点を微調整 (1px)</td><td><kbd>⇧</kbd>+矢印 / <kbd>⌥</kbd>+矢印</td><td>5px / 0.2px</td></tr>
    <tr><td><kbd>Z</kbd> / <kbd>⌫</kbd></td><td>直前の点を取消</td><td><kbd>C</kbd></td><td>C7入力（SVA）</td></tr>
    <tr><td><kbd>Enter</kbd> / <kbd>E</kbd></td><td>記録して次の画像へ</td><td><kbd>N</kbd> / <kbd>P</kbd></td><td>次 / 前の画像</td></tr>
    <tr><td><kbd>D</kbd></td><td>蓄積CSVを保存</td><td><kbd>+</kbd>/<kbd>-</kbd>/<kbd>0</kbd></td><td>ズーム / フィット</td></tr>
    <tr><td>ホイール</td><td>カーソル位置でズーム</td><td><kbd>?</kbd></td><td>このヘルプ</td></tr>
  </table>
  <p style="margin-top:18px;color:#bbb">クリックして閉じる</p>`;
$('help').addEventListener('click', ()=>$('help').classList.remove('show'));

//==================================================================
// ボタン・入力配線
//==================================================================
$('btnOpen').onclick=()=>fileInput.click();
fileInput.onchange=e=>{ if(e.target.files.length) setFiles(e.target.files); };
$('btnRotL').onclick=()=>rotate(-90);
$('btnRotR').onclick=()=>rotate(90);
$('btnFlip').onclick=flip;
$('btnScale').onclick=startScale;
$('btnC7').onclick=startC7;
$('btnUndo').onclick=undo;
$('btnRecord').onclick=recordAndNext;
$('btnPrev').onclick=()=>navTo(state.index-1);
$('btnNext').onclick=()=>navTo(state.index+1);
$('btnCsv').onclick=saveCsv;
$('btnHelp').onclick=toggleHelp;
$('chkPer').onchange=e=>state.out.perImage=e.target.checked;
$('chkScale').onchange=e=>state.keepScale=e.target.checked;
$('caseId').oninput=e=>state.caseId=e.target.value;

// ドラッグ&ドロップ
['dragover','drop'].forEach(ev=>document.addEventListener(ev, e=>e.preventDefault()));
document.addEventListener('drop', e=>{
  const items=e.dataTransfer.files; if(items&&items.length) setFiles(items);
});

window.addEventListener('resize', ()=>{ if(state.bitmap) fit(); render(); });
$('empty').style.display='flex';
updateUI();

//==================================================================
// 自己テスト（コンソールで runSelfTest() ）
//==================================================================
window.runSelfTest=function(){
  const near=(a,b,t=0.01,msg='')=>{ if(Math.abs(a-b)>t) throw new Error(`FAIL ${msg}: ${a} vs ${b}`); console.log('ok',msg,a.toFixed(3)); };
  const compute=state.preset.compute;
  // 水平S1終板, 鉛直骨盤線 → SS=0, PT=0, PI=0, LL=0
  let r=compute({femL:{x:0,y:200},femR:{x:100,y:200},
    s1a:{x:0,y:100},s1p:{x:100,y:100},l1a:{x:0,y:0},l1p:{x:100,y:0}});
  near(r.SS,0,0.01,'SS horizontal'); near(r.PT,0,0.01,'PT vertical');
  near(r.PI,0,0.01,'PI'); near(r.LL,0,0.01,'LL parallel');
  // 45°傾いたS1 → SS=45
  r=compute({femL:{x:0,y:200},femR:{x:100,y:200},
    s1a:{x:0,y:0},s1p:{x:100,y:100},l1a:{x:0,y:0},l1p:{x:100,y:0}});
  near(r.SS,45,0.01,'SS 45deg'); near(r.LL,45,0.01,'LL 45 vs 0');
  // SVA: 前方は画面左(x=0側)。C7中点 x=120 は S1後縁 x=100 より後方 → -20px
  r=compute({femL:{x:0,y:300},femR:{x:100,y:300},
    s1a:{x:0,y:200},s1p:{x:100,y:200},l1a:{x:0,y:100},l1p:{x:100,y:100},
    c7a:{x:110,y:0},c7p:{x:130,y:0}}, 2);
  near(r.svaPx,-20,0.01,'SVA px'); near(r.svaMm,-10,0.01,'SVA mm');
  // 左右反転不変性: x座標を反転しても全計測値が一致する（符号付き化の要点）
  const cfg={femL:{x:20,y:300},femR:{x:80,y:300},
    s1a:{x:30,y:200},s1p:{x:90,y:215},l1a:{x:35,y:110},l1p:{x:85,y:100},
    c7a:{x:60,y:10},c7p:{x:75,y:14}};
  const mir=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{x:-v.x,y:v.y}]));
  const a=compute(cfg,2), b=compute(mir(cfg),2);
  for(const k of ['PI','PT','SS','LL','svaPx','svaMm']) near(a[k],b[k],1e-6,'mirror '+k);
  console.log('%c runSelfTest: ALL PASSED','color:green;font-weight:bold');
  return true;
};
