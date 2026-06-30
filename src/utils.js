//==================================================================
// 汎用ユーティリティ（時刻・ファイル名・ダウンロード）
//==================================================================
export function timestamp(){
  const n=new Date(), p=(v,l=2)=>String(v).padStart(l,'0');
  return `${p(n.getFullYear(),4)}-${p(n.getMonth()+1)}-${p(n.getDate())} `+
         `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
}
export function fileStamp(){
  const n=new Date(), p=(v,l=2)=>String(v).padStart(l,'0');
  return `${p(n.getFullYear(),4)}${p(n.getMonth()+1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
}
export const csvEsc = v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
export function download(blob, name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
export function deriveId(name){ return name.replace(/\.[^.]+$/,''); }
