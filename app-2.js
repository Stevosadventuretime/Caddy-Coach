
// ---------- Green finder: spots putting greens on satellite imagery and works out which hole each belongs to ----------
// gfAnalyse looks at raw pixels; gfRoute ties the greens it finds to hole numbers using the scorecard yardages.
function gfAnalyse(px,W,H,mpp,poly){
 // 1. per-pixel colour and fine texture at full resolution, then 2x2 cells (~1.4 m at zoom 17 in the UK)
 const cw=W>>1,ch=H>>1,N=cw*ch,cm=mpp*2;
 const L=new Float32Array(W*H);for(let i=0,j=0;i<W*H;i++,j+=4)L[i]=(px[j]+px[j+1]+px[j+2])/3;
 const cL=new Float32Array(N),cE=new Float32Array(N),cT=new Float32Array(N),cR=new Float32Array(N),cB=new Float32Array(N);
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){let sl=0,se=0,sr=0,sb=0,st=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const X=2*x+dx,Y=2*y+dy,i=Y*W+X,j=i*4;const r=px[j],g=px[j+1],b=px[j+2];sl+=L[i];se+=2*g-r-b;sr+=r;sb+=b;
   // fine texture: difference from the 4 neighbours
   const xl=X>0?i-1:i,xr=X<W-1?i+1:i,yu=Y>0?i-W:i,yd=Y<H-1?i+W:i;st+=Math.abs(4*L[i]-L[xl]-L[xr]-L[yu]-L[yd])/4}
  const k=y*cw+x;cL[k]=sl/4;cE[k]=se/4;cT[k]=st/4;cR[k]=sr/4;cB[k]=sb/4}
 const grass=new Uint8Array(N),sand=new Uint8Array(N),dark=new Uint8Array(N),ins=new Uint8Array(N);
 // only look inside the course boundary (scanline fill of the outline, padded a little), or everywhere if there isn't one
 if(poly&&poly.length>2){for(let y=0;y<ch;y++){const Y=y*2+1,xs=[];for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>Y)!==(b[1]>Y))xs.push((a[0]+(Y-a[1])*(b[0]-a[0])/(b[1]-a[1]))/2)}
   xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const x0=Math.max(0,Math.floor(xs[i])),x1=Math.min(cw-1,Math.ceil(xs[i+1]));for(let x=x0;x<=x1;x++)ins[y*cw+x]=1}}
  // pad by ~20 m so greens on the edge of the outline still count
  const pad=Math.round(20/cm);for(let it=0;it<pad;it++){const c2=ins.slice();for(let k=0;k<N;k++)if(!c2[k]){const x=k%cw;if((x>0&&c2[k-1])||(x<cw-1&&c2[k+1])||(k>=cw&&c2[k-cw])||(k<N-cw&&c2[k+cw]))ins[k]=1}}}
 else ins.fill(1);
 for(let k=0;k<N;k++){const l=cL[k],e=cE[k],r=cR[k],b=cB[k];
  grass[k]=e>5&&l>38&&l<210?1:0;
  sand[k]=(l>150&&e<14&&r-b>4)||(l>190&&e<10)?1:0;
  dark[k]=l<52?1:0}
 // adaptive texture scale: what "smooth" means depends on the imagery
 const tg=[];for(let k=0;k<N;k+=7)if(grass[k]&&ins[k])tg.push(cT[k]);tg.sort((a,b)=>a-b);
 const q=f=>tg.length?tg[Math.min(tg.length-1,Math.floor(tg.length*f))]:4;const tLo=q(.3),tMid=q(.5),tHi=Math.max(q(.8),tMid+1);
 const smooth=new Uint8Array(N);for(let k=0;k<N;k++)smooth[k]=grass[k]&&cT[k]<=tMid?1:0;
 // 2. integral images for fast box sums
 const integ=a=>{const I=new Float64Array((cw+1)*(ch+1));for(let y=0;y<ch;y++){let s=0;for(let x=0;x<cw;x++){s+=a[y*cw+x];I[(y+1)*(cw+1)+x+1]=I[y*(cw+1)+x+1]+s}}return I};
 const L2=new Float32Array(N);for(let k=0;k<N;k++)L2[k]=cL[k]*cL[k];
 const IG=integ(grass),IS=integ(sand),ID=integ(dark),IM=integ(smooth),IT=integ(cT),IL=integ(cL),IL2=integ(L2),IE=integ(cE);
 const box=(I,x0,y0,x1,y1)=>{x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(cw,x1);y1=Math.min(ch,y1);if(x1<=x0||y1<=y0)return[0,0];const w=cw+1;return[I[y1*w+x1]-I[y0*w+x1]-I[y1*w+x0]+I[y0*w+x0],(x1-x0)*(y1-y0)]};
 const mean=(I,x,y,r)=>{const[s,n]=box(I,x-r,y-r,x+r+1,y+r+1);return n?s/n:0};
 const ring=(I,x,y,r0,r1)=>{const[s1,n1]=box(I,x-r1,y-r1,x+r1+1,y+r1+1),[s0,n0]=box(I,x-r0,y-r0,x+r0+1,y+r0+1);return n1-n0>0?(s1-s0)/(n1-n0):0};
 const rc=Math.max(3,Math.round(7/cm)),r1=Math.round(13/cm),r2=Math.round(24/cm),rb=Math.round(34/cm),arm=Math.round(9/cm);
 // 3. score every few metres: a smooth, even, grassy core that stands out from what's around it, often with sand nearby
 const step=Math.max(1,Math.round(2.5/cm)),gw=Math.ceil(cw/step),gh=Math.ceil(ch/step),S=new Float32Array(gw*gh).fill(-9);
 for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){const x=gx*step,y=gy*step;if(x<r2||y<r2||x>=cw-r2||y>=ch-r2||!ins[y*cw+x])continue;
  const fg=mean(IG,x,y,rc);if(fg<.93)continue;const fm=mean(IM,x,y,rc);if(fm<.7)continue;
  const lc=mean(IL,x,y,rc),sd=Math.sqrt(Math.max(0,mean(IL2,x,y,rc)-lc*lc)),tc=mean(IT,x,y,rc);
  const tR=ring(IT,x,y,r1,r2),lR=ring(IL,x,y,r1,r2),mR=ring(IM,x,y,r1,r2),dR=ring(ID,x,y,r1,r2),sR=ring(IS,x,y,rc,rb);
  // a green is an island: count which directions stay just as smooth further out (a fairway runs on in two)
  let arms=0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,-.7],[.7,-.7],[-.7,.7]]){const ax=Math.round(x+dx*(r1+arm)),ay=Math.round(y+dy*(r1+arm));if(mean(IM,ax,ay,Math.round(arm*.6))>.75&&Math.abs(mean(IL,ax,ay,Math.round(arm*.6))-lc)<9)arms++}
  let s=1.4*Math.max(-1,Math.min(1,(tR-tc)/(tR+1)))+.5*(1-mR)-sd/14+Math.max(-.6,Math.min(.8,(lc-lR)/25))+Math.min(1,sR*7)*.9+Math.min(.5,dR)*.4-Math.max(0,arms-3)*.35-(tc>tHi?1:0);
  S[gy*gw+gx]=s}
 // 4. keep the strongest peaks, at least ~40 m apart
 const peaks=[],nms=Math.round(40/(cm*step));
 for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){const v=S[gy*gw+gx];if(v<.6)continue;let top=true;
  for(let yy=Math.max(0,gy-nms);yy<=Math.min(gh-1,gy+nms)&&top;yy++)for(let xx=Math.max(0,gx-nms);xx<=Math.min(gw-1,gx+nms);xx++){const u=S[yy*gw+xx];if(u>v||(u===v&&yy*gw+xx<gy*gw+gx)){if((xx-gx)**2+(yy-gy)**2<=nms*nms){top=false;break}}}
  if(top)peaks.push({x:gx*step,y:gy*step,s:v})}
 peaks.sort((a,b)=>b.s-a.s);
 // 5. grow each peak into its green shape and take the middle of that shape
 const out=[],maxR=Math.round(26/cm),seen=new Uint8Array(N);
 for(const p of peaks.slice(0,90)){const k0=p.y*cw+p.x,sl=mean(IL,p.x,p.y,2),se=mean(IE,p.x,p.y,2);
  const st=[k0],reg=[];const mark=new Set([k0]);
  while(st.length&&reg.length<8000){const k=st.pop();reg.push(k);const x=k%cw,y=(k/cw)|0;
   for(const n of[k-1,k+1,k-cw,k+cw]){if(n<0||n>=N||mark.has(n))continue;const nx=n%cw,ny=(n/cw)|0;if(Math.abs(nx-x)>1)continue;
    if((nx-p.x)**2+(ny-p.y)**2>maxR*maxR)continue;if(!grass[n]||cT[n]>tHi||Math.abs(cL[n]-sl)>11||Math.abs(cE[n]-se)>12)continue;mark.add(n);st.push(n)}}
  const area=reg.length*cm*cm;if(area<160||area>2000)continue;
  let sx=0,sy=0,ov=0;for(const k of reg){sx+=k%cw;sy+=(k/cw)|0;if(seen[k])ov++}if(ov>reg.length*.3)continue;reg.forEach(k=>seen[k]=1);
  const mx=sx/reg.length,my=sy/reg.length;
  // shape: greens are roundish; a long thin strip is a tee or a path
  let a=0,b=0,c=0;for(const k of reg){const dx=k%cw-mx,dy=((k/cw)|0)-my;a+=dx*dx;b+=dx*dy;c+=dy*dy}a/=reg.length;b/=reg.length;c/=reg.length;
  const tr=a+c,det=a*c-b*b,l1=tr/2+Math.sqrt(Math.max(0,tr*tr/4-det)),l2=tr/2-Math.sqrt(Math.max(0,tr*tr/4-det)),elong=Math.sqrt(l1/Math.max(l2,.01));
  if(elong>2.6)continue;
  // outline (convex hull) for drawing and for "you're standing on it"
  const ptsH=[];for(const k of reg){const x=k%cw,y=(k/cw)|0;if(!mark.has(k-1)||!mark.has(k+1)||!mark.has(k-cw)||!mark.has(k+cw))ptsH.push([x,y])}
  const hull=gfHull(ptsH).map(([x,y])=>[x*2+1,y*2+1]);
  const sizeFit=area>=280&&area<=1100?.4:0;
  out.push({x:mx*2+1,y:my*2+1,area:Math.round(area),score:+(p.s+sizeFit-(elong-1)*.25).toFixed(3),hull})}
 // fairway test: how much of a straight line runs over smooth, mown grass (cells of ~4 m)
 // mown grass for the fairway test: smoother than most of the course (rough is the bulk of it)
 const tF=q(.22),fm=new Uint8Array(N);for(let k=0;k<N;k++)fm[k]=grass[k]&&cT[k]<=tF?1:0;const IF=integ(fm);
 const fc=Math.max(1,Math.round(4/cm)),fw=Math.ceil(cw/fc),fh=Math.ceil(ch/fc),F=new Uint8Array(fw*fh);
 for(let y=0;y<fh;y++)for(let x=0;x<fw;x++)F[y*fw+x]=mean(IF,x*fc+(fc>>1),y*fc+(fc>>1),fc>>1)>.6?1:0;
 return{cands:out.sort((a,b)=>b.score-a.score),grid:{F,fw,fh,cell:fc*2,mpp,ox:0,oy:0}}}
// fairway test: how much of a straight line (30-92% of the way) runs over smooth, mown grass
function gfFair(G,a,b){const n=24;let s=0;for(let i=0;i<n;i++){const f=.3+.62*i/(n-1),x=(a.x+(b.x-a.x)*f-G.ox)/G.cell,y=(a.y+(b.y-a.y)*f-G.oy)/G.cell;
  let m=0;for(const[dx,dy]of[[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const X=Math.round(x)+dx*2,Y=Math.round(y)+dy*2;if(X>=0&&Y>=0&&X<G.fw&&Y<G.fh&&G.F[Y*G.fw+X])m=1}s+=m}return s/n}
// does mown grass carry on past the green along the line of play? (then it's probably mid-fairway, or the wrong way round)
function gfPast(G,a,b){const L=Math.hypot(b.x-a.x,b.y-a.y)||1,ux=(b.x-a.x)/L,uy=(b.y-a.y)/L;let s=0,n=0;for(let m=26;m<=60;m+=4){const X=Math.round((b.x+ux*m/G.mpp-G.ox)/G.cell),Y=Math.round((b.y+uy*m/G.mpp-G.oy)/G.cell);n++;if(X>=0&&Y>=0&&X<G.fw&&Y<G.fh&&G.F[Y*G.fw+X])s++}return s/n}
function gfHull(p){if(p.length<4)return p;p=p.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lo=[],up=[];for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
 for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
 return lo.slice(0,-1).concat(up.slice(0,-1))}
// Which green is which hole: walk the course in order. Each hole's tee is near the last green,
// so the next green should sit about one hole-length (from the card) further on.
function gfRoute(cands,holes,start,dist,G){const fair=G&&((a,b)=>gfFair(G,a,b)),past=G&&((a,b)=>gfPast(G,a,b));
 const cross=(a,b,c,d)=>{const o=(p,q,r)=>Math.sign((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));return o(a,b,c)!==o(a,b,d)&&o(c,d,a)!==o(c,d,b)};
 const C=cands.length;if(!C)return{};const smax=Math.max(...cands.map(c=>c.score)),smin=Math.min(...cands.map(c=>c.score));
 const qual=c=>(c.score-smin)/((smax-smin)||1);
 const pen=(d,y,loose)=>{if(!y)return d<60||d>650?2:0;const M=y*.9144,lo=.8*M-(loose?110:45),hi=M+(loose?160:85);return d<lo?(lo-d)/35:d>hi?(d-hi)/35:0};
 // a green the picture missed can be skipped (at a cost), and the walk carries on from the last green found
 let beam=[{seq:[],cost:0,last:-1,slack:0}];
 for(let i=0;i<holes.length;i++){const h=holes[i],M=(h.yards||350)*.9144,nb=[];
  for(const st of beam){const used=new Set(st.seq);const prev=st.last>=0?cands[st.last]:start;
   nb.push({seq:st.seq.concat(-1),cost:st.cost+.9,last:st.last,slack:st.slack+M+60});
   for(let k=0;k<C;k++){if(used.has(k))continue;const c=cands[k];let cost=st.cost-qual(c)*1.1;
    if(prev){const d=dist(prev,c);if(st.slack){const hi=st.slack+M+90;cost+=d>hi?(d-hi)/35:d<40?1:0}else{cost+=pen(d,h.yards,st.last<0)*(st.last<0?.6:1);if(fair&&M>210)cost-=1.6*fair(prev,c);if(past)cost+=1.2*past(prev,c);
     // holes don't cross each other
     let xs=0;for(let j=1;j<st.seq.length;j++){const a=st.seq[j-1],b=st.seq[j];if(a<0||b<0||b===st.last)continue;if(cross(cands[a],cands[b],prev,c))xs++}cost+=xs*.9}}
    if(i===holes.length-1&&start)cost+=Math.max(0,dist(c,start)-380)/120;
    nb.push({seq:st.seq.concat(k),cost,last:k,slack:0})}}
  nb.sort((a,b)=>a.cost-b.cost);beam=nb.slice(0,400)}
 const best=beam[0],res={};const top=beam.slice(0,60);
 holes.forEach((h,i)=>{const k=best.seq[i];if(k<0)return;const agree=top.filter(s=>s.seq[i]===k).length/top.length;
  res[h.n]={k,conf:+Math.max(0,Math.min(1,agree)).toFixed(2)}});
 return res}
// Walk the course in order to find every hole's target: each tee is within ~80 m of the last green, and the
// green is the one about the card's length away with a fairway leading to it. Keeps the best 80 routes as it goes.
function gfChain(c,G,holes,start,mpp,cont,skip){if(!c.length)return[];const smax=Math.max(...c.map(k=>k.score)),smin=Math.min(...c.map(k=>k.score)),q=k=>(k.score-smin)/((smax-smin)||1);
 const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)*mpp;
 const ring=(p,first)=>{const T=[{x:p.x,y:p.y,o:0}];for(const r of first?[30,55,80,120,170,230]:[30,55,80])for(let a=0;a<12;a++)T.push({x:p.x+Math.cos(a*Math.PI/6)*r/mpp,y:p.y+Math.sin(a*Math.PI/6)*r/mpp,o:first?r/3:r});return T};
 let beam=[{seq:[],tees:[],s:0,prev:start}];
 for(let i=0;i<holes.length;i++){const h=holes[i],M=(h.yards||330)*.9144,nb=[];
  for(const st of beam){const used=new Set(st.seq.concat(skip||[])),F=i===0&&!cont,T=ring(st.prev,F);
   for(let k=0;k<c.length;k++){if(used.has(k))continue;const g=c[k];let best=-1e9,bt=null;
    // the first tee could be anywhere near the clubhouse, so try tees all the way round each green at the card distance
    const TT=F?Array.from({length:24},(_,a)=>({x:g.x+Math.cos(a*Math.PI/12)*.93*M/mpp,y:g.y+Math.sin(a*Math.PI/12)*.93*M/mpp,o:0})):T;
    for(const t of TT){const dd=d(t,g);if(dd<.6*M||dd>1.2*M+40)continue;const v=-Math.abs(dd-.93*M)/25+(M>210?1.5*gfFair(G,t,g):0)-gfPast(G,t,g)-(F?(start?d(t,start)/700:0):t.o/200);if(v>best){best=v;bt=t}}
    if(bt)nb.push({seq:st.seq.concat(k),tees:st.tees.concat([{x:bt.x,y:bt.y}]),s:st.s+best+.8*q(g),prev:g})}
   nb.push({seq:st.seq.concat(-1),tees:st.tees.concat([null]),s:st.s-2.5,prev:st.prev})}
  nb.sort((a,b)=>b.s-a.s);beam=nb.slice(0,80)}
 const b=beam[0];return holes.map((h,i)=>({n:h.n,k:b.seq[i],tee:b.tees[i]}))}
if(typeof module!=='undefined')module.exports={gfAnalyse,gfRoute,gfHull,gfFair,gfPast,gfChain};

// ---------- Using the green finder in the app (standalone only: Claude pages can't load satellite imagery) ----------
const GF={V:3,Z:17,busy:{},grids:{}};
const gfPx=(lat,lon)=>{const s=256*2**GF.Z,sn=Math.sin(lat*Math.PI/180);return{x:(lon+180)/360*s,y:(.5-Math.log((1+sn)/(1-sn))/(4*Math.PI))*s}};
const gfLL=(x,y)=>{const s=256*2**GF.Z,n=Math.PI-2*Math.PI*y/s;return{lat:180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n))),lon:x/s*360-180}};
const gfMpp=lat=>156543.03392*Math.cos(lat*Math.PI/180)/2**GF.Z;
// the course outline from the map, as points; null if it isn't mapped
async function gfOutline(course){
 // the club's own outline (the dashed line on the map) is already known from place search; it doesn't need OpenStreetMap's data service
 const st=course._site||await gpsSite(course).catch(()=>null);if(st&&st.poly&&st.poly.length>3)return st.poly.map(([lat,lon])=>({lat,lon}));
 try{const ref=course.osm||await osmFindRef(course);if(!ref)return null;course.osm=ref;
  const j=await OSM.q(`[out:json][timeout:15];${ref.type==='relation'?`relation(${ref.id});way(r)`:`way(${ref.id})`};out geom;`,15000);
  const pts=[];(j.elements||[]).forEach(e=>(e.geometry||[]).forEach(p=>pts.push(p)));if(pts.length<4)return null;
  const ws=(j.elements||[]).filter(e=>e.geometry);if(ws.length===1)return ws[0].geometry.map(p=>({lat:p.lat,lon:p.lon}));
  const P=pts.map(p=>{const q=gfPx(p.lat,p.lon);return[q.x,q.y]});return gfHull(P).map(([x,y])=>gfLL(x,y))}catch(_){return null}}
// where the walk round the course starts: the course's own point, unless that lies off the club's outline (then the outline's middle)
function gfStart(course,out){const p={lat:course.lat,lon:course.lon};if(!out||out.length<4||p.lat==null||inPoly(p,out))return p;
 const s=course._site;if(s&&s.lat!=null&&inPoly({lat:s.lat,lon:s.lon},out))return{lat:s.lat,lon:s.lon};return centroid(out)}
// stitch the satellite tiles for an area into one picture
async function gfImage(b,onTile){
 const tx0=Math.floor(b.x0/256),ty0=Math.floor(b.y0/256),tx1=Math.floor(b.x1/256),ty1=Math.floor(b.y1/256);
 const W=(tx1-tx0+1)*256,H=(ty1-ty0+1)*256,cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d',{willReadFrequently:true});
 const jobs=[];for(let y=ty0;y<=ty1;y++)for(let x=tx0;x<=tx1;x++)jobs.push([x,y]);let i=0,fail=0,done=0;
 const work=async()=>{while(i<jobs.length){const[x,y]=jobs[i++];
  try{const r=await fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${GF.Z}/${y}/${x}?cc=gf`,{mode:'cors'});if(!r.ok)throw new Error('HTTP '+r.status);
   const bm=await createImageBitmap(await r.blob());ctx.drawImage(bm,(x-tx0)*256,(y-ty0)*256);if(bm.close)bm.close()}catch(e){fail++}
  done++;onTile&&onTile(done,jobs.length)}};
 await Promise.all(Array.from({length:6},work));if(fail>jobs.length*.25)throw new Error('imagery');
 return{px:ctx.getImageData(0,0,W,H).data,W,H,ox:tx0*256,oy:ty0*256}}
// run the picture analysis off the main thread so the app stays responsive
function gfRun(img,mpp,poly){
 return new Promise(res=>{let w=null;
  try{const src=[gfAnalyse,gfHull].map(f=>f.toString()).join('\n')+'\nonmessage=e=>{const d=e.data;postMessage(gfAnalyse(d.px,d.W,d.H,d.mpp,d.poly))}';
   w=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
   w.onmessage=e=>{w.terminate();res(e.data)};w.onerror=()=>{w.terminate();res(gfAnalyse(img.px,img.W,img.H,mpp,poly))};
   w.postMessage({px:img.px,W:img.W,H:img.H,mpp,poly})}
  catch(_){if(w)w.terminate();res(gfAnalyse(img.px,img.W,img.H,mpp,poly))}})}
const gfB64=u8=>{let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return btoa(s)};
function gfGrid(gf){if(!gf||!gf.grid)return null;if(GF.grids[gf.t])return GF.grids[gf.t];const g=gf.grid,bin=atob(g.bits),F=new Uint8Array(g.fw*g.fh);
 for(let i=0;i<F.length;i++)F[i]=(bin.charCodeAt(i>>3)>>(i&7))&1;return GF.grids[gf.t]=Object.assign({},g,{F})}
// find the greens for a course and work out which hole each one is; runs once per course and is kept on the phone
async function gfFindGreens(course,holes,onStep){
 if(HOSTED_IN_CLAUDE||!course||course.lat==null)return null;const key=course.key;
 if(course.gf&&course.gf.v===GF.V)return course.gf;
 const kept=await KV.get('gf_'+key).catch(()=>null);if(kept&&kept.v===GF.V){course.gf=kept;return kept}
 if(GF.busy[key])return GF.busy[key];
 return GF.busy[key]=(async()=>{try{
  const say=t=>{GF.status=t;onStep&&onStep(t)};say('Finding the course outline…');
  const out=await gfOutline(course),s0=gfStart(course,out),c0=gfPx(s0.lat,s0.lon),mpp=gfMpp(course.lat),half=1100/mpp;
  let b;if(out){const P=out.map(p=>gfPx(p.lat,p.lon));b={x0:Math.min(...P.map(p=>p.x))-30/mpp,y0:Math.min(...P.map(p=>p.y))-30/mpp,x1:Math.max(...P.map(p=>p.x))+30/mpp,y1:Math.max(...P.map(p=>p.y))+30/mpp}}
  else b={x0:c0.x-half*.8,y0:c0.y-half*.8,x1:c0.x+half*.8,y1:c0.y+half*.8};
  // keep it to a sensible size (about 2.2 km across) around the club
  const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,hw=Math.min(half,(b.x1-b.x0)/2),hh=Math.min(half,(b.y1-b.y0)/2);b={x0:cx-hw,y0:cy-hh,x1:cx+hw,y1:cy+hh};
  say('Loading the satellite picture…');const img=await gfImage(b,(d,n)=>say(`Loading the satellite picture… ${Math.round(d/n*100)}%`));
  say('Looking for the greens…');
  const poly=out?out.map(p=>{const q=gfPx(p.lat,p.lon);return[q.x-img.ox,q.y-img.oy]}):null;
  const r=await gfRun(img,mpp,poly);
  const cands=r.cands.slice(0,60).map(c=>({x:c.x+img.ox,y:c.y+img.oy,score:c.score,area:c.area,hull:c.hull.map(([x,y])=>[x+img.ox,y+img.oy])}));
  const G=Object.assign({},r.grid,{ox:img.ox,oy:img.oy});
  const hs=(holes||((course.tees&&course.tees[0]&&course.tees[0].holes)||[])).map(h=>({n:h.n,yards:h.yards}));
  const route=hs.length&&cands.length?gfChain(cands,G,hs,c0,mpp):[];
  const smax=Math.max(...cands.map(c=>c.score),1),smin=Math.min(...cands.map(c=>c.score),0);
  const bits=new Uint8Array(Math.ceil(G.F.length/8));for(let i=0;i<G.F.length;i++)if(G.F[i])bits[i>>3]|=1<<(i&7);
  const gf={v:GF.V,t:Date.now(),mpp,outline:!!out,
   cands:cands.map(c=>{const ll=gfLL(c.x,c.y),st=Math.max(1,Math.floor(c.hull.length/14));return{lat:+ll.lat.toFixed(6),lon:+ll.lon.toFixed(6),q:+((c.score-smin)/((smax-smin)||1)).toFixed(2),m2:c.area,poly:c.hull.filter((_,i)=>i%st===0).map(([x,y])=>{const p=gfLL(x,y);return{lat:+p.lat.toFixed(6),lon:+p.lon.toFixed(6)}})}}),
   route:Object.fromEntries(route.map(v=>[v.n,{i:v.k,tee:v.tee?(t=>({lat:+t.lat.toFixed(6),lon:+t.lon.toFixed(6)}))(gfLL(v.tee.x,v.tee.y)):null}])),
   grid:{fw:G.fw,fh:G.fh,cell:G.cell,ox:G.ox,oy:G.oy,mpp:G.mpp,bits:gfB64(bits)}};
  await KV.set('gf_'+key,gf).catch(()=>{});course.gf=gf;GF.status='';return gf}
 catch(e){console.error(e);GF.status='';course.gf={v:GF.V,t:Date.now(),failed:String(e&&e.message||e),cands:[],route:{}};return null}
 finally{delete GF.busy[key]}})()}
// which green you're playing. Every hole has a target from walking the course in order; when you're on the tee,
// the target is re-checked from where you actually stand (about the card's length away, with a fairway leading to it),
// and once you head off down the hole it stays fixed.
// once a hole's green is known for sure (you saved it, or you've played to it), walk on from there to re-find the holes after it
function gfRechain(c,n,g){const gf=c&&c.gf;if(!gf||!gf.cands||!gf.cands.length||!gf.grid)return;const G=gfGrid(gf),T=(RT.live&&RT.live.course.key===c.key?RT.live.holes:(c.tees&&c.tees[0]&&c.tees[0].holes)||[]);
 const rest=T.filter(h=>h.n>n&&h.yards&&!(c.greens&&c.greens[h.n]&&!c.greens[h.n].learned));if(!rest.length)return;
 const ll5=x=>x.lat.toFixed(5)+','+x.lon.toFixed(5),taken=new Set(Object.values(c.greens||{}).map(ll5));taken.add(ll5(g));
 const P=gf.cands.map((k,i)=>Object.assign(gfPx(k.lat,k.lon),{score:k.q||0,i})),skip=P.filter(k=>taken.has(ll5(gf.cands[k.i]))).map(k=>k.i);
 const seq=[];let from=gfPx(g.lat,g.lon);for(const h of rest){if(seq.length&&seq[seq.length-1].n!==h.n-1)break;seq.push(h)}if(!seq.length||seq[0].n!==n+1)return;
 const r=gfChain(P,G,seq,from,gf.mpp,true,skip);r.forEach(v=>{gf.route[v.n]={i:v.k,tee:v.tee?(t=>({lat:+t.lat.toFixed(6),lon:+t.lon.toFixed(6)}))(gfLL(v.tee.x,v.tee.y)):null}});KV.set('gf_'+c.key,gf).catch(()=>{})}
const gfNear=(gf,p)=>gf.cands.some(g=>mBetween(p,g)<1500);
function gfPick(h){const c=GPS.course,gf=c&&c.gf;if(!gf||!gf.cands||!gf.cands.length)return null;
 GPS.pick=GPS.pick||{};GPS.teeSel=GPS.teeSel||{};const key=c.key+':'+h.n;if(GPS.pick[key])return GPS.pick[key];
 const ll5=g=>g.lat.toFixed(5)+','+g.lon.toFixed(5);
 const used=new Set(Object.entries(c.greens||{}).filter(([n])=>+n!==h.n).map(([,g])=>ll5(g)));
 Object.entries(GPS.pick).forEach(([k,g])=>{if(k!==key&&k.startsWith(c.key+':'))used.add(ll5(g))});
 const rt=gf.route&&gf.route[h.n],auto=rt&&rt.i>=0&&gf.cands[rt.i]&&!used.has(ll5(gf.cands[rt.i]))?gf.cands[rt.i]:null;
 const mk=(g,lock)=>{const r=Object.assign({},g,{likely:true,sat:true,auto:true});if(lock){GPS.pick[key]=r;setTimeout(()=>gfRechain(c,h.n,g),0)}return r};
 const G=gfGrid(gf),sel=GPS.teeSel[key];
 if(GPS.pos&&h.yards&&G){const here={lat:GPS.pos.lat,lon:GPS.pos.lng},M=h.yards*.9144;
  // you've set off down the hole towards the target you had on the tee: keep it for the rest of the hole
  if(sel&&mBetween(here,sel.from)>=60&&mBetween(here,sel.g)<=sel.d-50)return mk(sel.g,true);
  const pr=gf.route&&gf.route[h.n-1],prevG=(c.greens&&c.greens[h.n-1])||GPS.pick[c.key+':'+(h.n-1)]||(pr&&pr.i>=0?gf.cands[pr.i]:null);
  // near the start of the hole: where the round tracker first saw you on this hole, the last green, or the tee found on the map
  const st=TRK.hole===h.n&&TRK.start&&TRK.start[h.n];
  const atTee=(st&&mBetween(here,st)<150)||(rt&&rt.tee&&mBetween(here,rt.tee)<110)||(prevG&&mBetween(here,prevG)<130);
  if(atTee){const me=gfPx(here.lat,here.lon);let best=null,bs=-1e9;
   gf.cands.forEach(g=>{if(used.has(ll5(g)))return;const d=mBetween(here,g);if(d<.6*M||d>1.2*M+40)return;const q=gfPx(g.lat,g.lon);
    const v=-Math.abs(d-.93*M)/25+(M>210?1.5*gfFair(G,me,q):0)-gfPast(G,me,q)+.8*(g.q||0)+(g===auto?.6:0);if(v>bs){bs=v;best=g}});
   if(best){GPS.teeSel[key]={g:best,from:here,d:mBetween(here,best)};return mk(best)}}
  if(sel)return mk(sel.g)}
 return auto?mk(auto):null}
// the few greens that could be this hole's, for tapping when the finder isn't sure
function gfOptions(h){const c=GPS.course,gf=c&&c.gf;if(!gf||!gf.cands||!h.yards)return[];const pos=GPS.pos&&{lat:GPS.pos.lat,lon:GPS.pos.lng},from=pos&&gfNear(gf,pos)?pos:(c.greens&&c.greens[h.n-1]);if(!from)return[];
 const M=h.yards*.9144;return gf.cands.map(g=>({g,e:Math.abs(mBetween(from,g)-.92*M)})).filter(x=>x.e<Math.max(70,M*.25)).sort((a,b)=>a.e-b.e).slice(0,4).map(x=>x.g)}
async function gfEnsure(){const c=GPS.course;if(HOSTED_IN_CLAUDE||!c)return;if(c.gf&&!(c.gf.failed&&Date.now()-c.gf.t>60000))return;if(c.gf&&c.gf.failed)delete c.gf;
 if(c.greenPool&&c.greenPool.length>=Math.min(9,((c.tees&&c.tees[0]&&c.tees[0].holes)||[]).length))return;// the map already has this course's greens
 const holes=RT.live&&RT.live.course.key===c.key?RT.live.holes:null;
 const gf=await gfFindGreens(c,holes,()=>{if(!$('gpsOv').hidden)gpsPanel()});
 if(GPS.course===c&&!$('gpsOv').hidden){gpsDrawHole(true);if(gf&&gf.cands.length)gpsNote(`Found ${gf.cands.length} greens on the satellite map.`)}}

// ---------- Course mapping, the way TheGrint and 18Birdies do it ----------
// Their distances come from a map of each hole made once in advance: the tee, then the front, middle and back of the green.
// Here you (or anyone) map a course once on the satellite picture, hole by hole; it's saved, can be shared, and every round after that is automatic.
const CM_PREFIX='CCMAP1:';
const cmM=(lat)=>({ky:111320,kx:111320*Math.cos(lat*Math.PI/180)});
function cmFB(tee,c,poly){// front and back of the green along the line from the tee
 const k=cmM(c.lat),dx=(c.lon-tee.lon)*k.kx,dy=(c.lat-tee.lat)*k.ky,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
 const at=m=>({lat:+(c.lat+uy*m/k.ky).toFixed(6),lon:+(c.lon+ux*m/k.kx).toFixed(6)});
 if(poly&&poly.length>2&&inPoly(c,poly)){let f=0,b=0;while(f<35&&inPoly(at(-(f+.5)),poly))f+=.5;while(b<35&&inPoly(at(b+.5),poly))b+=.5;
  if(f>=3&&b>=3&&f<35&&b<35)return{front:at(-f),back:at(b),est:false}}
 return{front:at(-12),back:at(12),est:true}}
function cmHoleData(c,n){const g=c&&c.greens&&c.greens[n];return g||null}
// a satellite-found green that fits this tee and the card yardage, to save a tap
function cmSuggest(tee,h){const c=GPS.course,gf=c&&c.gf;if(!gf||!gf.cands||!gf.cands.length||!tee)return null;const M=(h.yards||0)*.9144,G=gfGrid(gf),me=gfPx(tee.lat,tee.lon);
 const used=new Set(Object.entries(c.greens||{}).filter(([n])=>+n!==h.n).map(([,g])=>g.lat.toFixed(5)+','+g.lon.toFixed(5)));
 const sc=gf.cands.filter(g=>!used.has(g.lat.toFixed(5)+','+g.lon.toFixed(5))).map(g=>{const d=mBetween(tee,g),q=gfPx(g.lat,g.lon);
  const s=M?(-Math.abs(d-.93*M)/25+g.q*.8+(G&&M>210?1.5*gfFair(G,me,q):0)-(G?gfPast(G,me,q):0)):g.q;return{g,s,d}}).filter(x=>!M||(x.d>.7*M&&x.d<1.12*M+20)).sort((a,b)=>b.s-a.s);
 return sc[0]?sc[0].g:null}
function cmOpen(){GPS.cm={intro:true};GPS.setMode=false;GPS.tap=null;gpsDrawLines();cmDraw();gpsPanel()}
function cmPrefill(){const cm=GPS.cm,c=GPS.course,gf=c&&c.gf;if(!cm||cm.step!=='tee')return;const have=cmHoleData(c,cm.n);
 if(have&&have.tee){cm.tee=have.tee;cm.green={lat:have.lat,lon:have.lon};cm.gf=have.front||null;cm.gb=have.back||null;cm.fbEst=!!have.fbEst;cm.fair=have.fair||null;cm.step='check';cm.auto=false;return}
 const rt=gf&&gf.route&&gf.route[cm.n],g=rt&&rt.i>=0&&gf.cands[rt.i];if(rt&&rt.tee&&g){cm.tee=rt.tee;cm.green={lat:g.lat,lon:g.lon};cm.poly=g.poly||null;cm.step='check';cm.auto=true}}
function cmBegin(){const r=RT.live;GPS.cm={n:r.holes[r.i].n,step:'tee',back:r.i,done:0};cmPrefill();cmFrame();cmDraw();gpsPanel()}
function cmGo(i){const r=RT.live;r.i=Math.max(0,Math.min(r.holes.length-1,i));rtSaveLive();const h=r.holes[r.i];GPS.cm={n:h.n,step:'tee',back:GPS.cm.back,done:GPS.cm.done};cmPrefill();GPS.framed=false;gpsTop();cmFrame();cmDraw();gpsPanel()}
function cmFrame(){const L=window.L,c=GPS.course,cm=GPS.cm;if(!GPS.map||!cm||cm.intro)return;if(cm.tee&&cm.green){GPS.map.fitBounds(L.latLngBounds([[cm.tee.lat,cm.tee.lon],[cm.green.lat,cm.green.lon]]).pad(.3),{maxZoom:18,animate:false});return}const g=cmHoleData(c,cm.n);
 if(g&&g.tee){GPS.map.fitBounds(L.latLngBounds([[g.tee.lat,g.tee.lon],[g.lat,g.lon]]).pad(.3),{maxZoom:18});return}
 if(GPS.pos&&gpsOnSite()){GPS.map.setView([GPS.pos.lat,GPS.pos.lng],18);return}
 const prev=cmHoleData(c,cm.n-1);if(prev){GPS.map.setView([prev.lat,prev.lon],17);return}
 gpsFrameSite()}
function cmTap(ll){const cm=GPS.cm;if(!cm||cm.intro)return;const p={lat:+ll.lat.toFixed(6),lon:+ll.lng.toFixed(6)},h=gpsHole();
 if(cm.step==='tee'){cm.tee=p;cm.step='green';cm.sug=cmSuggest(p,h);if(cm.sug)GPS.map.fitBounds(window.L.latLngBounds([[p.lat,p.lon],[cm.sug.lat,cm.sug.lon]]).pad(.25),{maxZoom:18,animate:false})}
 else if(cm.step==='front'){cm.gf=p;cm.fbEst=false;cm.step='back'}
 else if(cm.step==='back'){cm.gb=p;cm.fbEst=false;cm.step=cmWantsFair()?'fair':'check'}
 else if(cm.step==='fair'){cm.fair=p;cm.step='check'}
 else{cm.green=p;cm.poly=null;const gf=GPS.course&&GPS.course.gf;if(gf&&gf.cands){const near=gf.cands.find(g=>g.poly&&inPoly(p,g.poly));if(near)cm.poly=near.poly}cm.gf=cm.gb=null;cm.step='front'}
 cmDraw();gpsPanel()}
// like TheGrint: par 4s and 5s get a fairway target (where a good drive finishes, or the corner of a dogleg)
const cmWantsFair=()=>{const h=gpsHole();return !!h&&(h.par||4)>=4};
// front and back still to be set: use the green's outline, or 12 m either side of the middle along the line from the tee
function cmUseFB(){const cm=GPS.cm;if(!cm||!cm.tee||!cm.green)return;const fb=cmFB(cm.tee,cm.green,cm.poly);
 if(cm.step==='back'&&cm.gf){const m=cm.green;cm.gb={lat:+(2*m.lat-cm.gf.lat).toFixed(6),lon:+(2*m.lon-cm.gf.lon).toFixed(6)};cm.fbEst=true}
 else{cm.gf=fb.front;cm.gb=fb.back;cm.fbEst=fb.est}
 cm.step=cmWantsFair()&&!cm.fair?'fair':'check';cmDraw();gpsPanel()}
// standing on the spot: use the phone's position
const cmCanHere=()=>!!(GPS.pos&&gpsOnSite()&&(GPS.pos.acc||0)<=15);
function cmUseSug(){const cm=GPS.cm;if(!cm||!cm.sug)return;cm.green={lat:cm.sug.lat,lon:cm.sug.lon};cm.poly=cm.sug.poly||null;cm.gf=cm.gb=null;cm.step='front';cmDraw();gpsPanel()}
async function cmSave(){const cm=GPS.cm,c=GPS.course;if(!cm||!cm.tee||!cm.green)return;const fb=cm.gf&&cm.gb?{front:cm.gf,back:cm.gb,est:!!cm.fbEst}:cmFB(cm.tee,cm.green,cm.poly);
 c.greens=c.greens||{};c.greens[cm.n]={lat:cm.green.lat,lon:cm.green.lon,tee:cm.tee,front:fb.front,back:fb.back,mapped:1};if(fb.est)c.greens[cm.n].fbEst=1;if(cm.fair)c.greens[cm.n].fair=cm.fair;sbShareHole(c,cm.n,c.greens[cm.n],'mapped');
 if(GPS.pick)delete GPS.pick[c.key+':'+cm.n];cm.done++;if(!cm.auto)gfRechain(c,cm.n,c.greens[cm.n]);try{await RStore.saveCourse(c)}catch(e){console.error(e)}
 const r=RT.live;if(r.i<r.holes.length-1)return cmGo(r.i+1);lsSet('cc_homemap_'+sbKey(c),{done:Date.now()});GPS.cm={finished:true,back:cm.back,done:cm.done};cmDraw();gpsPanel()}
function cmEnd(){const cm=GPS.cm;GPS.cm=null;if(cm&&cm.back!=null){RT.live.i=cm.back;rtSaveLive();gpsTop()}if(GPS.cmL){GPS.map.removeLayer(GPS.cmL);GPS.cmL=null}GPS.framed=false;gpsDrawHole(true)}
function cmDraw(){const L=window.L;if(!GPS.map)return;if(GPS.cmL){GPS.map.removeLayer(GPS.cmL);GPS.cmL=null}const cm=GPS.cm;if(!cm||cm.intro||cm.finished)return;
 GPS.cmL=L.layerGroup().addTo(GPS.map);if(GPS.green){GPS.map.removeLayer(GPS.green);GPS.green=null}if(GPS.gOut){GPS.map.removeLayer(GPS.gOut);GPS.gOut=null}if(GPS.poolL){GPS.map.removeLayer(GPS.poolL);GPS.poolL=null}GPS.lines&&GPS.lines.clearLayers();
 const dot=(p,cls,txt)=>L.marker([p.lat,p.lon],{icon:L.divIcon({className:'cmPt '+cls,html:`<i>${txt||''}</i>`,iconSize:[26,26]}),interactive:false,keyboard:false}).addTo(GPS.cmL);
 if(cm.tee)dot(cm.tee,'tee','T');
 if(cm.step==='green'&&cm.sug){L.polygon((cm.sug.poly||[]).map(p=>[p.lat,p.lon]),{color:'#fff',weight:1.5,dashArray:'3 4',fill:false,interactive:false}).addTo(GPS.cmL);dot(cm.sug,'sug','?')}
 if(cm.green){const est=cmFB(cm.tee,cm.green,cm.poly),fr=cm.gf||(cm.step==='check'?est.front:null),bk=cm.gb||(cm.step==='check'?est.back:null);if(cm.poly)L.polygon(cm.poly.map(p=>[p.lat,p.lon]),{color:'#fff',weight:1.5,fill:false,interactive:false}).addTo(GPS.cmL);
  const path=[[cm.tee.lat,cm.tee.lon]].concat(cm.fair?[[cm.fair.lat,cm.fair.lon]]:[],[[cm.green.lat,cm.green.lon]]);
  L.polyline(path,{color:'#fff',weight:2,dashArray:'6 7',interactive:false}).addTo(GPS.cmL);if(cm.fair)dot(cm.fair,'fw','');if(fr)dot(fr,'fb','F');dot(cm.green,'mid','');if(bk)dot(bk,'fb','B')}}
function cmPanel(p){const cm=GPS.cm,c=GPS.course,h=gpsHole(),r=RT.live,mapped=Object.values(c&&c.greens||{}).filter(g=>g.tee).length;
 if(cm.intro){p.innerHTML=`<div class="gpsDist"><span class="gpsK">Map this course</span><p class="gpsP">This is how TheGrint and 18Birdies get their distances: golfers map each hole once. For each hole you tap the back tee, the middle, front and back of the green, and on par 4s and 5s a fairway target. Caddy Coach suggests what it can from the satellite map, and if you're on the course you can use where you're standing. Once it's saved, every golfer here gets the distances.</p>
  ${mapped?`<p class="gpsP sm">${mapped} of ${r.holes.length} holes are mapped so far.</p>`:''}
  <div class="gpsActs"><button type="button" class="hrBtn" data-cm="begin">${mapped?'Carry on mapping':'Start mapping'}</button><button type="button" class="hrBtn ghost sm" data-cm="end">Cancel</button></div>
  <div class="gpsActs"><button type="button" class="hrBtn ghost sm" data-cm="paste">Add a shared map</button>${mapped?`<button type="button" class="hrBtn ghost sm" data-cm="share">Share this map</button>`:''}</div>
  ${cm.paste?`<label class="gpsP sm" for="cmCode">Paste the course map code</label><textarea id="cmCode" class="cmCode" rows="3" spellcheck="false"></textarea><div class="gpsActs"><button type="button" class="hrBtn sm" data-cm="import">Add map</button></div>`:''}
  ${cm.msg?`<p class="gpsP" role="status">${esc(cm.msg)}</p>`:''}<p class="gpsP sm" id="cmNet" role="status">${esc(sbNetText())}</p></div>`;if(SB.ok==null)sbCheck().then(()=>{const el=$('cmNet');if(el)el.textContent=sbNetText()});return}
 if(cm.finished){p.innerHTML=`<div class="gpsDist"><span class="gpsK">Course mapped</span><p class="gpsP">${mapped} of ${r.holes.length} holes have a tee and green saved. Front, middle and back distances now show on every hole. ${SB.ok===false?'It\'s saved on this phone and goes to the shared course map as soon as there\'s a connection.':'Every Caddy Coach golfer who plays here now gets these distances automatically.'} You can also share the map as a code.</p>
  <div class="gpsActs"><button type="button" class="hrBtn" data-cm="share">Share this map</button><button type="button" class="hrBtn ghost sm" data-cm="end">Done</button></div>${cm.msg?`<p class="gpsP" role="status">${esc(cm.msg)}</p>`:''}</div>`;return}
 const head=`<span class="gpsK">Mapping hole ${h.n} of ${r.holes.length}${h.yards?` · ${h.yards} yds on the card`:''}</span>`;
 const nav=`<div class="gpsActs"><button type="button" class="hrBtn ghost sm" data-cm="skip">${r.i<r.holes.length-1?'Skip hole':'Finish'}</button><button type="button" class="hrBtn ghost sm" data-cm="end">Stop mapping</button></div>`;
 const here=cmCanHere()?`<button type="button" class="hrBtn ghost sm" data-cm="here">I'm standing on it</button>`:'';
 if(cm.step==='tee'){p.innerHTML=`<div class="gpsDist">${head}<p class="gpsP">Tap the back tee (the one furthest from the green). Zoom in with two fingers; drag the map to find it.</p>${here?`<div class="gpsActs">${here}</div>`:''}${nav}</div>`;return}
 if(cm.step==='front'||cm.step==='back'){const out=!!cm.poly&&!cmFB(cm.tee,cm.green,cm.poly).est;
  p.innerHTML=`<div class="gpsDist">${head}<p class="gpsP">${cm.step==='front'?'Now tap the <b>front</b> edge of the green, the edge nearest the tee.':'And the <b>back</b> edge of the green, furthest from the tee.'}</p>
  <div class="gpsActs"><button type="button" class="hrBtn ghost sm" data-cm="usefb">${cm.step==='back'?'Same depth as the front':out?'Use the green\'s outline':'Estimate it for me'}</button>${here}<button type="button" class="hrBtn ghost sm" data-cm="regreen">Move the middle</button></div>${nav}</div>`;return}
 if(cm.step==='fair'){p.innerHTML=`<div class="gpsDist">${head}<p class="gpsP">Par ${h.par}: tap the middle of the fairway where a good drive finishes. On a dogleg, tap the corner. It gives golfers a target off the tee and a distance to it.</p>
  <div class="gpsActs"><button type="button" class="hrBtn ghost sm" data-cm="skipfair">Skip the fairway</button>${here}</div>${nav}</div>`;return}
 if(cm.step==='green'){const d=cm.sug?Math.round(mBetween(cm.tee,cm.sug)*1.09361):null;
  p.innerHTML=`<div class="gpsDist">${head}<p class="gpsP">Now tap the middle of the green.${cm.sug?` The dashed outline is the green Caddy Coach found on the satellite picture, ${d} yds from this tee.`:''}</p>
  <div class="gpsActs">${cm.sug?`<button type="button" class="hrBtn" data-cm="usesug">Use the green it found</button>`:''}${here}<button type="button" class="hrBtn ghost sm" data-cm="retee">Move the tee</button></div>${nav}</div>`;return}
 const d=Math.round(mBetween(cm.tee,cm.green)*1.09361),off=h.yards?d-h.yards:0,yd=(a,b)=>Math.round(mBetween(a,b)*1.09361);
 const fbq=cm.gf&&cm.gb?{front:cm.gf,back:cm.gb,est:!!cm.fbEst}:cmFB(cm.tee,cm.green,cm.poly);
 const extra=`<p class="gpsP sm">Front <b>${yd(cm.tee,fbq.front)}</b> · back <b>${yd(cm.tee,fbq.back)}</b> yds from the tee${fbq.est?' (estimated)':''}.${cm.fair?` Fairway target <b>${yd(cm.tee,cm.fair)}</b> yds from the tee, then <b>${yd(cm.fair,cm.green)}</b> to the middle.`:''}</p>`;
 p.innerHTML=`<div class="gpsDist">${head}${cm.auto?'<p class="gpsP">Caddy Coach found this hole on the satellite map: <b>T</b> is the tee and the red dot is the middle of the green. If they look right, save it.</p>':''}<p class="gpsP">Tee to the middle of the green: <b>${d} yds</b>${h.yards?` (card says ${h.yards}${Math.abs(off)>Math.max(25,h.yards*.12)?`; that's ${Math.abs(off)} yds ${off>0?'longer':'shorter'}, so check the tee and green, or it may be a dogleg`:''})`:''}.</p>${extra}
  <div class="gpsActs"><button type="button" class="hrBtn" data-cm="save">${r.i<r.holes.length-1?'Save and next hole':'Save and finish'}</button></div>
  <div class="gpsActs wrap"><button type="button" class="hrBtn ghost sm" data-cm="retee">Move the tee</button><button type="button" class="hrBtn ghost sm" data-cm="regreen">Move the green</button><button type="button" class="hrBtn ghost sm" data-cm="refb">Front and back</button>${cmWantsFair()?`<button type="button" class="hrBtn ghost sm" data-cm="refair">${cm.fair?'Move':'Add'} fairway target</button>`:''}</div>${nav}</div>`}
function cmCode(c){const h={};Object.entries(c.greens||{}).forEach(([n,g])=>{if(!g.tee)return;const f=v=>Math.round(v*1e6);h[n]=[f(g.tee.lat),f(g.tee.lon),f(g.lat),f(g.lon),f(g.front.lat),f(g.front.lon),f(g.back.lat),f(g.back.lon),g.fbEst?1:0].concat(g.fair?[f(g.fair.lat),f(g.fair.lon)]:[])});
 return CM_PREFIX+btoa(unescape(encodeURIComponent(JSON.stringify({k:c.key,n:c.name,h}))))}
function cmRead(code){const s=String(code||'').trim().replace(/\s+/g,'');if(!s.startsWith(CM_PREFIX))throw new Error('That isn\'t a Caddy Coach course map code.');
 const o=JSON.parse(decodeURIComponent(escape(atob(s.slice(CM_PREFIX.length)))));if(!o||!o.h)throw new Error('That code is incomplete.');
 const greens={};Object.entries(o.h).forEach(([n,a])=>{const f=v=>+(v/1e6).toFixed(6);if(!Array.isArray(a)||a.length<8)return;greens[n]={tee:{lat:f(a[0]),lon:f(a[1])},lat:f(a[2]),lon:f(a[3]),front:{lat:f(a[4]),lon:f(a[5])},back:{lat:f(a[6]),lon:f(a[7])},mapped:1};if(a[8])greens[n].fbEst=1;if(a.length>=11)greens[n].fair={lat:f(a[9]),lon:f(a[10])}});
 return{key:o.k,name:o.n,greens}}
async function cmShare(){const c=GPS.course,code=cmCode(c),txt=`Caddy Coach course map for ${c.name}:\n${code}`;
 try{if(navigator.share){await navigator.share({title:`${c.name} course map`,text:txt});GPS.cm.msg='Shared.';return gpsPanel()}}catch(e){if(e&&e.name==='AbortError')return}
 try{await navigator.clipboard.writeText(code);GPS.cm.msg='Copied. Paste it into a message to share it.'}catch(_){GPS.cm.msg='Copy this code: '+code}gpsPanel()}
async function cmImport(){const c=GPS.course,el=$('cmCode');try{const m=cmRead(el&&el.value);const kb=k=>String(k||'').replace(/-(golf-club|golf-course|golf-centre|gc|links)$/,'');
  if(m.key&&kb(m.key)!==kb(c.key))throw new Error(`That map is for ${m.name||'another course'}, not ${c.name}.`);
  const n=Object.keys(m.greens).length;if(!n)throw new Error('That code has no holes in it.');
  c.greens=Object.assign({},c.greens||{},m.greens);await RStore.saveCourse(c);GPS.pick={};GPS.cm={intro:true,msg:`Added the map for ${n} holes.`};gpsPanel()}
 catch(e){GPS.cm.msg=e.message||'That code didn\'t work.';gpsPanel()}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-cm]');if(!b)return;const a=b.dataset.cm,cm=GPS.cm;
 if(a==='open')return cmOpen();if(!cm)return;
 if(a==='begin')return cmBegin();if(a==='end')return cmEnd();
 if(a==='paste'){cm.paste=true;cm.msg='';gpsPanel();const t=$('cmCode');t&&t.focus();return}
 if(a==='import')return cmImport();if(a==='share')return cmShare();
 if(a==='usesug')return cmUseSug();if(a==='save')return cmSave();if(a==='usefb')return cmUseFB();
 if(a==='skipfair'){cm.fair=null;cm.step='check';cmDraw();return gpsPanel()}
 if(a==='refb'){cm.gf=cm.gb=null;cm.step='front';cmDraw();return gpsPanel()}
 if(a==='refair'){cm.fair=null;cm.step='fair';cmDraw();return gpsPanel()}
 if(a==='here'){if(GPS.pos)cmTap({lat:GPS.pos.lat,lng:GPS.pos.lng});return}
 if(a==='retee'){cm.step='tee';cm.tee=null;cm.green=null;cm.sug=null;cm.auto=false;cmDraw();return gpsPanel()}
 if(a==='regreen'){cm.step='green';cm.green=null;cm.poly=null;cm.gf=cm.gb=null;cm.auto=false;cm.sug=cmSuggest(cm.tee,gpsHole());cmDraw();return gpsPanel()}
 if(a==='skip'){const r=RT.live;if(r.i<r.holes.length-1)return cmGo(r.i+1);GPS.cm={finished:true,back:cm.back,done:cm.done};cmDraw();return gpsPanel()}});

// ---------- Shared course map (standalone app): greens and scorecards that golfers add reach everyone ----------
// Stored in Caddy Coach's own Supabase database. Entries are only ever added, never edited; for each hole the app
// uses the spot most golfers agree on, so one wrong entry is outvoted.
const SB={url:'https://dhrzscyirgvjwnvgdpqt.supabase.co',key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocnpzY3lpcmd2andudmdkcHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyODU4NDgsImV4cCI6MjEwNjg2MTg0OH0.uArg7__kFS0titgrRnmlc_wzYF-CI6q44CLpdaZWsiA',
 on:()=>!HOSTED_IN_CLAUDE,h(){const t=typeof Auth!=='undefined'&&Auth.tok();return{apikey:this.key,Authorization:'Bearer '+(t||this.key)}},
 device(){let d=lsGet('cc_device',null);if(!d){d=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)).replace(/-/g,'').slice(0,24);lsSet('cc_device',d)}return d}};
const sbKey=c=>keyBase(c&&c.key||'');
const sbN=v=>v==null?null:+(+v).toFixed(6);
async function sbPost(table,rows,again){
 try{if(typeof Auth!=='undefined'&&Auth.s)await Auth.fresh();const r=await fetch(`${SB.url}/rest/v1/${table}`,{method:'POST',headers:Object.assign(SB.h(),{'Content-Type':'application/json',Prefer:'return=minimal'}),body:JSON.stringify(rows)});
  if(r.ok){SB.ok=true;return true}const why=await r.text().catch(()=>'');
  if(r.status===401&&!again&&typeof Auth!=='undefined'&&Auth.s){try{await Auth.refresh();return sbPost(table,rows,true)}catch(_){}}
  // bad data is dropped; a setup problem (missing table, no permission) keeps it queued until it's fixed
  if(r.status===400||r.status===409||r.status===422){console.warn('Shared map turned this down',r.status,why);return true}SB.ok=false;SB.why=r.status+' '+why.slice(0,120);return false}catch(_){return false}}
// anything that couldn't be sent (no signal on the course) waits on the phone and goes when there's a connection
async function sbSend(table,rows){if(!SB.on()||!rows.length)return;if(!await sbPost(table,rows)){const q=lsGet('cc_sb_out',[]);q.push({table,rows});lsSet('cc_sb_out',q.slice(-300))}}
let sbFlushing=false;
async function sbFlush(){if(!SB.on()||sbFlushing)return;sbFlushing=true;try{const q=lsGet('cc_sb_out',[]);if(!q.length)return;const left=[];for(const j of q){if(!await sbPost(j.table,j.rows))left.push(j)}lsSet('cc_sb_out',left)}finally{sbFlushing=false}}
async function sbGet(table,qs){if(typeof Auth!=='undefined'&&Auth.s)await Auth.fresh();const r=await fetch(`${SB.url}/rest/v1/${table}?${qs}`,{headers:SB.h()});if(!r.ok){SB.ok=false;SB.why=r.status+' '+(await r.text().catch(()=>'')).slice(0,120);throw new Error('HTTP '+r.status)}SB.ok=true;return r.json()}
const sbNetText=()=>SB.ok===true?'Shared course map: connected. Holes you map reach every Caddy Coach golfer.':SB.ok===false?`Shared course map isn't reachable right now${SB.why?` (${SB.why})`:''}. Your mapping is saved on this phone and sent when it connects.`:'Checking the shared course map…';
// a quick check for the mapping screen: is the shared course map reachable?
async function sbCheck(){try{await sbGet('hole_maps','select=id&limit=1');await sbGet('course_cards','select=id&limit=1');return true}catch(_){return false}}
// share one hole's green (and tee, front and back when known)
function sbShareHole(c,n,g,source){if(!SB.on()||!c||!g||g.shared||g.lat==null)return;
 sbSend('hole_maps',[{course_key:sbKey(c),hole:+n,tee_lat:sbN(g.tee&&g.tee.lat),tee_lon:sbN(g.tee&&g.tee.lon),green_lat:sbN(g.lat),green_lon:sbN(g.lon),
  front_lat:sbN(g.front&&g.front.lat),front_lon:sbN(g.front&&g.front.lon),back_lat:sbN(g.back&&g.back.lat),back_lon:sbN(g.back&&g.back.lon),fair_lat:sbN(g.fair&&g.fair.lat),fair_lon:sbN(g.fair&&g.fair.lon),source,device:SB.device()}])}
function sbShareOsmCard(c,card){if(!SB.on()||!card)return;const k='cc_sbosm_'+sbKey(c);if(lsGet(k,0))return;
 const o={src:'osm',v:1,tees:card.tees||null,greens:card.greens||{},greenPool:(card.greenPool||[]).map(g=>({lat:g.lat,lon:g.lon,poly:g.poly})),mapped:card.mapped||0,confidence:card.confidence||null,source:card.source||'osm',osm:card.osm||null};
 if(JSON.stringify(o).length>17000)o.greenPool=o.greenPool.map(g=>({lat:g.lat,lon:g.lon}));if(JSON.stringify(o).length>19000)return;
 lsSet(k,1);sbSend('course_cards',[{course_key:sbKey(c),name:String(c.name||'').slice(0,120),card:o,device:SB.device()}])}
function sbShareCard(c){if(!SB.on()||!c||!c.tees)return;const tees=c.tees.map(t=>({name:String(t.name||'Tees').slice(0,30),colour:t.colour||'',rating:t.rating||null,slope:t.slope||null,holes:t.holes.map(h=>({n:h.n,par:h.par,yards:h.yards??null,si:h.si??null}))}));
 sbSend('course_cards',[{course_key:sbKey(c),name:String(c.name||'').slice(0,120),card:{holes:(c.tees[0]&&c.tees[0].holes.length)||18,tees},device:SB.device()}])}
// what golfers agree on for each hole: every phone gets one vote (its latest), the biggest group within 12 m wins
const SB_W={mapped:3,confirmed:2,tapped:2,learned:1.5,found:1};
function sbConsensus(rows){const by={},out={};rows.forEach(r=>{(by[r.hole]=by[r.hole]||[]).push(r)});
 for(const[n,all]of Object.entries(by)){const seen=new Set(),rs=all.slice().sort((a,b)=>a.created_at<b.created_at?1:-1).filter(r=>!seen.has(r.device)&&seen.add(r.device));
  const P=r=>({lat:r.green_lat,lon:r.green_lon}),w=r=>SB_W[r.source]||1;let best=null,bs=-1;
  for(const r of rs){const s=rs.filter(q=>mBetween(P(r),P(q))<12).reduce((a,q)=>a+w(q),0);if(s>bs){bs=s;best=r}}
  const cl=rs.filter(q=>mBetween(P(best),P(q))<12),avg=(L,a,b)=>{const k=L.filter(q=>q[a]!=null&&q[b]!=null);if(!k.length)return null;const sw=k.reduce((s,q)=>s+w(q),0);return{lat:sbN(k.reduce((s,q)=>s+q[a]*w(q),0)/sw),lon:sbN(k.reduce((s,q)=>s+q[b]*w(q),0)/sw)}};
  const g=Object.assign(avg(cl,'green_lat','green_lon'),{shared:true,votes:cl.length});const tee=avg(cl,'tee_lat','tee_lon');if(tee)g.tee=tee;
  const fr=avg(cl,'front_lat','front_lon'),bk=avg(cl,'back_lat','back_lon');if(fr&&bk){g.front=fr;g.back=bk}
  const fw=avg(cl,'fair_lat','fair_lon');if(fw)g.fair=fw;const me=SB.device();if(cl.some(q=>q.device===me))g.mine=true;out[n]=g}
 return out}
async function sbRows(table,key,fresh){const ck=`cc_sb_${table}_${key}`,c=lsGet(ck,null);if(c&&Date.now()-c.t<(fresh||6e5))return c.rows;
 try{const rows=await sbGet(table,`course_key=eq.${encodeURIComponent(key)}&select=*&order=created_at.desc&limit=3000`);lsSet(ck,{t:Date.now(),rows});return rows}catch(e){if(c)return c.rows;throw e}}
// add the shared greens to a course; greens you set yourself on this phone always win
async function sbApply(c,fresh){if(!SB.on()||!c)return 0;let rows;try{rows=await sbRows('hole_maps',sbKey(c),fresh)}catch(_){return 0}
 const con=sbConsensus(rows);c.greens=c.greens||{};let n=0;
 for(const[h,g]of Object.entries(con)){const mine=c.greens[h];if(mine&&!mine.shared)continue;c.greens[h]=g;n++}
 if(n){if(GPS.pick)Object.keys(GPS.pick).forEach(k=>{if(k.startsWith(c.key+':'))delete GPS.pick[k]});await RStore.saveCourse(c).catch(()=>{})}return n}
// the scorecard golfers agree on: the version entered by the most phones (newest wins a tie)
async function sbCard(c){if(!SB.on()||!c)return null;let rows;try{rows=await sbRows('course_cards',sbKey(c),36e5)}catch(_){return null}
 const groups=new Map();rows.forEach(r=>{if(r.card&&r.card.src==='osm')return;const t=r.card&&r.card.tees;if(!Array.isArray(t)||!t.length||!t.every(x=>Array.isArray(x.holes)&&x.holes.length>=9&&x.holes.every(h=>h.par>=3&&h.par<=6)))return;
  const sig=JSON.stringify(t.map(x=>[x.name,x.holes.map(h=>[h.par,h.yards,h.si])]));const g=groups.get(sig)||{card:r.card,devs:new Set(),t:r.created_at};g.devs.add(r.device);if(r.created_at>g.t)g.t=r.created_at;groups.set(sig,g)});
 const best=[...groups.values()].sort((a,b)=>b.devs.size-a.devs.size||(a.t<b.t?1:-1))[0];return best?{tees:best.card.tees,golfers:best.devs.size}:null}
async function sbCards(c){if(!SB.on()||!c)return null;const rows=await sbRows('course_cards',sbKey(c),36e5);
 const om=rows.filter(r=>r.card&&r.card.src==='osm'&&r.card.v===1).sort((a,b)=>a.created_at<b.created_at?1:-1)[0];
 const human=await sbCard(c);return{osm:om?om.card:null,human}}
function applySharedCard(course,s){course.tees=s.tees.map(t=>({name:t.name,colour:t.colour||'#f4f4f0',rating:t.rating||undefined,slope:t.slope||undefined,holes:t.holes.map(h=>({n:h.n,par:h.par,yards:h.yards,si:h.si}))}));
 course.source='shared';course.confidence='shared';course.sharedBy=s.golfers}
// course rating, slope and stroke index for each tee, from every golfer who has entered them (most common value wins)
async function sbRatings(c){if(!SB.on()||!c)return null;let rows;try{rows=await sbRows('course_cards',sbKey(c),36e5)}catch(_){return null}
 const by={};rows.forEach(r=>{const t=r.card&&r.card.tees;if(!Array.isArray(t))return;t.forEach(x=>{if(!x||!x.name)return;const k=String(x.name).toLowerCase(),o=by[k]=by[k]||{rs:new Map(),si:new Map()};
  if(+x.rating>=50&&+x.rating<=85&&+x.slope>=55&&+x.slope<=155){const sig=x.rating+'/'+x.slope,g=o.rs.get(sig)||{cr:+x.rating,sl:+x.slope,d:new Set()};g.d.add(r.device);o.rs.set(sig,g)}
  if(Array.isArray(x.holes)&&x.holes.length&&x.holes.every(h=>h.si>=1&&h.si<=18)){const sig=x.holes.map(h=>h.si).join(','),g=o.si.get(sig)||{si:x.holes.map(h=>h.si),d:new Set()};g.d.add(r.device);o.si.set(sig,g)}})});
 const out={};for(const[k,o]of Object.entries(by)){const top=m=>[...m.values()].sort((a,b)=>b.d.size-a.d.size)[0];const r=top(o.rs),si=top(o.si);out[k]={rate:r?{cr:r.cr,sl:r.sl,n:r.d.size}:null,si:si?{si:si.si,n:si.d.size}:null}}return out}
const RATE_TRIED=new Set();
async function rtAutoRate(c){if(!c||RATE_TRIED.has(c.key))return;RATE_TRIED.add(c.key);const R=await sbRatings(c);if(!R)return;let ch=0;
 (c.tees||[]).forEach(t=>{const o=R[String(t.name||'').toLowerCase()];if(!o)return;
  if(o.rate&&!(+t.rating>0&&+t.slope>0)){t.rating=o.rate.cr;t.slope=o.rate.sl;t.rateBy=o.rate.n;ch=1}
  if(o.si&&o.si.si.length===t.holes.length&&t.holes.some(h=>!(h.si>=1))){t.holes.forEach((h,i)=>{if(!(h.si>=1))h.si=o.si.si[i]});ch=1}});
 if(ch&&RT.course===c){await rtSaveCourse();rtRender()}}
async function sbCardInto(course){const s=await sbCard(course);if(!s)return false;
 course.tees=s.tees.map(t=>({name:t.name,colour:t.colour||'#f4f4f0',rating:t.rating||undefined,slope:t.slope||undefined,holes:t.holes.map(h=>({n:h.n,par:h.par,yards:h.yards,si:h.si}))}));
 course.source='shared';course.confidence='shared';course.sharedBy=s.golfers;return true}
if(!HOSTED_IN_CLAUDE){addEventListener('online',sbFlush);setTimeout(sbFlush,2500)}
