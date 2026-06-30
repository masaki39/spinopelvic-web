import { G } from './geometry.js';
import { timestamp } from './utils.js';

//==================================================================
// プリセット（汎用化の核：ランドマーク・計測・描画・CSVを内包）
//==================================================================
export const SPINOPELVIC = {
  id:'spinopelvic',
  required:['femL','femR','s1a','s1p','l1a','l1p'],
  steps:[
    {id:'femL', label:'左大腿骨頭中心', color:'#ff5252'},
    {id:'femR', label:'右大腿骨頭中心', color:'#ff5252'},
    {id:'s1a',  label:'S1 前縁',       color:'#ffeb3b'},
    {id:'s1p',  label:'S1 後縁',       color:'#ffeb3b'},
    {id:'l1a',  label:'L1 前縁',       color:'#ff9800'},
    {id:'l1p',  label:'L1 後縁',       color:'#ff9800'},
    {id:'c7a',  label:'C7 前縁',       color:'#b2ff59', optional:true},
    {id:'c7p',  label:'C7 後縁',       color:'#b2ff59', optional:true},
  ],
  metrics:[
    {key:'PI', unit:'°'}, {key:'PT', unit:'°'},
    {key:'SS', unit:'°'}, {key:'LL', unit:'°'},
  ],
  compute(P, pxPerMm){
    if(!(P.femL&&P.femR&&P.s1a&&P.s1p&&P.l1a&&P.l1p)) return null;
    const hipAxis=G.midpoint(P.femL,P.femR);
    const s1Mid=G.midpoint(P.s1a,P.s1p);
    const s1Vec={x:P.s1p.x-P.s1a.x, y:P.s1p.y-P.s1a.y};
    let n={x:-s1Vec.y, y:s1Vec.x};
    const nn=Math.hypot(n.x,n.y);
    if(nn>0) n={x:n.x/nn, y:n.y/nn};
    if(n.y<0) n={x:-n.x, y:-n.y};
    const pelvis={x:hipAxis.x-s1Mid.x, y:hipAxis.y-s1Mid.y};
    const PI=G.acuteAngle(pelvis, n);
    const PT=G.acuteAngle(pelvis, {x:0,y:-1});
    const SS=G.acuteAngle(s1Vec, {x:1,y:0});
    const LL=G.cobbAngle(P.l1a,P.l1p,P.s1a,P.s1p);
    let svaPx=null, svaMm=null, c7Mid=null;
    if(P.c7a&&P.c7p){
      c7Mid=G.midpoint(P.c7a,P.c7p);
      svaPx=c7Mid.x-P.s1p.x;
      if(pxPerMm&&pxPerMm>0) svaMm=svaPx/pxPerMm;
    }
    return {PI,PT,SS,LL,svaPx,svaMm,hipAxis,s1Mid,s1Normal:n,c7Mid};
  },
  csvColumns:[
    'patient_id','image_name','saved_at',
    'PI_deg','PT_deg','SS_deg','LL_deg','SVA_px','SVA_mm',
    'scale_px_per_mm','scale_real_mm',
    'scale_p1_x','scale_p1_y','scale_p2_x','scale_p2_y',
    'left_femoral_x','left_femoral_y','right_femoral_x','right_femoral_y',
    'common_femoral_radius',
    'S1_anterior_x','S1_anterior_y','S1_posterior_x','S1_posterior_y',
    'L1_anterior_x','L1_anterior_y','L1_posterior_x','L1_posterior_y',
    'C7_anterior_x','C7_anterior_y','C7_posterior_x','C7_posterior_y',
  ],
  csvRow(st, res){
    const f=(v,d=2)=>(v==null||Number.isNaN(v))?'':(+v).toFixed(d);
    const P=st.points, sc=st.scale;
    return [
      st.caseId, st.currentName||'', timestamp(),
      f(res.PI),f(res.PT),f(res.SS),f(res.LL),f(res.svaPx),f(res.svaMm),
      f(sc.pxPerMm,4),f(sc.realMm),
      f(sc.p1&&sc.p1.x),f(sc.p1&&sc.p1.y),f(sc.p2&&sc.p2.x),f(sc.p2&&sc.p2.y),
      f(P.femL&&P.femL.x),f(P.femL&&P.femL.y),f(P.femR&&P.femR.x),f(P.femR&&P.femR.y),
      f(st.radius),
      f(P.s1a&&P.s1a.x),f(P.s1a&&P.s1a.y),f(P.s1p&&P.s1p.x),f(P.s1p&&P.s1p.y),
      f(P.l1a&&P.l1a.x),f(P.l1a&&P.l1a.y),f(P.l1p&&P.l1p.x),f(P.l1p&&P.l1p.y),
      f(P.c7a&&P.c7a.x),f(P.c7a&&P.c7a.y),f(P.c7p&&P.c7p.x),f(P.c7p&&P.c7p.y),
    ];
  },
};
