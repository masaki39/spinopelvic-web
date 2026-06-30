//==================================================================
// 幾何ユーティリティ（Flutter版 main.dart:800-883 の厳密移植）
//==================================================================
export const G = {
  midpoint:(a,b)=>({x:(a.x+b.x)/2, y:(a.y+b.y)/2}),
  distance:(a,b)=>Math.hypot(a.x-b.x, a.y-b.y),
  acuteAngle(v1,v2){
    const n1=Math.hypot(v1.x,v1.y), n2=Math.hypot(v2.x,v2.y);
    if(n1===0||n2===0) return 0;
    let c=(v1.x*v2.x+v1.y*v2.y)/(n1*n2);
    c=Math.min(1,Math.max(-1,c));
    let a=Math.acos(c)*180/Math.PI;
    if(a>90) a=180-a;
    return a;
  },
  lineAngle:(a,b)=>Math.atan2(b.y-a.y, b.x-a.x)*180/Math.PI,
  normAngle180(a){ while(a<=-180)a+=360; while(a>180)a-=360; return a; },
  cobbAngle(p1,p2,p3,p4){
    const a1=G.lineAngle(p1,p2), a2=G.lineAngle(p3,p4);
    let d=Math.abs(G.normAngle180(a1-a2));
    if(d>180) d=360-d;
    if(d>90)  d=180-d;
    return d;
  },
};
