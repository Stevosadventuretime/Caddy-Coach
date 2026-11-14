// Caddy Coach practice coaching (uses coach.js): a scored test on every drill with the golfer's step and progress,
// a two-week focus that shapes the weekly plan, and "What's your miss?", which goes from the ball flight to the cause
// and the drills. Everything is kept on the phone and, for signed-in golfers, backed up with their rounds.

// ---------- storage ----------
const PR={
 all(){return Store.lget('cc_dtests',[])},
 stages(){return Store.lget('cc_dstage',{})},
 stage(id){return this.stages()[id]||0},
 setStage(id,s){const m=this.stages();m[id]=s;Store.lset('cc_dstage',m);Backup.put('practice','s:'+id,{d:id,stage:s,at:Date.now()})},
 add(d,score){const r={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),d:d.id,at:Date.now(),stage:this.stage(d.id),score,of:d.test.of};
  const a=this.all();a.push(r);Store.lset('cc_dtests',a.slice(-2000));Backup.put('practice','r:'+r.id,r);if(typeof pwMark==='function')pwMark();return r},
 undo(id){Store.lset('cc_dtests',this.all().filter(r=>r.id!==id));Backup.gone('practice','r:'+id)},
 focus(){return Store.lget('cc_focus',null)},
 setFocus(f){Store.lset('cc_focus',f);Backup.put('practice','f:focus',f||{cleared:Date.now()})}};
// a backed-up practice row coming down from another device (called by Backup.apply)
function practiceApply(x){const id=x.item_id;
 if(id.startsWith('r:')){const a=Store.lget('cc_dtests',[]),rid=id.slice(2),i=a.findIndex(r=>r.id===rid);
  if(x.deleted){if(i<0)return false;a.splice(i,1)}else{if(i>=0||!x.data)return false;a.push(x.data);a.sort((p,q)=>p.at-q.at)}Store.lset('cc_dtests',a);return true}
 if(id.startsWith('s:')){const d=x.data,m=Store.lget('cc_dstage',{});if(x.deleted||!d||(m[d.d]||0)>=d.stage)return false;m[d.d]=d.stage;Store.lset('cc_dstage',m);return true}
 if(id==='f:focus'){const f=x.data&&!x.data.cleared?x.data:null,cur=Store.lget('cc_focus',null),t=v=>v?(v.from||0):0;
  if(JSON.stringify(cur)===JSON.stringify(f)||(f&&cur&&t(cur)>t(f)))return false;Store.lset('cc_focus',f);return true}
 return false}
// on the first sign-in on this phone, send up the practice it already has
function practiceEnqueueAll(seen){for(const r of PR.all())if(!seen.has('r:'+r.id))Backup.put('practice','r:'+r.id,r);
 const m=PR.stages();for(const k in m)if(!seen.has('s:'+k))Backup.put('practice','s:'+k,{d:k,stage:m[k],at:Date.now()});
 const f=PR.focus();if(f&&!seen.has('f:focus'))Backup.put('practice','f:focus',f)}

// ---------- the test on the drill page ----------
const DT={};   // the score being entered, per drill
function dtBars(rs,T){if(!rs.length)return'';const pass=T.pass/T.of;
 return `<div class="dtBars" role="img" aria-label="Your last ${rs.length} scores: ${rs.map(r=>r.score+' out of '+r.of).join(', ')}">${rs.map(r=>{const v=r.score/r.of;return `<i class="${v>=pass?'ok':''}" style="--v:${Math.max(0.06,v)}"><span>${r.score}</span></i>`}).join('')}<b style="--p:${pass}" aria-hidden="true"></b></div>`}
function testHTML(d){const T=d.test;if(!T)return'';const S=Coach.testState(d,PR.all(),PR.stage(d.id)),tr=Coach.trend(S.here),cur=DT[d.id]!=null?DT[d.id]:Math.round(T.pass*0.7);
 const f=PR.focus(),isF=Coach.focusActive(f)&&f.drills.includes(d.id);
 const msg=S.ready?`<div class="dtUp"><b>Two passes in a row.</b> Ready for the next step: ${esc((d.progress||[])[S.stage+1]||'')}<button type="button" class="pri" data-dt-up="${d.id}">Move up a step</button></div>`
  :S.done?`<p class="dtNote ok">You've passed the last step. Keep it as a warm-up check, or test yourself on the course.</p>`
  :S.here.length?`<p class="dtNote">${Coach.passed(S.here[S.here.length-1],T)?'Passed. One more pass in a row moves you up a step.':`Pass mark ${T.pass} out of ${T.of}. ${tr==='up'?'Your scores are going up.':tr==='down'?'Scores dipping: slow it down and go back to the feel.':'Keep going.'}`}</p>`:`<p class="dtNote">Do the drill, then score it honestly. Pass mark ${T.pass} out of ${T.of}.</p>`;
 return `<section class="dtest" id="dtest-${d.id}" aria-labelledby="dtH-${d.id}"><h3 id="dtH-${d.id}">Test yourself</h3>
  ${S.stepText?`<p class="dtStep"><span>Step ${S.stage+1} of ${S.steps}</span>${esc(S.stepText)}</p>`:''}
  <p class="dtQ">${esc(T.q)}, out of ${T.of}</p>
  <div class="dtIn"><button type="button" data-dt="-" data-d="${d.id}" aria-label="One less">−</button><output id="dtV-${d.id}" aria-live="polite">${cur}</output><button type="button" data-dt="+" data-d="${d.id}" aria-label="One more">+</button><button type="button" class="pri" data-dt="save" data-d="${d.id}">Save score</button></div>
  ${dtBars(S.recent,T)}${msg}
  <button type="button" class="link dtFocus" data-focus-drill="${d.id}"${isF?' disabled':''}>${isF?'This is part of your focus':'Make this my focus for 2 weeks'}</button></section>`}
function dtRefresh(id){const d=DRILLS.find(x=>x.id===id),el=document.getElementById('dtest-'+id);if(d&&el)el.outerHTML=testHTML(d)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-dt],[data-dt-up],[data-dt-undo]');if(!b)return;
 if(b.dataset.dtUndo){PR.undo(b.dataset.dtUndo);dtRefresh(b.dataset.d);renderDrills.key=null;toast('Score removed.');return}
 if(b.dataset.dtUp){const id=b.dataset.dtUp,d=DRILLS.find(x=>x.id===id);PR.setStage(id,PR.stage(id)+1);dtRefresh(id);renderDrills.key=null;toast(`Step ${PR.stage(id)+1}: ${d.progress[PR.stage(id)]}`);return}
 const id=b.dataset.d,d=DRILLS.find(x=>x.id===id);if(!d||!d.test)return;const T=d.test,v=DT[id]!=null?DT[id]:Math.round(T.pass*0.7);
 if(b.dataset.dt==='+'||b.dataset.dt==='-'){DT[id]=Math.max(0,Math.min(T.of,v+(b.dataset.dt==='+'?1:-1)));const o=document.getElementById('dtV-'+id);if(o)o.textContent=DT[id];buzz&&buzz(6);return}
 if(b.dataset.dt==='save'){const r=PR.add(d,v);delete DT[id];dtRefresh(id);renderDrills.key=null;if(typeof track==='function')track('drilltest');
  const ok=Coach.passed(r,T),S=Coach.testState(d,PR.all(),PR.stage(id));
  toastUndo(ok?(S.ready?'Passed twice in a row. You can move up a step.':'Passed. Saved.'):`Saved: ${v} out of ${T.of}.`,()=>{PR.undo(r.id);dtRefresh(id);renderDrills.key=null})}});
// a toast with an undo button, for a score entered by mistake
function toastUndo(t,undo){toast(t);const el=$('ccToast');if(!el)return;const u=document.createElement('button');u.type='button';u.className='link';u.textContent='Undo';u.style.marginLeft='10px';
 u.onclick=()=>{undo();el.classList.remove('show');toast('Score removed.')};el.appendChild(u)}
// the drill card's line: how you're doing
function drillProgressLine(d){if(!d.test)return'';const S=Coach.testState(d,PR.all(),PR.stage(d.id));if(!S.recent.length)return'';const last=S.recent[S.recent.length-1];
 return `<span class="dprog${Coach.passed(last,d.test)?' ok':''}">Step ${S.stage+1} of ${S.steps} · last ${last.score}/${last.of}</span>`}

// ---------- focus ----------
function setFocus(f){PR.setFocus(f);if(typeof planGet==='function')planGet(true).then(()=>{renderPlan();renderHomePlan()}).catch(()=>{});renderMissCard()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-focus-drill]');if(!b||b.disabled)return;const d=DRILLS.find(x=>x.id===b.dataset.focusDrill);if(!d)return;
 setFocus(Coach.makeFocus('drill:'+d.id,b.dataset.focusLabel||d.name,d.aim||'',[d.id]));b.disabled=true;b.textContent='This is part of your focus';toast(`Your focus for the next 2 weeks: ${b.dataset.focusLabel||d.name}. It's in your weekly plan.`)});
function focusHTML(){const f=PR.focus();if(!f)return'';const now=Date.now();
 if(Coach.focusActive(f,now)){const day=Math.min(Coach.FOCUS_DAYS,Math.floor((now-f.from)/864e5)+1);
  return `<div class="fcBox"><div><span class="mut">Your focus · day ${day} of ${Coach.FOCUS_DAYS}</span><b>${esc(f.label)}</b></div><button type="button" class="link" data-focus-end>End</button></div>`}
 // finished: what the scores did, then pick the next thing
 const first={},last={};for(const r of PR.all())if(f.drills.includes(r.d)&&r.at>=f.from&&r.at<=f.until+864e5){if(!first[r.d])first[r.d]=r;last[r.d]=r}
 const lines=f.drills.filter(id=>first[id]).map(id=>{const d=DRILLS.find(x=>x.id===id);return d?`${esc(d.name)}: ${first[id].score}/${first[id].of} → ${last[id].score}/${last[id].of}`:''}).filter(Boolean);
 return `<div class="fcBox done"><div><span class="mut">Focus finished</span><b>${esc(f.label)}</b>${lines.length?`<small>${lines.join('<br>')}</small>`:''}<small>Film a swing to see if it shows, then pick your next focus.</small></div><button type="button" class="link" data-focus-end>Clear</button></div>`}
document.addEventListener('click',e=>{if(!e.target.closest('[data-focus-end]'))return;setFocus(null);toast('Focus cleared. Your plan goes back to the usual mix.')});

// ---------- What's your miss? ----------
function lastFlight(){let f=null;try{f=JSON.parse(localStorage.getItem('cc_lastflight')||'null')}catch(_){}return f&&Date.now()-f.t<30*864e5?f:null}
function renderMissCard(){const el=$('missCard');if(!el)return;const f=lastFlight(),fm=f&&Coach.missFromFlight(f.shape);
 el.hidden=false;el.innerHTML=`${focusHTML()}<h2 style="margin:0 0 4px">What's your miss?</h2><p class="mut" style="margin:0 0 10px">Start from what the ball does. We'll explain the cause and give you the drills in the right order.</p>
  ${fm?`<p class="msLast">Your last traced shot was a ${esc(String(f.shape).toLowerCase())}. <button type="button" class="link" data-miss="${fm}">See the fix</button></p>`:''}
  <div class="chips msChips">${Coach.MISS_ORDER.map(k=>`<button type="button" class="chip" data-miss="${k}">${Coach.MISS_GUIDE[k].name}</button>`).join('')}</div>`}
// a little picture of the miss: from above for direction, from the side for strike
function missSVG(key,lefty){const G=Coach.MISS_GUIDE[key],m=lefty?-1:1,x=v=>150+m*(v-150);
 if(G.kind==='dir'){const P={slice:'M150,190 C140,120 150,70 225,30',hook:'M150,190 C170,120 150,70 75,30',push:'M150,190 L215,32',pull:'M150,190 L85,32'}[key];
  const pts=P.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,(_,a,b)=>`${x(+a)},${b}`);
  return `<svg viewBox="0 0 300 210" role="img" aria-label="Seen from above: ${esc(G.name.toLowerCase())}"><rect width="300" height="210" rx="14" fill="#2f6b3b"/><path d="M150,195 L150,22" stroke="#fff" stroke-width="2" stroke-dasharray="6 6" opacity=".7"/><circle cx="150" cy="18" r="7" fill="#ffd21f"/><text x="162" y="22" fill="#fff" font-size="12" font-family="system-ui">Target</text><path d="${pts}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="150" cy="192" r="6" fill="#fff"/></svg>`}
 const c={fat:{cx:118,mark:'Club hits here first'},thin:{cx:150,mark:'Leading edge on the ball\'s middle'},top:{cx:150,mark:'Club above the ground'},shank:{cx:150,mark:'Neck of the club on the ball'}}[key];
 if(key==='shank')return `<svg viewBox="0 0 300 210" role="img" aria-label="Seen from above: shank"><rect width="300" height="210" rx="14" fill="#2f6b3b"/><path d="M150,195 L150,22" stroke="#fff" stroke-width="2" stroke-dasharray="6 6" opacity=".7"/><circle cx="150" cy="18" r="7" fill="#ffd21f"/><path d="M150,190 L${x(270)},120" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="150" cy="192" r="6" fill="#fff"/><text x="${lefty?16:170}" y="190" fill="#fff" font-size="12" font-family="system-ui">${esc(c.mark)}</text></svg>`;
 const clubY=key==='top'?118:key==='thin'?132:150;
 return `<svg viewBox="0 0 300 210" role="img" aria-label="Seen from the side: ${esc(G.name.toLowerCase())} strike"><rect width="300" height="210" rx="14" fill="#cfe3ef"/><rect y="150" width="300" height="60" fill="#3d7a46"/><circle cx="160" cy="139" r="11" fill="#fff" stroke="#888"/>
  <path d="M40,40 Q${key==='fat'?110:140},${clubY+40} 250,60" fill="none" stroke="#1d3b2a" stroke-width="3" stroke-dasharray="5 5" opacity=".6"/><rect x="${c.cx-22}" y="${clubY-14}" width="22" height="14" rx="3" fill="#555"/>
  ${key==='fat'?'<path d="M98,150 q12,10 26,0" stroke="#5a3b1d" stroke-width="5" fill="none"/>':''}<text x="16" y="28" fill="#10201a" font-size="12" font-family="system-ui">${esc(c.mark)}</text></svg>`}
async function foundInLastSwing(miss){try{const rows=await Store.list();if(!rows.length)return[];const d=await Store.detail(rows[0].id);if(!d||!d.metrics)return[];
 return SwingMetrics.faults(swingChecks(d.metrics),miss).map(c=>c.id)}catch(_){return[]}}
const MS={el:null};
async function openMiss(key){const G=Coach.MISS_GUIDE[key];if(!G)return;closeMiss(true);const lefty=Hand.get()==='left',W=t=>esc(Coach.sideWords(t,lefty));
 const found=await foundInLastSwing(key),P=Coach.missPlan(key,{drills:DRILLS,misses:SwingMetrics.MISSES,drillsForCheck,found}),f=lastFlight(),fm=f&&Coach.missFromFlight(f.shape)===key;
 const el=document.createElement('div');el.className='dpSheet msSheet';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','msTitle');
 const card=d=>`<button type="button" class="msDrill" data-open="${d.id}"><b>${esc(d.name)}</b><small>${esc(d.aim||'')}</small>${drillProgressLine(d)}</button>`;
 el.innerHTML=`<div class="dpTop"><button type="button" class="dpBack" data-ms-close aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h2 id="msTitle">Fixing a ${esc(G.name.toLowerCase())}</h2></div>
 <div class="dpBody msBody"><figure class="msFig">${missSVG(key,lefty)}</figure>
  <p class="dpFault"><b>What the ball does</b>${W(G.flight)}</p>
  <p class="dpWhy"><b>What it means at impact</b>${W(G.impact)}</p>
  ${fm?`<p class="msTrace">Your last traced shot: clubface about <b>${esc(f.faceTxt)}</b>, path <b>${esc(f.pathTxt)}</b>. ${esc(f.why||'')}</p>`:''}
  <p class="dpNote"><b>Where to start.</b> ${W(G.order)}</p>
  <h3>Check it yourself</h3><p class="dpTxt">${W(G.check)}</p>
  ${P.ball.length?`<h3>${G.kind==='dir'?'Drills for the start line and curve':'Drills for the strike'}</h3><div class="msList">${P.ball.map(card).join('')}</div>`:''}
  <h3>Body movements that cause it</h3><p class="mut" style="margin:0">Most likely first${found.length?'. Marked ones showed up in your last filmed swing':''}.</p>
  <ul class="msCauses">${P.causes.filter(c=>c.drills.length||c.found).slice(0,4).map(c=>`<li${c.found?' class="found"':''}><b>${esc(FAULT_TITLE(c.id))}</b>${c.found?'<span class="msTag">In your last swing</span>':''}<p>${W(c.why)}</p>${c.drills.length?`<div class="msList">${c.drills.map(card).join('')}</div>`:''}</li>`).join('')}</ul>
  <div class="msActs"><button type="button" class="pri" data-ms-focus="${key}">Make this my focus for 2 weeks</button><button type="button" data-ms-film="${key}">Film a swing to find your cause</button></div>
  <p class="dpNote">Ball flight laws apply to everyone, but which body movement causes them differs from golfer to golfer. Filming your swing with your miss selected ranks the causes for you.</p></div>`;
 document.body.appendChild(el);document.body.classList.add('dpOpen');MS.el=el;MS.ret=document.activeElement;MS.key=key;MS.P=P;requestAnimationFrame(()=>el.classList.add('in'));el.querySelector('[data-ms-close]').focus();
 el.addEventListener('keydown',e=>{if(e.key==='Escape')closeMiss()});if(typeof track==='function')track('miss_'+key)}
function closeMiss(quiet){if(!MS.el)return;const el=MS.el;el.classList.remove('in');setTimeout(()=>el.remove(),quiet?0:220);MS.el=null;if(!DP.el)document.body.classList.remove('dpOpen');if(!quiet&&MS.ret&&MS.ret.focus)MS.ret.focus()}
document.addEventListener('click',e=>{
 const m=e.target.closest('[data-miss]');if(m){e.preventDefault();openMiss(m.dataset.miss);return}
 if(e.target.closest('[data-ms-close]')){closeMiss();return}
 const fo=e.target.closest('[data-ms-focus]');if(fo){const key=fo.dataset.msFocus,G=Coach.MISS_GUIDE[key],P=MS.P||Coach.missPlan(key,{drills:DRILLS,misses:SwingMetrics.MISSES,drillsForCheck});
  const ids=[...P.ball.slice(0,1),...(P.causes.find(c=>c.found&&c.drills.length)||P.causes.find(c=>c.drills.length)||{drills:[]}).drills.slice(0,1),...P.ball.slice(1,2)].map(d=>d.id).filter((v,i,a)=>a.indexOf(v)===i).slice(0,2);
  setFocus(Coach.makeFocus('miss:'+key,'fixing your '+G.name.toLowerCase(),G.flight,ids));fo.disabled=true;fo.textContent='This is your focus now';toast(`Your focus for the next 2 weeks: fixing your ${G.name.toLowerCase()}. It's in your weekly plan.`);return}
 const fi=e.target.closest('[data-ms-film]');if(fi){closeMiss(true);tab(1);setTimeout(()=>{const s=$('miss');if(s){s.value=fi.dataset.msFilm;s.dispatchEvent(new Event('change'))}},60)}});
// a drill opened from the miss page goes over it; closing the drill comes back to the miss page
setTimeout(()=>{try{renderMissCard()}catch(e){console.error(e)}},0);
