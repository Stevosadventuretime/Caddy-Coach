const fs=require('fs'),vm=require('vm');const ctx={THREE:null,console};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2]||'drillstudio.js','utf8'),ctx);vm.runInContext(fs.readFileSync('drills.js','utf8'),ctx);
const D=ctx.DrillStudio,L=ctx.DRILL_LIBRARY;D.setSwing(JSON.parse(fs.readFileSync('swing-model.json','utf8')));
const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(...a);
const bad={};
for(const dr of L){D.prep(dr);for(let k=0;k<=400;k++){const t=dr._dur*k/400,J=D.jointsAt(dr,t);const i=D.sampleAt(dr,t).i;
 const probs=[];
 for(const [s,h,n] of [[J.ls,J.lh,'lead'],[J.ts,J.th,'trail']]){const r=len(sub(h,s));if(r>0.6)probs.push(n+' arm stretched '+r.toFixed(2));
  if(dot(sub(h,J.pel),J.F)<-0.12)probs.push(n+' hand behind body '+dot(sub(h,J.pel),J.F).toFixed(2))}
 for(const p of probs){const key=dr.id+' key'+i+' '+p.split(' ').slice(0,3).join(' ');bad[key]=bad[key]||p}}}
console.log(Object.entries(bad).map(e=>e[0]+' | '+e[1]).join('\n')||'none')
