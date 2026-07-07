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

// 画像解像度でのレンダリング（PNG出力用）。高解像度X線でも注釈が読めるよう
// 画像サイズに応じて線幅・点・文字を拡大する。
export function renderToImageCanvas(){
  const c=document.createElement('canvas'); c.width=state.imgW; c.height=state.imgH;
  const x=c.getContext('2d');
  x.drawImage(state.bitmap,0,0);
  const k=Math.max(1, Math.min(state.imgW,state.imgH)/1100);
  paintOverlay(x, p=>({x:p.x,y:p.y}), 1, 2*k, k);
  return x.canvas;
}

export function canvasBlob(){
  return new Promise(res=>renderToImageCanvas().toBlob(res,'image/png'));
}

// map: 画像座標→描画座標、ds: 画像長さの倍率、lw: 線幅、k: UI要素（点・文字）の倍率
function paintOverlay(g, map, ds, lw, k=1){
  const P=state.points, res=state.result, sc=state.scale;
  const line=(a,b,color,w)=>{ g.strokeStyle=color; g.lineWidth=w?w*k:lw; const A=map(a),B=map(b);
    g.beginPath(); g.moveTo(A.x,A.y); g.lineTo(B.x,B.y); g.stroke(); };
  const dot=(p,r,color)=>{ const c=map(p); g.fillStyle=color; g.beginPath(); g.arc(c.x,c.y,r*k,0,7); g.fill(); };
  const ring=(p,r,color,w)=>{ const c=map(p); g.strokeStyle=color; g.lineWidth=w?w*k:lw;
    g.beginPath(); g.arc(c.x,c.y,r,0,7); g.stroke(); };
  const cross=(p,color)=>{ const c=map(p); g.strokeStyle=color; g.lineWidth=lw;
    g.beginPath(); g.moveTo(c.x-8*k,c.y); g.lineTo(c.x+8*k,c.y); g.moveTo(c.x,c.y-8*k); g.lineTo(c.x,c.y+8*k); g.stroke(); };
  const label=(p,t,color,dx=8,dy=-8)=>{ const c=map(p); dx*=k; dy*=k;
    g.font=`${12*k}px system-ui`; g.textBaseline='bottom';
    const w=g.measureText(t).width; g.fillStyle='rgba(0,0,0,.65)'; g.fillRect(c.x+dx-2*k,c.y+dy-12*k,w+4*k,15*k);
    g.fillStyle=color; g.fillText(t,c.x+dx,c.y+dy); };

  // スケール
  if(sc.p1){ dot(sc.p1,5,'#ff9800'); ring(sc.p1,5*k,'#fff',1.5); }
  if(sc.p2){ dot(sc.p2,5,'#ff9800'); ring(sc.p2,5*k,'#fff',1.5); }
  if(sc.p1&&sc.p2){
    line(sc.p1,sc.p2,'#ff9800',2.5);
    const mid={x:(sc.p1.x+sc.p2.x)/2,y:(sc.p1.y+sc.p2.y)/2};
    const px=G.distance(sc.p1,sc.p2);
    label(mid, sc.realMm? `${sc.realMm.toFixed(1)}mm (${px.toFixed(0)}px)`:`${px.toFixed(0)}px`, '#ffb74d', 0,-6);
  }

  // 大腿骨頭
  const femHead=(c)=>{
    ring(c, state.radius*ds, '#4caf50', 2);
    cross(c,'#ff5252');
    const handle={x:c.x+state.radius, y:c.y};
    dot(handle,6,'#fff'); ring(handle,6*k,'#4caf50',1.5);
  };
  if(P.femL) femHead(P.femL);
  if(P.femR) femHead(P.femR);

  // S1/L1
  const sp=[['s1a','S1前','#ffeb3b'],['s1p','S1後','#ffeb3b'],['l1a','L1前','#ff9800'],['l1p','L1後','#ff9800']];
  for(const [id,t,col] of sp){ if(P[id]){ dot(P[id],6,col); label(P[id],t,col); } }
  if(P.s1a&&P.s1p){
    line(P.s1a,P.s1p,'#00e5ff',2);
    const s1Len=G.distance(P.s1a,P.s1p);
    if(s1Len>0){
      const ux=(P.s1p.x-P.s1a.x)/s1Len, uy=(P.s1p.y-P.s1a.y)/s1Len;
      dashed(g,map,{x:P.s1a.x-ux*s1Len, y:P.s1a.y-uy*s1Len},P.s1a,'#00e5ff',1.5,k);
      dashed(g,map,P.s1p,{x:P.s1p.x+ux*s1Len, y:P.s1p.y+uy*s1Len},'#00e5ff',1.5,k);
    }
  }
  if(P.l1a&&P.l1p){
    line(P.l1a,P.l1p,'#ff9800',2);
    const l1Len=G.distance(P.l1a,P.l1p);
    if(l1Len>0){
      const ux=(P.l1p.x-P.l1a.x)/l1Len, uy=(P.l1p.y-P.l1a.y)/l1Len;
      dashed(g,map,{x:P.l1a.x-ux*l1Len, y:P.l1a.y-uy*l1Len},P.l1a,'#ff9800',1.5,k);
      dashed(g,map,P.l1p,{x:P.l1p.x+ux*l1Len, y:P.l1p.y+uy*l1Len},'#ff9800',1.5,k);
    }
  }

  // C7
  if(P.c7a){ dot(P.c7a,6,'#b2ff59'); label(P.c7a,'C7前','#b2ff59'); }
  if(P.c7p){ dot(P.c7p,6,'#b2ff59'); label(P.c7p,'C7後','#b2ff59'); }
  if(P.c7a&&P.c7p) line(P.c7a,P.c7p,'#b2ff59',2);

  // 計測補助線
  if(res){
    // s1Mid dot + S1 normal: s1a+s1p で解放
    dot(res.s1Mid,5,'#fff');
    const end={x:res.s1Mid.x+res.s1Normal.x*180*k, y:res.s1Mid.y+res.s1Normal.y*180*k};
    line(res.s1Mid,end,'#fff',2);

    // hipAxis + PT line: femL+femR 追加後に解放
    if(res.hipAxis){
      dot(res.hipAxis,5,'#ab47bc');
      line(res.hipAxis,res.s1Mid,'#ab47bc',2);
    }

    if(res.c7Mid&&P.s1p){
      line(res.c7Mid,{x:res.c7Mid.x,y:P.s1p.y},'#b2ff59',2.5);
      dashed(g,map,{x:P.s1p.x,y:P.s1p.y},{x:res.c7Mid.x,y:P.s1p.y},'#b2ff59',1.5,k);
      const lab = res.svaMm!=null? `SVA ${res.svaMm.toFixed(1)}mm`:`SVA ${res.svaPx.toFixed(1)}px`;
      label({x:(P.s1p.x+res.c7Mid.x)/2,y:P.s1p.y}, lab, '#b2ff59', 0, 16);
    }
  }

  // アクティブ点ハイライト
  if(state.active&&P[state.active]) ring(P[state.active], 11*k, '#fff', 2);
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
