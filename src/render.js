import { state, canvas, ctx } from './state.js';
import { G } from './geometry.js';

//==================================================================
// 座標変換
//==================================================================
export const toScreen = p=>({x:p.x*state.view.scale+state.view.ox, y:p.y*state.view.scale+state.view.oy});
export const toImg    = s=>({x:(s.x-state.view.ox)/state.view.scale, y:(s.y-state.view.oy)/state.view.scale});

//==================================================================
// ビュー（フィット・ズーム・パン）
//==================================================================
export function fit(){
  const cw=canvas.clientWidth, ch=canvas.clientHeight;
  if(!state.imgW) return;
  const s=Math.min(cw/state.imgW, ch/state.imgH)*0.98;
  state.view.scale=s;
  state.view.ox=(cw-state.imgW*s)/2;
  state.view.oy=(ch-state.imgH*s)/2;
  state.view.custom=false;   // フィット状態: リサイズ時は再フィットに追従
}
export function zoomAt(sx,sy,factor){
  const v=state.view;
  const ix=(sx-v.ox)/v.scale, iy=(sy-v.oy)/v.scale;
  v.scale=Math.max(0.05, Math.min(40, v.scale*factor));
  v.ox=sx-ix*v.scale; v.oy=sy-iy*v.scale;
  v.custom=true;             // ユーザー操作によるビュー: リサイズ時も維持
  render();
}

//==================================================================
// 描画
//==================================================================
export function render(){
  const dpr=window.devicePixelRatio||1;
  const cw=canvas.clientWidth, ch=canvas.clientHeight;
  if(canvas.width!==cw*dpr||canvas.height!==ch*dpr){ canvas.width=cw*dpr; canvas.height=ch*dpr; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  if(!state.bitmap) return;
  const v=state.view;
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(state.bitmap, v.ox, v.oy, state.imgW*v.scale, state.imgH*v.scale);
  paintOverlay(ctx, toScreen, v.scale, 2);
  drawLoupe(ctx, cw);
}

// 計測値付き保存用（#11）: 点の名称ラベルとアクティブ点ハイライトを省き、
// 右下に計測値パネルを焼き込む。高解像度X線でも読めるよう画像サイズに応じて拡大する。
export function renderMeasurementCanvas(){
  const c=document.createElement('canvas'); c.width=state.imgW; c.height=state.imgH;
  const x=c.getContext('2d');
  x.drawImage(state.bitmap,0,0);
  const k=Math.max(1, Math.min(state.imgW,state.imgH)/1100);
  paintOverlay(x, p=>({x:p.x,y:p.y}), 1, 2*k, k, {showLabels:false, showActive:false});
  drawMetricsPanel(x, k);
  return x.canvas;
}

export function measurementBlob(){
  return new Promise(res=>renderMeasurementCanvas().toBlob(res,'image/png'));
}

function drawMetricsPanel(g, k){
  const res=state.result; if(!res) return;
  const items=state.preset.metrics.map(mt=>{
    const v=res[mt.key];
    return `${mt.key} ${v!=null? v.toFixed(1):'-'}${mt.unit}`;
  });
  if(res.svaMm!=null) items.push(`SVA ${res.svaMm.toFixed(1)}mm`);
  else if(res.svaPx!=null) items.push(`SVA ${res.svaPx.toFixed(1)}px`);
  if(!items.length) return;

  const fontSize=24*k, pad=16*k, lineGap=8*k, margin=18*k;
  g.font=`700 ${fontSize}px system-ui`;
  g.textBaseline='top';
  const boxW=Math.max(...items.map(t=>g.measureText(t).width))+pad*2;
  const boxH=items.length*fontSize+(items.length-1)*lineGap+pad*2;
  const x0=g.canvas.width-boxW-margin, y0=g.canvas.height-boxH-margin;

  g.fillStyle='rgba(0,0,0,.68)';
  roundRect(g,x0,y0,boxW,boxH,10*k); g.fill();
  g.fillStyle='#fff';
  items.forEach((t,i)=>g.fillText(t, x0+pad, y0+pad+i*(fontSize+lineGap)));
}

function roundRect(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r);
  g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);
  g.arcTo(x,y,x+w,y,r);
  g.closePath();
}

// map: 画像座標→描画座標、ds: 画像長さの倍率、lw: 線幅、k: UI要素（点・文字）の倍率
// opts.showLabels: 点の名称ラベル、opts.showActive: アクティブ点ハイライト（#11: 計測値付き保存では両方非表示）
//
// ランドマーク・終板ラインなどの描画は preset.steps / preset.lines / preset.plumbLines
// という宣言的な定義から汎用的に行う（新しいプリセットは基本これらを定義するだけでよい）。
// どのプリセットにも当てはまらない一点物の幾何（PIの補助線など）は preset.drawExtra に逃がす。
function paintOverlay(g, map, ds, lw, k=1, opts={}){
  const {showLabels=true, showActive=true}=opts;
  const P=state.points, res=state.result, sc=state.scale;
  const line=(a,b,color,w)=>{ g.strokeStyle=color; g.lineWidth=w?w*k:lw; const A=map(a),B=map(b);
    g.beginPath(); g.moveTo(A.x,A.y); g.lineTo(B.x,B.y); g.stroke(); };
  const dot=(p,r,color)=>{ const c=map(p); g.fillStyle=color; g.beginPath(); g.arc(c.x,c.y,r*k,0,7); g.fill(); };
  const ring=(p,r,color,w)=>{ const c=map(p); g.strokeStyle=color; g.lineWidth=w?w*k:lw;
    g.beginPath(); g.arc(c.x,c.y,r,0,7); g.stroke(); };
  const cross=(p,color)=>{ const c=map(p); g.strokeStyle=color; g.lineWidth=lw;
    g.beginPath(); g.moveTo(c.x-8*k,c.y); g.lineTo(c.x+8*k,c.y); g.moveTo(c.x,c.y-8*k); g.lineTo(c.x,c.y+8*k); g.stroke(); };
  const label=(p,t,color,dx=8,dy=-8)=>{ if(!showLabels) return; const c=map(p); dx*=k; dy*=k;
    g.font=`${12*k}px system-ui`; g.textBaseline='bottom';
    const w=g.measureText(t).width; g.fillStyle='rgba(0,0,0,.65)'; g.fillRect(c.x+dx-2*k,c.y+dy-12*k,w+4*k,15*k);
    g.fillStyle=color; g.fillText(t,c.x+dx,c.y+dy); };
  const dashedTo=(a,b,color,w)=>dashed(g,map,a,b,color,w,k);
  const H={line,dot,ring,cross,label,dashed:dashedTo};

  // スケール（プリセットに依存しない共通オーバーレイ）
  if(sc.p1){ dot(sc.p1,5,'#ff9800'); ring(sc.p1,5*k,'#fff',1.5); }
  if(sc.p2){ dot(sc.p2,5,'#ff9800'); ring(sc.p2,5*k,'#fff',1.5); }
  if(sc.p1&&sc.p2){
    line(sc.p1,sc.p2,'#ff9800',2.5);
    const mid={x:(sc.p1.x+sc.p2.x)/2,y:(sc.p1.y+sc.p2.y)/2};
    const px=G.distance(sc.p1,sc.p2);
    label(mid, sc.realMm? `${sc.realMm.toFixed(1)}mm (${px.toFixed(0)}px)`:`${px.toFixed(0)}px`, '#ffb74d', 0,-6);
  }

  // ランドマーク点（preset.steps から汎用描画。kind:'circle' は大腿骨頭のような半径ハンドル付き円）
  for(const s of state.preset.steps){
    const p=P[s.id]; if(!p) continue;
    if(s.kind==='circle'){
      ring(p, state.radius*ds, '#4caf50', 2);
      cross(p,'#ff5252');
      const handle={x:p.x+state.radius, y:p.y};
      dot(handle,6,'#fff'); ring(handle,6*k,'#4caf50',1.5);
    }else{
      dot(p,6,s.color); label(p,s.label,s.color);
    }
  }

  // ランドマーク間の線（preset.lines。extend:true で両端に区間長ぶんの破線延長）
  for(const ln of state.preset.lines||[]){
    const a=P[ln.a], b=P[ln.b]; if(!a||!b) continue;
    line(a,b,ln.color,ln.width||2);
    if(ln.extend){
      const len=G.distance(a,b);
      if(len>0){
        const ux=(b.x-a.x)/len, uy=(b.y-a.y)/len;
        dashedTo({x:a.x-ux*len,y:a.y-uy*len}, a, ln.color, 1.5);
        dashedTo(b, {x:b.x+ux*len,y:b.y+uy*len}, ln.color, 1.5);
      }
    }
  }

  // プリセット固有の補助描画（PIのS1法線・寛骨臼軸線など、点/線の宣言だけでは表せない幾何）
  if(res) state.preset.drawExtra?.(H, P, res, ds, k);

  // SVAのようなプラムライン（preset.plumbLines）: from の垂直位置を to の高さまで落とし、
  // 水平距離を計測値として表示する（from/to は res の派生点でも P の配置点でもよい）
  if(res){
    for(const pl of state.preset.plumbLines||[]){
      const from=res[pl.from]||P[pl.from], to=res[pl.to]||P[pl.to];
      if(!from||!to) continue;
      const foot={x:from.x,y:to.y};
      line(from,foot,pl.color,2.5);
      dashedTo(to,foot,pl.color,1.5);
      const mm=res[pl.mmKey], px=res[pl.pxKey];
      const lab = mm!=null ? `${pl.prefix||'SVA'} ${mm.toFixed(1)}mm`
                : px!=null ? `${pl.prefix||'SVA'} ${px.toFixed(1)}px` : null;
      if(lab) label({x:(to.x+from.x)/2,y:to.y}, lab, pl.color, 0, 16);
    }
  }

  // アクティブ点ハイライト
  if(showActive && state.active&&P[state.active]) ring(P[state.active], 11*k, '#fff', 2);
}

function dashed(g,map,a,b,color,w,k=1){
  const A=map(a),B=map(b); g.strokeStyle=color; g.lineWidth=w*k; g.setLineDash([8*k,4*k]);
  g.beginPath(); g.moveTo(A.x,A.y); g.lineTo(B.x,B.y); g.stroke(); g.setLineDash([]);
}

function drawLoupe(g, cw){
  if(!state.mouseImg) return;
  const z=4, size=150, pad=10;
  const dx=cw-size-pad, dy=pad;   // ドラッグ中はHUDが退避するので右上でよい
  const sw=size/z, sh=size/z;
  const sx=state.mouseImg.x-sw/2, sy=state.mouseImg.y-sh/2;
  g.save();
  g.beginPath(); g.rect(dx,dy,size,size); g.clip();
  g.fillStyle='#000'; g.fillRect(dx,dy,size,size);
  g.imageSmoothingEnabled=false;
  g.drawImage(state.bitmap, sx,sy,sw,sh, dx,dy,size,size);
  // ルーペ内のランドマーク
  const lm=p=>({x:dx+(p.x-sx)/sw*size, y:dy+(p.y-sy)/sh*size});
  for(const s of state.preset.steps){ const p=state.points[s.id]; if(p){
    const c=lm(p); g.fillStyle=s.color; g.beginPath(); g.arc(c.x,c.y,4,0,7); g.fill(); } }
  g.restore();
  // 中心十字 + 枠
  g.strokeStyle='#f44'; g.lineWidth=1;
  g.beginPath(); g.moveTo(dx+size/2-10,dy+size/2); g.lineTo(dx+size/2+10,dy+size/2);
  g.moveTo(dx+size/2,dy+size/2-10); g.lineTo(dx+size/2,dy+size/2+10); g.stroke();
  g.strokeStyle='#fff'; g.lineWidth=1.5; g.strokeRect(dx,dy,size,size);
  g.fillStyle='#fff'; g.font='10px system-ui'; g.textBaseline='top';
  g.fillText(`${z}x`, dx+4, dy+4);
}
