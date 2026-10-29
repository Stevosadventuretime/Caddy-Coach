
// ---------- Profiles: everyone sets up a profile (unique username) before using the app; log in and out ----------
// The list of profiles is shared, so a username can only be taken once: in the phone app it lives in the Supabase
// "profiles" table (one login account per username), inside Claude in the page's shared database. Accounts made
// while every password was 1234 choose their own strong password the next time they log in.
// Each profile keeps its own rounds, swings and club yardages on the phone.
const PW_LEGACY='1234',UN_RE=/^[a-z0-9_.]{3,20}$/;
const unorm=s=>String(s||'').trim().toLowerCase().replace(/^@/,'');
const PROF={me:null,mode:'boot',f:{},err:{},photo:null,course:null,cl:null,clMsg:'',clBusy:'',avail:{},busy:false};
// ---- the shared list of profiles ----
const PDir={
 async db(){if(!HOSTED_IN_CLAUDE)return null;try{return await claude.use('db')}catch(_){return null}},
 cache(p){const all=lsGet('cc_profiles',{});all[p.username]=p;lsSet('cc_profiles',all)},
 cached(u){return lsGet('cc_profiles',{})[u]||null},
 toRow(p){return{username:p.username,first_name:p.first,last_name:p.last,course_key:p.course&&p.course.key||null,course_name:p.course&&p.course.name||null,
  course_lat:p.course&&p.course.lat!=null?+p.course.lat:null,course_lon:p.course&&p.course.lon!=null?+p.course.lon:null,photo:p.photo||null}},
 fromRow(r){return r&&{username:r.username,first:r.first_name,last:r.last_name,photo:r.photo||null,authId:r.auth_id||null,course:r.course_name?{key:r.course_key,name:r.course_name,lat:r.course_lat,lon:r.course_lon}:null}},
 // returns the profile, null if nobody has that username, or throws if the list can't be reached
 async get(u){
  if(HOSTED_IN_CLAUDE){const db=await this.db();if(!db)throw new Error('offline');const d=await db.doc('profiles/'+u).get();return d.exists?d.data():null}
  const a=await sbGet('profiles',`username=eq.${encodeURIComponent(u)}&select=*`);return a[0]?this.fromRow(a[0]):null},
 async create(p){
  if(HOSTED_IN_CLAUDE){const db=await this.db();if(!db)throw new Error('offline');const ref=db.doc('profiles/'+p.username),d=await ref.get();if(d.exists)return'taken';await ref.set(p);return'ok'}
  const r=await fetch(`${SB.url}/rest/v1/profiles`,{method:'POST',headers:Object.assign(SB.h(),{'Content-Type':'application/json',Prefer:'return=minimal'}),body:JSON.stringify(Object.assign(this.toRow(p),p.authId?{auth_id:p.authId}:{}))});
  if(r.ok)return'ok';if(r.status===409)return'taken';throw new Error('HTTP '+r.status+' '+(await r.text().catch(()=>'')).slice(0,100))},
 async byAuth(id){const rows=await sbGet('profiles',`auth_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return rows&&rows[0]?this.fromRow(rows[0]):null},
 // an account made while every password was 1234 takes ownership of its profile once it has its own password
 async claim(u,authId){const r=await fetch(`${SB.url}/rest/v1/profiles?username=eq.${encodeURIComponent(u)}`,{method:'PATCH',headers:Object.assign(SB.h(),{'Content-Type':'application/json',Prefer:'return=representation'}),body:JSON.stringify({auth_id:authId})});
  if(!r.ok){const t=await r.text().catch(()=>'');const e=new Error('HTTP '+r.status+' '+t.slice(0,160));e.status=r.status;e.body=t;throw e}
  const a=await r.json().catch(()=>[]);if(Array.isArray(a)&&!a.length){const e=new Error('no row updated');e.code='no_row';throw e}},
 async update(p){
  if(HOSTED_IN_CLAUDE){const db=await this.db();if(!db)throw new Error('offline');await db.doc('profiles/'+p.username).set(p);return}
  const row=this.toRow(p);delete row.username;
  const r=await fetch(`${SB.url}/rest/v1/profiles?username=eq.${encodeURIComponent(p.username)}`,{method:'PATCH',headers:Object.assign(SB.h(),{'Content-Type':'application/json',Prefer:'return=minimal'}),body:JSON.stringify(row)});
  if(!r.ok)throw new Error('HTTP '+r.status)}};
// profiles made while the shared list couldn't be reached are sent when it can
async function profFlush(){if(HOSTED_IN_CLAUDE)return;const q=lsGet('cc_prof_out',[]);if(!q.length)return;const left=[];
 for(const j of q){try{if(j.op==='create'){const r=await PDir.create(j.p);if(r==='taken'){const o=await PDir.get(j.p.username).catch(()=>null);if(!o||o.first!==j.p.first||o.last!==j.p.last)left.push(Object.assign(j,{clash:1}))}}else await PDir.update(j.p)}catch(_){left.push(j)}}
 lsSet('cc_prof_out',left)}
// ---- who is logged in on this phone ----
const Sess={
 async get(){let s=lsGet('cc_session',null);if(!s&&(Store.mode||Store._m)==='db'){try{const d=await Store.base().doc('session').get();s=d.exists?d.data():null}catch(_){}}return s&&s.u?s:null},
 async set(u){const s={u,at:Date.now()};lsSet('cc_session',s);if((Store.mode||Store._m)==='db')await Store.base().doc('session').set(s).catch(()=>{})},
 async clear(){try{localStorage.removeItem('cc_session')}catch(_){}if((Store.mode||Store._m)==='db')await Store.base().doc('session').delete().catch(()=>{})}};
// ---- passwords: every account has its own, strength-checked ----
// a strong password: 10+ characters, upper and lower case letters, at least 2 numbers and a special character,
// not your username, not a common password and not an easy pattern
const PW_COMMON=['password','passw0rd','qwerty','qwertyuiop','letmein','welcome','iloveyou','admin','abc123','monkey','dragon','football','baseball','sunshine','princess','master','shadow','trustno1','superman','starwars','liverpool','arsenal','chelsea','manchester','golf','golfer','golfing','caddy','caddycoach','birdie','eagle','tiger','fairway','password1','changeme','secret','summer','winter','autumn','spring','london','england','hello','freedom','whatever','qazwsx','zaq1','asdfgh','zxcvbn','1q2w3e','123qwe'];
function pwCheck(pw,user){pw=String(pw||'');const low=pw.toLowerCase(),u=String(user||'').toLowerCase();
 const digits=(pw.match(/[0-9]/g)||[]).length,special=/[^A-Za-z0-9]/.test(pw),upper=/[A-Z]/.test(pw),lower=/[a-z]/.test(pw);
 const bare=low.replace(/[^a-z]/g,''),common=PW_COMMON.some(w=>bare===w||(w.length>=6&&bare.includes(w)))||/^(.)\1+$/.test(pw);
 const seq=s=>{for(let i=0;i+3<s.length;i++){const a=s.charCodeAt(i),b=s.charCodeAt(i+1),c=s.charCodeAt(i+2),d=s.charCodeAt(i+3);if((b-a===1&&c-b===1&&d-c===1)||(a-b===1&&b-c===1&&c-d===1))return true}return false};
 const pattern=/(.)\1\1/.test(pw)||seq(low),hasUser=u.length>=3&&low.includes(u);
 const rules=[{k:'len',ok:pw.length>=10,t:'At least 10 characters'},{k:'case',ok:upper&&lower,t:'Upper and lower case letters'},{k:'num',ok:digits>=2,t:'At least 2 numbers'},{k:'sym',ok:special,t:'At least 1 special character, like ! ? # or %'},
  {k:'user',ok:!!pw&&!hasUser,t:'Not your username'},{k:'common',ok:!!pw&&!common&&!pattern,t:'Not a common password or an easy pattern (aaa, 1234, abcd)'}];
 // rough strength: how many guesses it would take
 const pool=(lower?26:0)+(upper?26:0)+(digits?10:0)+(special?33:0),bits=pw.length*Math.log2(Math.max(pool,1))-(common?30:0)-(pattern?12:0)-(hasUser?20:0);
 const score=!pw?0:bits<40?1:bits<55?2:bits<70?3:4,ok=rules.every(r=>r.ok)&&score>=3;
 return{ok,rules,score,label:['','Weak','Fair','Strong','Very strong'][score]}}
// the password box: show/hide, a strength bar and the rules ticking off as you type
function pwFieldsHTML(id,label,user,confirm){const v=PROF.f[id]||'',c=pwCheck(v,user);
 return `<div class="pfF"><label for="${id}">${label}</label><div class="pwWrap"><input id="${id}" type="password" autocomplete="new-password" value="${esc(v)}" ${PROF.err[id]?`aria-invalid="true" aria-describedby="e_${id}"`:''} aria-describedby="${id}_rules"><button type="button" class="pwEye" data-pw-eye="${id}" aria-label="Show password">Show</button></div>
  <div class="pwMeter s${c.score}" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="pwLab" id="${id}_lab" aria-live="polite">${v?`Strength: ${c.label}`:'Use a password you don\'t use anywhere else.'}</p>
  <ul class="pwRules" id="${id}_rules">${c.rules.map(r=>`<li class="${r.ok?'ok':''}" data-rule="${r.k}">${r.t}</li>`).join('')}</ul>${pErr(id)}</div>
  ${confirm?`<div class="pfF"><label for="${confirm}">Type it again</label><input id="${confirm}" type="password" autocomplete="new-password" value="${esc(PROF.f[confirm]||'')}" ${PROF.err[confirm]?`aria-invalid="true" aria-describedby="e_${confirm}"`:''}>${pErr(confirm)}</div>`:''}`}
function pwLive(id,user){const el=$(id);if(!el)return;const c=pwCheck(el.value,user),box=el.closest('.pfF');if(!box)return;
 box.querySelector('.pwMeter').className='pwMeter s'+c.score;box.querySelector('.pwLab').textContent=el.value?`Strength: ${c.label}`:'Use a password you don\'t use anywhere else.';
 c.rules.forEach(r=>{const li=box.querySelector(`[data-rule="${r.k}"]`);if(li)li.classList.toggle('ok',r.ok)})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-pw-eye]');if(!b)return;const i=$(b.dataset.pwEye);if(!i)return;const show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Hide':'Show';b.setAttribute('aria-label',show?'Hide password':'Show password')});
document.addEventListener('input',e=>{const id=e.target.id;if(id==='pfNewPw'||id==='pfPw1'){PROF.f[id]=e.target.value;pwLive(id,PROF.mode==='signup'?unorm($('pfUser')&&$('pfUser').value):PROF.mode==='resetpw'?PROF.resetU:(PROF.pend||PROF.me||{}).username)}});
function pwProblems(pw,pw2,user,idA,idB){const e={},c=pwCheck(pw,user);
 if(!pw)e[idA]='Choose a password.';else if(!c.ok)e[idA]='That password isn\'t strong enough yet. Every rule below needs a tick.';
 if(idB&&!e[idA]&&pw!==pw2)e[idB]='The two passwords don\'t match.';return e}

// ---- logging in: Supabase accounts in the phone app (each username has one account, so it can't be used twice);
// inside Claude, a salted hash kept with the profile ----
const Auth={
 s:null,
 load(){this.s=lsGet('cc_auth',null);return this.s},
 save(s){this.s=s;if(s)lsSet('cc_auth',s);else try{localStorage.removeItem('cc_auth')}catch(_){}},
 email:u=>`${u}@users.caddycoach.app`,
 userOf(){const u=this.s&&this.s.user;if(!u)return null;if(u.username)return u.username;return u.email&&/@users\.caddycoach\.app$/i.test(u.email)?u.email.split('@')[0]:null},
 tok(){return this.s&&this.s.access_token||null},
 keep(j){if(!j||!j.access_token)return null;const md=j.user&&j.user.user_metadata||{};const s={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+((j.expires_in||3600)-60)*1000,user:{id:j.user&&j.user.id,email:j.user&&j.user.email,username:md.username||(this.s&&this.s.user&&this.s.user.id===(j.user&&j.user.id)?this.s.user.username:null)||null}};this.save(s);return s},
 // the app's own server function for accounts (sign up, log in by username, email, password reset); null if it isn't there
 async fn(action,body){const r=await fetch(`${SB.url}/functions/v1/cc-auth`,{method:'POST',headers:{apikey:SB.key,Authorization:'Bearer '+SB.key,'Content-Type':'application/json'},body:JSON.stringify(Object.assign({action},body))});
  if(r.status===404)return null;let j={};try{j=await r.json()}catch(_){}
  if(!r.ok){const e=new Error(j.msg||j.message||j.error_description||('HTTP '+r.status));e.status=r.status;e.code=j.code||j.error_code;throw e}return j},
 realEmail(){const e=this.s&&this.s.user&&this.s.user.email;return e&&!/@users\.caddycoach\.app$/i.test(e)?e:null},
 async setEmail(email){const t=await this.fresh();const j=await this.fn('set_email',{email,token:t});if(!j){const e=new Error('The app\'s server needs updating.');e.status=404;throw e}this.s.user.email=j.email;this.save(this.s);return j.email},
 async reset(who){const j=await this.fn('reset',{who,redirect:location.origin+location.pathname});if(!j){const e=new Error('missing');e.status=503;e.code='email_unavailable';throw e}return j},
 async call(path,body,method,tok){const r=await fetch(`${SB.url}/auth/v1/${path}`,{method:method||'POST',headers:{apikey:SB.key,'Content-Type':'application/json',Authorization:'Bearer '+(tok||SB.key)},body:body?JSON.stringify(body):undefined});
  let j=null;try{j=await r.json()}catch(_){}if(!r.ok){const e=new Error((j&&(j.msg||j.message||j.error_description||j.error))||('HTTP '+r.status));e.status=r.status;e.code=j&&(j.error_code||j.code||j.error);throw e}return j},
 // new logins are made by the app's own server function (cc-signup), already confirmed, so no email is ever needed;
 // if that function isn't there, fall back to Supabase's normal sign-up
 async signUp(u,pw,email){
  if(email!=null){const j=await this.fn('signup',{username:u,password:pw,email});if(j)return this.signIn(u,pw)}
  const r=await fetch(`${SB.url}/functions/v1/cc-signup`,{method:'POST',headers:{apikey:SB.key,Authorization:'Bearer '+SB.key,'Content-Type':'application/json'},body:JSON.stringify({username:u,password:pw})});
  if(r.status!==404){let j={};try{j=await r.json()}catch(_){}
   if(!r.ok){const e=new Error(j.msg||j.message||('HTTP '+r.status));e.status=r.status;e.code=j.code||j.error_code;throw e}
   return this.signIn(u,pw)}
  const j=await this.call('signup',{email:this.email(u),password:pw,data:{username:u}});if(!j.access_token){const e=new Error('confirm');e.code='needs_confirm';throw e}return this.keep(j)},
 async signIn(u,pw){const j=await this.fn('login',{username:u,password:pw});if(j){const s=this.keep(j);if(s&&!s.user.username){s.user.username=u;this.save(s)}return s}
  const s=this.keep(await this.call('token?grant_type=password',{email:this.email(u),password:pw}));if(s){s.user.username=u;this.save(s)}return s},
 async refresh(){if(!this.s||!this.s.refresh_token)return null;try{return this.keep(await this.call('token?grant_type=refresh_token',{refresh_token:this.s.refresh_token}))}catch(e){if(e.status>=400&&e.status<500)this.save(null);throw e}},
 // a valid token, refreshed a minute before it runs out
 async fresh(){if(!this.s)return null;if(Date.now()<this.s.expires_at)return this.s.access_token;try{await this.refresh()}catch(_){}return this.tok()},
 async setPassword(pw){const t=await this.fresh();return this.call('user',{password:pw},'PUT',t)},
 async signOut(){const t=this.tok();this.save(null);if(t)try{await this.call('logout',null,'POST',t)}catch(_){}}};
Auth.load();
// inside Claude there's no account server: the password is kept as a salted PBKDF2 hash with the profile
async function pwHash(pw,salt){salt=salt||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:150000},k,256);
 return{salt,it:150000,hash:Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')}}
async function pwMatches(pw,rec){if(!rec||!rec.salt)return false;const h=await pwHash(pw,rec.salt);return h.hash===rec.hash}

// the first profile made on a phone keeps whatever was already saved there (rounds, swings, yardages); later ones start fresh
const profNs=u=>Store.nsFor(u);
// ---- the screens ----
const profAv=(p,size)=>{const ini=p?((p.first||'')[0]||'')+((p.last||'')[0]||''):'';return `<span class="pfAv" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.36)}px">${p&&p.photo?`<img alt="" src="${p.photo}">`:ini?esc(ini.toUpperCase()):'<svg viewBox="0 0 24 24" width="48%" height="48%" aria-hidden="true"><circle cx="12" cy="8" r="4.2" fill="currentColor"/><path d="M3.5 21c.8-4.4 4.2-7 8.5-7s7.7 2.6 8.5 7z" fill="currentColor"/></svg>'}</span>`};
function profShow(mode){PROF.mode=mode;const o=$('prof');o.hidden=false;document.documentElement.classList.add('pfOpen');profRender();setTimeout(()=>{const f=o.querySelector('input:not([type=file]),button.pri');if(f&&mode!=='boot')f.focus()},30)}
function profHide(){$('prof').hidden=true;document.documentElement.classList.remove('pfOpen')}
const pErr=k=>PROF.err[k]?`<p class="pfErr" id="e_${k}" role="alert">${esc(PROF.err[k])}</p>`:'';
const emailOk=v=>/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(String(v||'').trim())&&!/@users\.caddycoach\.app$/i.test(String(v));
const emailIn=(id,label)=>pIn(id,label||'Email','type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required',PROF.f[id],'<p class="pfHint">Only used to reset your password if you forget it. Other golfers never see it.</p>');
const pIn=(id,label,attrs,v,hint)=>`<div class="pfF"><label for="${id}">${label}</label><input id="${id}" ${attrs} value="${esc(v||'')}" ${PROF.err[id]?`aria-invalid="true" aria-describedby="e_${id}"`:''}>${hint||''}${pErr(id)}</div>`;
function profCourseHTML(){const c=PROF.course,L=PROF.cl;
 if(c)return `<div class="pfCourse"><span class="pfFlag" aria-hidden="true">⛳</span><div><b>${esc(c.name)}</b>${c.town?`<span>${esc(c.town)}</span>`:''}</div><button type="button" class="link" data-pf="course-change">Change</button></div>`;
 return `<div class="pfRow"><input id="pfCq" type="search" placeholder="Course or town" autocomplete="off" aria-label="Search for your local course" value="${esc(PROF.f.cq||'')}"><button type="button" data-pf="course-find">Search</button></div>
  <button type="button" class="pfLoc" data-pf="course-near"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>Use my location</button>
  ${PROF.clBusy?`<p class="mut" role="status">${esc(PROF.clBusy)}</p>`:''}${PROF.clMsg?`<p class="mut" role="status">${esc(PROF.clMsg)}</p>`:''}
  ${L&&L.length?`<div class="pfList" role="list">${L.map((x,i)=>`<button type="button" role="listitem" data-pf-pick="${i}"><b>${esc(x.name)}</b><span>${esc([x.town,x.mi!=null?x.mi.toFixed(1)+' mi':''].filter(Boolean).join(', '))}</span></button>`).join('')}</div>`:''}
  ${PROF.f.cq&&L?`<button type="button" class="link" data-pf="course-own">My course isn't listed: use “${esc(PROF.f.cq)}”</button>`:''}`}
function profRender(){const b=$('pfBody'),m=PROF.mode,f=PROF.f,me=PROF.me;if(v2Render(b,m))return;
 if(m==='boot'){b.innerHTML='<div class="pfCard"><p class="mut" role="status">Loading…</p></div>';return}
 if(m==='welcome'){b.innerHTML=`<div class="pfCard pfWelcome"><span class="pfEmb" aria-hidden="true"></span><h1>Caddy Coach</h1><p>Set up your profile to start. Your rounds, swings and club yardages are kept under your username.</p>
  <button type="button" class="pri pfBig" data-pf="to-signup">Create your profile</button><button type="button" class="pfBig" data-pf="to-login">I already have a profile</button></div>`;return}
 if(m==='login'){b.innerHTML=`<form class="pfCard" data-pf-form="login" novalidate><h2>Log in</h2>${pErr('_form')}
  ${pIn('pfU','Username','autocomplete="username" autocapitalize="none" spellcheck="false" required',f.pfU)}
  ${pIn('pfPw','Password','type="password" autocomplete="current-password" required',f.pfPw,'<p class="pfHint">Set up your profile while every password was 1234? Use 1234 one last time and you\'ll choose your own.</p>')}
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Logging in…':'Log in'}</button>
  ${HOSTED_IN_CLAUDE?'':'<button type="button" class="link" data-pf="to-forgot">Forgotten your password?</button>'}
  <button type="button" class="link" data-pf="to-signup">New here? Create your profile</button></form>`;return}
 if(m==='forgot'){b.innerHTML=`<form class="pfCard" data-pf-form="forgot" novalidate><button type="button" class="link pfBack" data-pf="to-login">Back</button><h2>Reset your password</h2>${pErr('_form')}
  ${PROF.note?`<p class="pfOk" role="status">${esc(PROF.note)}</p>`:`<p class="mut" style="margin:0">Enter your username or the email on your account. We'll email you a link to choose a new password.</p>
  ${pIn('pfWho','Username or email','autocomplete="username" autocapitalize="none" spellcheck="false" required',f.pfWho)}
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Sending…':'Email me a reset link'}</button>`}</form>`;return}
 if(m==='resetpw'){const u=PROF.resetU||'';b.innerHTML=`<form class="pfCard" data-pf-form="resetpw" novalidate><h2>Choose a new password</h2>${pErr('_form')}
  <p class="mut" style="margin:0">${u?`For <b>@${esc(u)}</b>. `:''}You'll be logged in once it's saved.</p>
  ${pwFieldsHTML('pfNewPw','New password',u,'pfNewPw2')}
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Saving…':'Save my new password'}</button></form>`;return}
 if(m==='addemail'||m==='email'){const cur=Auth.realEmail(),must=m==='addemail';b.innerHTML=`<form class="pfCard" data-pf-form="email" novalidate>${must?'':'<button type="button" class="link pfBack" data-pf="to-me">Back</button>'}<h2>${must?'Add your email':'Email for password reset'}</h2>${pErr('_form')}
  <p class="mut" style="margin:0">${must?'Caddy Coach now asks everyone for an email address, so you can reset your password if you ever forget it.':cur?`Your account uses <b>${esc(cur)}</b>.`:'Add an email so you can reset your password.'}</p>
  ${emailIn('pfEmail',cur?'New email':'Email')}
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Saving…':'Save email'}</button>
  ${must?'<button type="button" class="link" data-pf="logout">Log out</button>':''}</form>`;return}
 if(m==='signup'||m==='edit'){const ed=m==='edit',un=unorm(f.pfUser),av=PROF.avail[un];
  b.innerHTML=`<form class="pfCard" data-pf-form="${m}" novalidate>${ed?`<button type="button" class="link pfBack" data-pf="to-me">Back</button>`:''}<h2>${ed?'Edit your profile':'Create your profile'}</h2>${pErr('_form')}
  <div class="pfPhoto">${profAv({photo:PROF.photo,first:f.pfFirst,last:f.pfLast},84)}<div><b>Profile photo</b><div class="pfRow"><label class="btn" for="pfPhotoIn">${PROF.photo?'Change photo':'Add a photo'}</label>${PROF.photo?'<button type="button" data-pf="photo-remove">Remove</button>':''}</div></div><input type="file" id="pfPhotoIn" accept="image/*" hidden></div>
  <div class="pfTwo">${pIn('pfFirst','First name','autocomplete="given-name" required maxlength="40"',f.pfFirst)}${pIn('pfLast','Last name','autocomplete="family-name" required maxlength="40"',f.pfLast)}</div>
  ${ed?`<div class="pfF"><label>Username</label><p class="pfFixed">@${esc(me.username)}</p></div>`:pIn('pfUser','Username','autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="20"',f.pfUser,
   `<p class="pfHint" id="pfAvail" role="status">${!un?'3 to 20 letters, numbers, dots or underscores.':!UN_RE.test(un)?'Use 3 to 20 letters, numbers, dots or underscores.':av==='free'?`@${esc(un)} is free.`:av==='taken'?`@${esc(un)} is taken. Try another.`:av==='checking'?'Checking…':av==='unknown'?`Couldn't check @${esc(un)} right now; it's checked again when you save.`:''}</p>`)}
  <div class="pfF"><span class="pfLab" id="pfHandLab">You play</span><div class="pfSeg" role="radiogroup" aria-labelledby="pfHandLab">${['right','left'].map(v=>`<button type="button" role="radio" data-pf-hand="${v}" aria-checked="${(f.hand||Hand.get())===v}">${v==='right'?'Right-handed':'Left-handed'}</button>`).join('')}</div><p class="pfHint">Caddy Coach shows your setup, grip, drill demos and checks the way you stand.</p></div>
  ${ed&&HcpStore.rec&&HcpStore.rec.start?`<div class="pfF"><span class="pfLab">Starting handicap</span><p class="pfFixed">${HcpStore.rec.start.hi==null?'None':esc(WHS.fmt(HcpStore.rec.start.hi))}</p><p class="pfHint">Locked once it's set. Your handicap estimate updates from the scores you submit.</p></div>`:''}
  <div class="pfF"><span class="pfLab" id="pfCourseLab">Local course</span><div role="group" aria-labelledby="pfCourseLab">${profCourseHTML()}</div>${pErr('course')}</div>
  ${ed||HOSTED_IN_CLAUDE?'':emailIn('pfEmail')}
  ${ed?'':pwFieldsHTML('pfPw1','Password',un,'pfPw2')}
  ${ed?'':'<p class="pfHint">By creating a profile you agree to how Caddy Coach handles your data. <button type="button" class="link" data-pf="to-privacy">Read the privacy notice</button></p>'}
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Saving…':ed?'Save changes':'Create profile'}</button>
  ${ed?'':'<button type="button" class="link" data-pf="to-login">Already have a profile? Log in</button>'}</form>`;
  const pi=$('pfPhotoIn');if(pi)pi.onchange=async e=>{const fl=e.target.files&&e.target.files[0];e.target.value='';if(!fl)return;profCollect();try{PROF.photo=await profShrink(fl)}catch(_){PROF.err._form='That photo couldn\'t be opened. Try a JPEG or PNG.'}profRender()};
  return}
 if(m==='privacy'){b.innerHTML=privacyHTML();return}
 if(m==='settings'){const d=DISP.get(),seg=(k,opts,cur)=>`<div class="pfSeg pfSeg3" role="radiogroup" aria-label="${k==='size'?'Text size':'Colours'}">${opts.map(([v,l])=>`<button type="button" role="radio" data-disp="${k}:${v}" aria-checked="${(cur||opts[0][0])===v}">${l}</button>`).join('')}</div>`;
  b.innerHTML=`<div class="pfCard"><button type="button" class="link pfBack" data-pf="to-me">Back</button><h2>Text size and display</h2>
  <div class="pfF"><span class="pfLab">Text size</span>${seg('size',[['std','Standard'],['lg','Large'],['xl','Largest']],d.size)}<p class="pfHint">Makes everything in Caddy Coach bigger, including buttons.</p></div>
  <div class="pfF"><span class="pfLab">Colours</span>${seg('theme',[['auto','Match my phone'],['light','Light'],['dark','Dark']],d.theme)}</div>
  <div class="pfF"><span class="pfLab">Notifications</span><label class="fgNo"><input type="checkbox" id="pfNotify" ${lsGet('cc_notify',0)?'checked':''}> Tell me when a swing analysis or shot trace finishes while I'm in another app</label><p class="pfHint" id="pfNotifyMsg">${'Notification' in window?'':'This browser can\'t show notifications. On iPhone, add Caddy Coach to your Home Screen first.'}</p></div>
  <p class="pfHint">Caddy Coach also follows your phone's settings for reduced motion and screen readers.</p></div>`;
  const nb=$('pfNotify');if(nb)nb.onchange=async()=>{const r=await notifyToggle(nb.checked);nb.checked=r==='granted';const m=$('pfNotifyMsg');if(m)m.textContent=r==='granted'?'Notifications are on.':r==='denied'?'Notifications are blocked for Caddy Coach. Turn them on in your phone\'s settings, then try again.':r==='unsupported'?'This browser can\'t show notifications. On iPhone, add Caddy Coach to your Home Screen first.':r==='off'?'Notifications are off.':''};return}
 if(m==='feedback'){const f=PROF.f;b.innerHTML=`<form class="pfCard" data-pf-form="feedback" novalidate><button type="button" class="link pfBack" data-pf="to-me">Back</button><h2>Send feedback</h2>${pErr('_form')}
  <p class="mut" style="margin:0">Found something that doesn't work, or have an idea? It goes straight to the people building Caddy Coach.</p>
  <div class="pfSeg pfSeg3" role="radiogroup" aria-label="What is it about?">${[['bug','Something\'s wrong'],['idea','An idea'],['other','Something else']].map(([k,l])=>`<button type="button" role="radio" data-pf-fbk="${k}" aria-checked="${(f.fbk||'bug')===k}">${l}</button>`).join('')}</div>
  <div class="pfF"><label for="pfFb">${(f.fbk||'bug')==='bug'?'What happened, and what were you doing?':'Tell us'}</label><textarea id="pfFb" rows="6" maxlength="2000">${esc(f.pfFb||'')}</textarea>${pErr('pfFb')}</div>
  <label class="fgNo"><input type="checkbox" id="pfFbDev" ${f.fbDev===false?'':'checked'}> Include my phone model and app version (helps fix problems)</label>
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Sending…':'Send feedback'}</button>
  <button type="button" class="link" data-pf="invite">Invite a friend to test Caddy Coach</button></form>`;return}
 if(m==='delacct'){b.innerHTML=delAcctHTML();return}
 if(m==='setpw'){const u=(PROF.pend||PROF.me||{}).username||'';b.innerHTML=`<form class="pfCard" data-pf-form="setpw" novalidate><h2>Choose your new password</h2>${pErr('_form')}
  <p class="mut" style="margin:0">Caddy Coach now has proper passwords. Choose one for <b>@${esc(u)}</b>. From now on you'll log in with it instead of 1234, and nobody else can use your username.</p>
  ${HOSTED_IN_CLAUDE?'':emailIn('pfEmail','Your email')}
  ${pwFieldsHTML('pfNewPw','New password',u,'pfNewPw2')}
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Saving…':'Save my password'}</button>
  ${PROF.me?'':'<button type="button" class="link" data-pf="to-login">Back</button>'}</form>`;return}
 if(m==='chpw'){const u=PROF.me.username;b.innerHTML=`<form class="pfCard" data-pf-form="chpw" novalidate><button type="button" class="link pfBack" data-pf="to-me">Back</button><h2>Change your password</h2>${pErr('_form')}
  ${pIn('pfCurPw','Current password','type="password" autocomplete="current-password" required',PROF.f.pfCurPw)}
  ${pwFieldsHTML('pfNewPw','New password',u,'pfNewPw2')}
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Saving…':'Change password'}</button></form>`;return}
 if(m==='relogin'){const u=(PROF.pend||{}).username||'';b.innerHTML=`<form class="pfCard" data-pf-form="login" novalidate><h2>Log in again</h2>${pErr('_form')}
  <p class="mut" style="margin:0">For your security, enter the password for <b>@${esc(u)}</b>.</p>
  <input type="hidden" id="pfU" value="${esc(u)}">${pIn('pfPw','Password','type="password" autocomplete="current-password" required',PROF.f.pfPw)}
  <button type="submit" class="pri pfBig" ${PROF.busy?'disabled':''}>${PROF.busy?'Logging in…':'Log in'}</button>
  <button type="button" class="link" data-pf="switch-user">Not you? Log in as someone else</button></form>`;return}
 if(m==='hcp'){b.innerHTML=hcpRecordHTML()||hcpMeHTML();return}
 if(m==='hcp-start'){b.innerHTML=hcpStartHTML();return}
 if(m==='hcp-add'){b.innerHTML=hcpAddHTML();return}
 if(m==='me'){b.innerHTML=`<div class="pfCard pfMe"><button type="button" class="pfX" data-pf="close" aria-label="Close your profile"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
  ${profAv(me,96)}<h2>${esc(me.first+' '+me.last)}</h2><p class="pfUn">@${esc(me.username)} · ${Hand.get()==='left'?'Left':'Right'}-handed</p>
  ${hcpMeHTML()}
  ${me.course?`<div class="pfCourse"><span class="pfFlag" aria-hidden="true">⛳</span><div><span class="pfSmall">Local course</span><b>${esc(me.course.name)}</b></div></div><button type="button" class="pri pfBig" data-pf="play">Start a round at ${esc(me.course.name)}</button>`:''}
  <button type="button" class="pfBig" data-pf="to-edit">Edit profile</button>
  <div class="pfLinks"><button type="button" class="link" data-pf="to-chpw">Change password</button>${HOSTED_IN_CLAUDE?'':'<button type="button" class="link" data-pf="to-email">Email for password reset</button>'}<button type="button" class="link" data-pf="to-privacy">Privacy and your data</button><button type="button" class="link" data-pf="to-feedback">Send feedback</button><button type="button" class="link" data-pf="to-settings">Text size and display</button>${v2MeLinks()}</div>
  <button type="button" class="pfBig pfOut" data-pf="logout">Log out</button>
  ${PROF.note?`<p class="mut" role="status">${esc(PROF.note)}</p>`:''}</div>`;return}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-disp]');if(!b)return;const [k,v]=b.dataset.disp.split(':');DISP.set(k,v);profRender()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-pf-fbk]');if(!b)return;PROF.f.fbk=b.dataset.pfFbk;const t=$('pfFb');if(t)PROF.f.pfFb=t.value;const c=$('pfFbDev');if(c)PROF.f.fbDev=c.checked;profRender()});
function profCollect(){['pfEmail','pfWho','pfFirst','pfLast','pfUser','pfU','pfPw','pfCq','pfPw1','pfPw2','pfNewPw','pfNewPw2','pfCurPw','pfDelPw','hcHi','hcD','hcC','hcA','hcCR','hcSl','hcP'].forEach(id=>{const el=$(id);if(el){const k=id==='pfCq'?'cq':id;PROF.f[k]=el.value}})}
async function profShrink(file){const url=URL.createObjectURL(file);try{const im=new Image();im.src=url;await im.decode();const S=256,c=document.createElement('canvas');c.width=c.height=S;const s=Math.min(im.naturalWidth,im.naturalHeight);
 c.getContext('2d').drawImage(im,(im.naturalWidth-s)/2,(im.naturalHeight-s)/2,s,s,0,0,S,S);return c.toDataURL('image/jpeg',.8)}finally{URL.revokeObjectURL(url)}}
// ---- filming guide: shown before the camera opens (tap "Don't show this again" to skip it) ----
// top-down pictures: where the golfer, ball, target and phone go. Drawn for a right-hander and flipped for a left-hander.
function filmPic(kind){const L=typeof Hand!=='undefined'&&Hand.get()==='left',X=x=>L?320-x:x,A=a=>L?(a==='start'?'end':a==='end'?'start':a):a;
 // seen from above. A right-hander's target is on their left: facing the phone, that's to the right of the picture
 const golfer=(x,y,rot)=>`<g transform="translate(${X(x)} ${y}) rotate(${rot})"><ellipse rx="18" ry="8.5" fill="var(--fgBody)"/><circle r="7.5" fill="var(--fgHead)"/></g>`;
 const phone=(x,y)=>`<g transform="translate(${X(x)} ${y})"><path d="M-34 -20 L0 -4 L34 -20" fill="none" stroke="var(--fgPhone)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7"/><rect x="-9" y="-12" width="18" height="26" rx="4" fill="var(--fgPhone)"/></g>`;
 const line=(x1,y1,x2,y2)=>{const a=Math.atan2(y2-y1,X(x2)-X(x1))*180/Math.PI;return `<line x1="${X(x1)}" y1="${y1}" x2="${X(x2)}" y2="${y2}" stroke="var(--fgLine)" stroke-width="2" stroke-dasharray="6 5"/><path d="M0 0 l-10 -6 v12z" fill="var(--fgLine)" transform="translate(${X(x2)} ${y2}) rotate(${a})"/>`};
 const ball=(x,y)=>`<circle cx="${X(x)}" cy="${y}" r="4.5" fill="#fff" stroke="var(--fgLine)" stroke-width="1.3"/>`;
 const txt=(x,y,t,anc,cls)=>`<text x="${X(x)}" y="${y}" text-anchor="${A(anc||'start')}" class="${cls||'fgL'}">${t}</text>`;
 let g='',lab='';
 if(kind==='face'){g=line(160,72,290,72)+txt(290,62,'Target','end')+ball(160,72)+golfer(160,50,0)+phone(160,150)+txt(180,155,'Phone at hip height,','start')+txt(180,170,'about 3 m away','start');lab='Facing you: the phone looks at your chest from about 3 metres'}
 else if(kind==='dtl'){g=line(150,165,150,20)+txt(160,26,'Target')+ball(150,95)+golfer(112,95,90)+phone(130,160)+txt(152,166,'Phone behind your hands');lab='Down the line: the phone is behind your hands, looking at the target'}
 else{g=line(160,165,160,20)+txt(170,26,'Target')+ball(160,118)+golfer(122,118,90)+phone(160,165)+txt(182,160,'Phone low,')+txt(182,175,'2–3 m behind the ball');lab='The phone sits low, 2 to 3 metres behind the ball, on the line to the target'}
 return `<figure class="fgFig"><svg viewBox="0 0 320 185" class="fgPic" role="img" aria-label="Seen from above. ${lab}">${g}</svg><figcaption>${kind==='face'?'Facing you':kind==='dtl'?'Down the line':'Behind the ball'}</figcaption></figure>`}
const FILM={
 swing:{h:'Before you film your swing',pics:['face','dtl'],tips:['Phone at hip height, about 3 metres (4 big steps) away.','Your whole body and the club in the picture, with a little space above your head and below your feet.','Prop the phone so it stays still: against your bag, a shoe, or on a tripod.','Light behind the phone, not behind you.','Start recording before you set up and stop after your finish.'],input:'rec'},
 tracer:{h:'Before you film a shot',pics:['tracer'],tips:['Directly behind the ball, on the line to your target, 2 to 3 metres back.','Phone low and still: on the ground or propped at knee to waist height.','Film at 60 frames a second if your phone can (iPhone: Settings › Camera › Record Video).','No zoom, and keep plenty of sky above the target in the picture.','Keep recording for 3 to 4 seconds after you hit it.'],input:'trRec'}};
const fgSkip=k=>{try{return localStorage.getItem('cc_fg_'+k)==='1'}catch(_){return false}};
function filmGuide(kind){const g=FILM[kind];if(fgSkip(kind)){$(g.input).click();return}
 let o=$('fgOv');if(!o){o=document.createElement('div');o.id='fgOv';o.className='fgOv';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');document.body.appendChild(o)}
 o.setAttribute('aria-label',g.h);
 o.innerHTML=`<div class="fgSheet"><button type="button" class="fgX" data-fg="close" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
  <h2>${g.h}</h2><div class="fgPics">${g.pics.map(filmPic).join('')}</div>
  <ul class="fgTips">${g.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
  <label class="fgNo"><input type="checkbox" id="fgNo"> Don't show this again</label>
  <button type="button" class="pri pfBig" data-fg="go" data-k="${kind}">Open the camera</button></div>`;
 o.hidden=false;document.documentElement.classList.add('pfOpen');setTimeout(()=>{const b=o.querySelector('[data-fg=go]');if(b)b.focus()},30)}
function fgClose(){const o=$('fgOv');if(o)o.hidden=true;document.documentElement.classList.remove('pfOpen')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-film]');if(b){e.preventDefault();filmGuide(b.dataset.film);return}
 const f=e.target.closest('[data-fg]');if(!f){if(e.target.id==='fgOv')fgClose();return}
 if(f.dataset.fg==='close')return fgClose();
 if(f.dataset.fg==='go'){const k=f.dataset.k;try{if($('fgNo').checked)localStorage.setItem('cc_fg_'+k,'1')}catch(_){}fgClose();$(FILM[k].input).click()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('fgOv')&&!$('fgOv').hidden)fgClose()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-fg-show]');if(!b)return;const k=b.dataset.fgShow;try{localStorage.removeItem('cc_fg_'+k)}catch(_){}filmGuide(k)});
// after an analysis: anything about how it was filmed that would make the next one better
function filmCheck(dense,W,H){if(!dense||!dense.length)return [];const out=[];
 const vis=(p,i)=>p.pts&&p.pts[i]&&(p.pts[i].vis==null||p.pts[i].vis>0.5);
 const hts=dense.map(f=>{const P=f.pts;if(!P)return null;const top=Math.min(P[0].y,P[7]?P[7].y:P[0].y,P[8]?P[8].y:P[0].y),foot=Math.max(P[27].y,P[28].y,P[31]?P[31].y:0,P[32]?P[32].y:0);return(foot-top)/H}).filter(x=>x!=null).sort((a,b)=>a-b);
 const tall=hts.length?hts[hts.length>>1]:null;
 if(tall!=null&&tall<0.4)out.push(`You were quite small in the picture (about ${Math.round(tall*100)}% of its height). Move the phone a step or two closer so you fill more of it, and the tracking gets more precise.`);
 const off=dense.filter(f=>f.pts&&(f.pts[0].y<0.01*H||Math.max(f.pts[27].y,f.pts[28].y)>0.99*H||Math.min(f.pts[15].x,f.pts[16].x)<0||Math.max(f.pts[15].x,f.pts[16].x)>W)).length;
 if(off>dense.length*0.15)out.push('Part of you went out of the picture during the swing. Move the phone back a step so your head, hands and feet stay in view from start to finish.');
 return out}
// ---- progress charts: one series, thin line, ringed dots, the latest value labelled, tap any point for its value ----
function niceTicks(lo,hi,n){const span=hi-lo||1,raw=span/n,mag=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw)||raw;const a=[];for(let v=Math.ceil(lo/st)*st;v<=hi+1e-9;v+=st)a.push(+v.toFixed(6));return a}
// pts: [{y, tip, lab}] oldest first. o: {fmt, title, h, invert (lower is better: shown going up)}
function trendChart(pts,o){o=o||{};if(!pts||pts.length<2)return '';const fmt=o.fmt||(v=>String(v));
 const W=340,H=o.h||132,pl=34,pr=14,pt=16,pb=22,ys=pts.map(p=>p.y);let lo=Math.min(...ys),hi=Math.max(...ys);if(hi-lo<2){const m=(hi+lo)/2;lo=m-1;hi=m+1}const pd=(hi-lo)*.15;lo-=pd;hi+=pd;
 const tk=niceTicks(lo,hi,3),X=i=>pl+(pts.length===1?0:i*(W-pl-pr)/(pts.length-1)),Y=v=>{const f=(v-lo)/((hi-lo)||1);return o.invert?pt+f*(H-pt-pb):H-pb-f*(H-pt-pb)};
 const line=pts.map((p,i)=>`${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' '),L=pts[pts.length-1],lx=X(pts.length-1),ly=Y(L.y);
 const area=o.area?`<polygon points="${X(0).toFixed(1)},${H-pb} ${line} ${lx.toFixed(1)},${H-pb}" fill="var(--chart)" opacity=".1"/>`:'';
 const hitW=(W-pl-pr)/Math.max(1,pts.length-1);
 return `<figure class="tc"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title||'Trend')}: ${pts.map(p=>fmt(p.y)).join(', ')}">
  ${tk.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="tcG"/><text x="${pl-6}" y="${(Y(v)+3.5).toFixed(1)}" class="tcT" text-anchor="end">${esc(fmt(v))}</text>`).join('')}
  ${area}<polyline points="${line}" fill="none" stroke="var(--chart)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${pts.map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${i===pts.length-1?4.5:3.5}" fill="var(--chart)" stroke="var(--card)" stroke-width="2"/>`).join('')}
  <text x="${Math.min(lx,W-pr-2).toFixed(1)}" y="${(ly-9).toFixed(1)}" class="tcV" text-anchor="end">${esc(fmt(L.y))}</text>
  ${pts[0].lab?`<text x="${pl}" y="${H-5}" class="tcT">${esc(pts[0].lab)}</text>`:''}${L.lab?`<text x="${W-pr}" y="${H-5}" class="tcT" text-anchor="end">${esc(L.lab)}</text>`:''}
  ${pts.map((p,i)=>`<rect x="${(X(i)-hitW/2).toFixed(1)}" y="0" width="${hitW.toFixed(1)}" height="${H}" fill="transparent" data-tip="${esc((p.lab?p.lab+': ':'')+(p.tip||fmt(p.y)))}" data-tx="${(X(i)/W*100).toFixed(1)}" data-ty="${(Y(p.y)/H*100).toFixed(1)}"/>`).join('')}
 </svg><div class="tcTip" hidden></div>
 <table class="vh"><caption>${esc(o.title||'Trend')}</caption><tbody>${pts.map(p=>`<tr><th>${esc(p.lab||'')}</th><td>${esc(p.tip||fmt(p.y))}</td></tr>`).join('')}</tbody></table></figure>`}
// tap or hover a point: its value in a small tip; the dot under it is ringed bigger
function tcShow(r){const f=r.closest('.tc'),tip=f.querySelector('.tcTip');tip.textContent=r.dataset.tip;tip.hidden=false;
 const x=+r.dataset.tx,y=+r.dataset.ty;tip.style.left=Math.max(4,Math.min(96,x))+'%';tip.style.top=y+'%';tip.classList.toggle('lft',x>70);tip.classList.toggle('rgt',x<30)}
document.addEventListener('pointerover',e=>{const r=e.target.closest&&e.target.closest('.tc [data-tip]');if(r)tcShow(r)});
document.addEventListener('pointerout',e=>{const r=e.target.closest&&e.target.closest('.tc [data-tip]');if(r&&!(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest('.tc [data-tip]'))){const t=r.closest('.tc').querySelector('.tcTip');t.hidden=true}});
document.addEventListener('click',e=>{const r=e.target.closest&&e.target.closest('.tc [data-tip]');if(r)tcShow(r)});

// ================= WEEKLY PRACTICE PLAN: from your swing and your rounds, three sessions to tick off =================
// short-game and scoring work that isn't a swing drill (no 3D demo, just clear steps)
const TASKS={
 gate:{name:'Gate putting from 3 feet',time:'10 min',where:'Practice green',steps:['Push two tees in either side of the hole, a putter-head apart, 3 feet away.','Hole 20 putts through the gate. Start again if you miss two in a row.'],why:'putts inside 6 feet'},
 ladder:{name:'Lag ladder: 20, 30, 40 feet',time:'15 min',where:'Practice green',steps:['Three balls from 20, 30 and 40 feet.','Each must finish inside a putter length of the hole (past it is fine).','Do the ladder three times; count how many finish in the zone.'],why:'three-putts'},
 updown:{name:'Up-and-down game',time:'20 min',where:'Short-game area',steps:['Drop 9 balls around a green: 3 in the fringe, 3 in light rough, 3 in a bunker if there is one.','Chip and putt each one out. Score 1 point for every up-and-down.','Beat your score next time.'],why:'getting up and down'},
 landing:{name:'Chip to a landing spot',time:'15 min',where:'Short-game area',steps:['Lay a towel 3 paces onto the green.','Chip 20 balls trying to land on the towel and let them run out.','Change club (wedge, 9 iron, 7 iron) and watch how far each rolls.'],why:'chipping close'},
 sand:{name:'Line in the sand',time:'15 min',where:'Bunker',steps:['Draw a line in the sand. Without a ball, hit the sand just after the line, 10 times.','Put a ball 2 inches ahead of a new line and splash it out. 20 balls.'],why:'bunker play'},
 fairway:{name:'Fairway finder',time:'20 min',where:'Range',steps:['Pick two flags about 30 yards apart as the edges of a fairway.','Hit 14 drives, one per hole of a round, with your full routine each time.','Count how many finish between the flags. Aim to beat 7.'],why:'hitting fairways'},
 approach:{name:'Three-club approach ladder',time:'20 min',where:'Range',steps:['Pick three flags at your 9 iron, 7 iron and 5 iron distances.','Hit 5 balls to each, with your full routine.','Score each one that finishes within about 10 yards of the flag.'],why:'hitting greens'}};
const isoWeek=()=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toISOString().slice(0,10)};
const planKey=()=>'cc_plan_'+((typeof Store!=='undefined'&&Store.user)||'me');
async function planBasis(){let rs=[];try{rs=await RStore.list()}catch(_){}const rec=rs.slice(0,5),agg=rec.map(r=>rtStats(r.holes)).reduce((a,s)=>{for(const k in s)if(typeof s[k]==='number')a[k]=(a[k]||0)+s[k];return a},{});
 const sw=LAST?weakAreas(LAST.scores):[],need=[];
 if(agg.pN>=9){const pp18=agg.putts/agg.pN*18,tp=agg.three/Math.max(1,rec.length);if(pp18>=33||tp>=2)need.push({t:tp>=2?'ladder':'gate',why:tp>=2?`${agg.three} three-putts in your last ${rec.length} rounds`:`${pp18.toFixed(1)} putts per 18 holes`});
  if(agg.udN>=4&&agg.ud/agg.udN<0.3)need.push({t:'updown',why:`up and down ${agg.ud} times out of ${agg.udN}`});
  if(agg.sandN>=2&&agg.sand/agg.sandN<0.3)need.push({t:'sand',why:`${agg.sand} sand saves from ${agg.sandN}`});
  if(agg.girN>=9&&agg.gir/agg.girN<0.25)need.push({t:'approach',why:`${Math.round(agg.gir/agg.girN*100)}% greens in regulation`})}
 if(agg.fwN>=7&&agg.fw/agg.fwN<0.4)need.push({t:'fairway',why:`${Math.round(agg.fw/agg.fwN*100)}% fairways hit`});
 return{sw,need,rounds:rec.length}}
async function planMake(){const B=await planBasis(),S=[];
 const swingSession=a=>{const p=pickPair(a);return p.length?{title:areaName(a),why:`Your swing: ${areaName(a).toLowerCase()} scored ${LAST.scores[a]}/10`,items:p.map(d=>({kind:'drill',id:d.id}))}:null};
 if(B.sw[0])S.push(swingSession(B.sw[0]));
 if(B.need[0])S.push({title:TASKS[B.need[0].t].name,why:`Your rounds: ${B.need[0].why}`,items:[{kind:'task',id:B.need[0].t}].concat(B.need[1]?[{kind:'task',id:B.need[1].t}]:[])});
 if(B.sw[1])S.push(swingSession(B.sw[1]));else if(B.sw[0])S.push(swingSession(B.sw[0]));
 if(S.filter(Boolean).length<3&&B.need[2])S.push({title:TASKS[B.need[2].t].name,why:`Your rounds: ${B.need[2].why}`,items:[{kind:'task',id:B.need[2].t}]});
 const fill=[{title:'Rhythm',why:'A good one for any golfer',items:[{kind:'drill',id:'tempo'},{kind:'drill',id:'holdfinish'}]},{title:'Putting',why:'Most strokes are lost on the greens',items:[{kind:'task',id:'gate'},{kind:'task',id:'ladder'}]},{title:'Short game',why:'The quickest way to lower scores',items:[{kind:'task',id:'updown'}]}];
 let out=S.filter(Boolean);for(const f of fill){if(out.length>=3)break;if(!out.some(o=>o.title===f.title))out.push(f)}
 out=out.slice(0,3).map((s,i)=>Object.assign(s,{items:s.items.filter(it=>it.kind==='task'?TASKS[it.id]:DRILLS.some(d=>d.id===it.id))}));
 return{week:isoWeek(),made:Date.now(),sessions:out,done:{},last:null,basis:{swing:!!B.sw.length,rounds:B.rounds}}}
async function planGet(force){let p=lsGet(planKey(),null);const prev=p;if(force||!p||p.week!==isoWeek()){p=await planMake();if(prev){p.streak=(prev.sessions&&prev.sessions.every((s,i)=>prev.done['s'+i]))?(prev.streak||0)+1:0;p.last=prev.last}lsSet(planKey(),p)}return p}
function planDoneN(p){return p.sessions.filter((s,i)=>p.done['s'+i]).length}
async function renderPlan(){const el=$('weekPlan');if(!el)return;const p=await planGet();const n=planDoneN(p),all=n===p.sessions.length;
 el.hidden=false;el.innerHTML=`<div class="rtTop"><div><h2 style="margin:0">This week's practice</h2><small class="mut">${n} of ${p.sessions.length} sessions done${p.streak?` · ${p.streak} week${p.streak===1?'':'s'} in a row`:''}</small></div><button type="button" class="rtLink" data-plan="new">Rebuild</button></div>
  <div class="wpBar" aria-hidden="true">${p.sessions.map((s,i)=>`<i class="${p.done['s'+i]?'on':''}"></i>`).join('')}</div>
  ${p.sessions.map((s,i)=>`<details class="wpS${p.done['s'+i]?' done':''}"${!p.done['s'+i]&&p.sessions.findIndex((x,j)=>!p.done['s'+j])===i?' open':''}><summary><span class="wpN">${p.done['s'+i]?'✓':i+1}</span><span><b>${esc(s.title)}</b><small>${esc(s.why)}</small></span></summary>
   <ul class="wpItems">${s.items.map(it=>{if(it.kind==='task'){const t=TASKS[it.id];return `<li><b>${esc(t.name)}</b><small>${esc(t.where)} · ${esc(t.time)}</small><ol>${t.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></li>`}const d=DRILLS.find(x=>x.id===it.id);return `<li><b>${esc(d.name)}</b><small>${whereLabel(d.where)} · ${esc(d.time)}</small><button type="button" class="link wpGo" data-drill="${d.id}">See how to do it</button></li>`}).join('')}</ul>
   <button type="button" class="${p.done['s'+i]?'':'pri '}wpDo" data-plan="done" data-i="${i}">${p.done['s'+i]?'Done. Tap to undo':'I did this session'}</button></details>`).join('')}
  ${all?`<div class="hcNote" style="margin-top:12px">All done this week. Film a swing to see if it's working${p.basis.rounds?', and your next round will show it in the stats':''}. <button type="button" class="link" data-go="1">Analyse a swing</button></div>`:''}
  ${!p.basis.swing&&!p.basis.rounds?'<p class="mut" style="font-size:13px;margin:10px 0 0">Analyse a swing and log putts and fairways in your rounds, and next week\'s plan is built around what you need.</p>':''}`}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-plan]');if(!b)return;const a=b.dataset.plan;
 if(a==='new'){await planGet(true);return renderPlan()}
 if(a==='done'){const p=await planGet(),k='s'+b.dataset.i;p.done[k]=!p.done[k];if(p.done[k]){p.last=Date.now();if(typeof track==='function')track('practice')}lsSet(planKey(),p);renderPlan();renderHomePlan();if(p.done[k])toast(planDoneN(p)===p.sessions.length?'That\'s the week done. Well played.':'Session ticked off.')}});
// home: where you are with this week's plan, and a nudge when it's been a while
async function renderHomePlan(){const el=$('homePlan');if(!el)return;let p=null;try{p=await planGet()}catch(_){}if(!p){el.hidden=true;return}
 const n=planDoneN(p),N=p.sessions.length,next=p.sessions.find((s,i)=>!p.done['s'+i]),days=p.last?Math.floor((Date.now()-p.last)/864e5):null;
 el.hidden=false;el.innerHTML=`<div class="rtTop"><div><span class="mut">This week's practice</span><h2 class="hgT">${n===N?'All done this week':`${n} of ${N} sessions done`}</h2></div><div class="wpRing" aria-hidden="true" style="--p:${n/N}"><b>${n}/${N}</b></div></div>
  ${days!=null&&days>=5&&n<N?`<p class="hcNote" style="margin:10px 0 0">It's been ${days} days since you last practised. ${next?`Next up: ${esc(next.title.toLowerCase())}.`:''}</p>`:next?`<p class="mut" style="margin:6px 0 0">Next up: ${esc(next.title)}. ${esc(next.why)}.</p>`:''}
  <button type="button" data-go-plan style="margin-top:12px;width:100%">${n===N?'See the plan':'Open this week\'s plan'}</button>`}
setTimeout(()=>{if(!$('p0').hidden)renderHomePlan().catch(()=>{})},0);
document.addEventListener('click',e=>{if(!e.target.closest('[data-go-plan]'))return;tab(3);setTimeout(()=>{const w=$('weekPlan');if(w)w.scrollIntoView({behavior:'smooth',block:'start'})},80)});

// ================= ON THE COURSE: weather, plays-like distance, shot tracking, notes, friends, export =================
// ---- weather and ground height ----
// In the phone app, weather comes through Caddy Coach's own server function (cc-weather), which uses the Met Office once
// its key is added in Supabase, otherwise Open-Meteo, and caches answers. Choosing the service there needs no app update.
// Inside Claude (no server) it asks Open-Meteo directly. Open-Meteo's free service is for non-commercial use only.
const WEATHER={provider:'server',key:''};   // provider: 'server' (recommended), 'open-meteo' or 'openweathermap'
async function wxServer(body){if(HOSTED_IN_CLAUDE||WEATHER.provider!=='server'||typeof SB==='undefined'||!SB.on())return null;
 try{const r=await fetch(`${SB.url}/functions/v1/cc-weather`,{method:'POST',headers:{apikey:SB.key,Authorization:'Bearer '+SB.key,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)return null;return await r.json()}catch(_){return null}}
const WX={now:null,at:0,key:'',elev:{},elevAt:0,elevFrom:null,busy:false};
const omBase=()=>WEATHER.provider==='open-meteo'&&WEATHER.key?'https://customer-api.open-meteo.com':'https://api.open-meteo.com',omKey=()=>WEATHER.key&&WEATHER.provider==='open-meteo'?'&apikey='+encodeURIComponent(WEATHER.key):'';
const OWM_CODE=id=>id>=200&&id<300?95:id>=300&&id<400?53:id>=500&&id<502?61:id>=502&&id<600?65:id>=600&&id<700?73:id>=700&&id<800?45:id===800?0:id===801?1:id===802?2:3;
const WX_CODES={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Cloudy',45:'Fog',48:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Showers',82:'Heavy showers',95:'Thunderstorms',96:'Thunderstorms',99:'Thunderstorms'};
const COMPASS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compass=d=>COMPASS[Math.round(((d%360)+360)%360/22.5)%16];
async function wxFetch(lat,lon){if(lat==null||lon==null)return null;const key=lat.toFixed(2)+','+lon.toFixed(2);
 if(WX.now&&WX.key===key&&Date.now()-WX.at<20*60e3)return WX.now;
 {const w=await wxServer({lat:+lat.toFixed(4),lon:+lon.toFixed(4)});if(w&&w.ws!=null){WX.now={t:w.t,ws:w.ws,wd:w.wd,gust:w.gust,code:w.code,rain:w.rain||0,src:w.src};WX.key=key;WX.at=Date.now();return WX.now}}
 if(WEATHER.provider==='openweathermap'&&WEATHER.key){
  const r=await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&units=metric&appid=${encodeURIComponent(WEATHER.key)}`);if(!r.ok)throw new Error('weather '+r.status);const j=await r.json(),wd=j.wind||{};
  WX.now={t:j.main&&j.main.temp,ws:(wd.speed||0)*2.237,wd:wd.deg||0,gust:wd.gust!=null?wd.gust*2.237:null,code:OWM_CODE(j.weather&&j.weather[0]&&j.weather[0].id),rain:0};WX.key=key;WX.at=Date.now();return WX.now}
 const r=await fetch(`${omBase()}/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&hourly=precipitation_probability&forecast_hours=4&wind_speed_unit=mph&timezone=auto${omKey()}`);
 if(!r.ok)throw new Error('weather '+r.status);const j=await r.json(),c=j.current||{};
 WX.now={t:c.temperature_2m,ws:c.wind_speed_10m,wd:c.wind_direction_10m,gust:c.wind_gusts_10m,code:c.weather_code,rain:Math.max(0,...((j.hourly&&j.hourly.precipitation_probability)||[0]))};WX.key=key;WX.at=Date.now();return WX.now}
function wxLine(w){if(!w)return '';return `${Math.round(w.t)}°C · wind ${Math.round(w.ws)} mph from the ${compass(w.wd)}${w.gust!=null&&w.gust>w.ws+8?`, gusting ${Math.round(w.gust)}`:''} · ${WX_CODES[w.code]||''}${w.rain>=40?` · ${w.rain}% chance of rain in the next few hours`:''}${w.src==='Met Office'?' · Powered by Met Office data':''}`}
async function elevFetch(pts){const need=pts.filter(p=>WX.elev[ekey(p)]==null);
 if(need.length){const sv=await wxServer({action:'elevation',pts:need.map(p=>({lat:+p.lat.toFixed(5),lon:+(p.lng??p.lon).toFixed(5)}))});
  if(sv&&Array.isArray(sv.elevation)&&sv.elevation.length===need.length){sv.elevation.forEach((e,i)=>{WX.elev[ekey(need[i])]=e});return pts.map(p=>WX.elev[ekey(p)])}}
 if(need.length){const r=await fetch(`${omBase()}/v1/elevation?latitude=${need.map(p=>p.lat.toFixed(5)).join(',')}&longitude=${need.map(p=>(p.lng??p.lon).toFixed(5)).join(',')}${omKey()}`);
  if(!r.ok)throw new Error('elevation '+r.status);const j=await r.json();(j.elevation||[]).forEach((e,i)=>{WX.elev[ekey(need[i])]=e})}
 return pts.map(p=>WX.elev[ekey(p)])}
const ekey=p=>p.lat.toFixed(4)+','+(p.lng??p.lon).toFixed(4);
const bearingTo=(a,b)=>{const la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180,dl=((b.lng??b.lon)-(a.lng??a.lon))*Math.PI/180;return(Math.atan2(Math.sin(dl)*Math.cos(la2),Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dl))*180/Math.PI+360)%360};
// how far a shot plays: wind along the line (into it costs about 1% a mph, helping wind gives back half that),
// temperature (about 1.3% for every 10°F colder than 21°C) and the height of the target against where you stand
function playsLike(d,from,to){if(!d||!from||!to)return null;const w=WX.now,parts=[];let x=d;
 if(w&&w.ws!=null){const head=w.ws*Math.cos((w.wd-bearingTo(from,to))*Math.PI/180),a=Math.round(head>0?d*0.01*head:d*0.005*head);if(Math.abs(a)>=1){x+=a;parts.push(a>0?`into the wind +${a}`:`wind helping ${a}`)}
  const tA=Math.round(d*0.0024*(21-w.t));if(Math.abs(tA)>=1){x+=tA;parts.push(tA>0?`cold +${tA}`:`warm ${tA}`)}}
 const e1=WX.elev[ekey(from)],e2=WX.elev[ekey(to)];
 if(e1!=null&&e2!=null){const eA=Math.round((e2-e1)*1.094);if(Math.abs(eA)>=1){x+=eA;parts.push(eA>0?`uphill +${eA}`:`downhill ${eA}`)}}
 if(!parts.length)return null;return{yds:Math.round(x),parts}}
// ask for the heights of you and the green when you've moved, at most every 10 seconds
function elevMaybe(g){if(HOSTED_IN_CLAUDE||!GPS.pos||!g||WX.busy)return;const p={lat:GPS.pos.lat,lng:GPS.pos.lng};
 if(WX.elevFrom&&ydsBetween(WX.elevFrom,p)<15&&WX.elev[ekey(p)]!=null&&WX.elev[ekey(g)]!=null)return;if(Date.now()-WX.elevAt<10000)return;
 WX.busy=true;WX.elevAt=Date.now();elevFetch([p,{lat:g.lat,lon:g.lon}]).then(()=>{WX.elevFrom=p;gpsPanel()}).catch(()=>{}).finally(()=>{WX.busy=false})}
function wxMaybe(){if(HOSTED_IN_CLAUDE)return;const r=RT.live,c=GPS.course||r&&r.course,lat=GPS.pos?GPS.pos.lat:c&&c.lat,lon=GPS.pos?GPS.pos.lng:c&&c.lon;if(lat==null)return;
 if(WX.now&&Date.now()-WX.at<20*60e3)return;wxFetch(lat,lon).then(()=>{if(!$('gpsOv').hidden)gpsPanel()}).catch(()=>{})}

// ---- shot tracking: mark where each shot is hit from; the gap to the next mark is how far it went ----
function holeShots(h){const s=h.shots||[],out=[];for(let k=0;k<s.length;k++){const to=s[k+1]||h.end;out.push({club:s[k].club,from:s[k],yds:to?ydsBetween(s[k],to):null})}return out}
function shotsHTML(h){const s=holeShots(h);const open=GPS.mark;
 const bag=(BG.bag&&BG.bag.clubs)||BAG_DEFAULT,g=greenOf(h),d=g&&GPS.pos?ydsBetween(GPS.pos,{lat:g.lat,lon:g.lon}):null,pl=d&&g&&GPS.pos?playsLike(d,GPS.pos,g):null,sug=d&&d<=330?clubPick(pl?pl.yds:d):null;
 return `<div class="shTr"><div class="rtTop"><b>Your shots</b>${s.length?`<span class="mut" style="font-size:13px">${s.length} marked</span>`:''}</div>
  ${s.length?`<ol class="shList">${s.map((x,k)=>`<li><span>${esc(clubName(x.club))}</span><b>${x.yds!=null?x.yds+' yds':k===s.length-1?'in play':'–'}</b></li>`).join('')}</ol>`:'<p class="gpsP sm" style="margin:4px 0 0">Mark each shot where you hit it from. Caddy Coach measures how far each club really goes and keeps your bag yardages honest.</p>'}
  ${open?`<p class="gpsP" style="margin:8px 0 4px">Which club are you hitting from here?</p><div class="shClubs">${bagOrder(bag).filter(id=>id!=='P').map(id=>`<button type="button" class="chip${sug&&sug.id===id?' sug':''}" data-shot-club="${id}">${esc(clubShort(id))}</button>`).join('')}</div><button type="button" class="cmLink" data-shot="cancel">Cancel</button>`
  :`<div class="gpsActs"><button type="button" class="hrBtn sm" data-shot="mark" ${GPS.pos?'':'disabled'}>Mark a shot from here</button>${s.length&&!h.end?`<button type="button" class="hrBtn ghost sm" data-shot="green" ${GPS.pos?'':'disabled'}>My ball's on the green</button>`:''}${s.length?`<button type="button" class="hrBtn ghost sm" data-shot="undo">Undo</button>`:''}</div>`}</div>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-shot],[data-shot-club]');if(!b||!RT.live)return;const h=gpsHole();
 if(b.dataset.shotClub){if(!GPS.pos)return;h.shots=h.shots||[];h.shots.push({lat:+GPS.pos.lat.toFixed(6),lon:+GPS.pos.lng.toFixed(6),club:b.dataset.shotClub,acc:Math.round(GPS.pos.acc||0),t:Date.now()});h.end=null;GPS.mark=false;rtSaveLive();return gpsPanel()}
 const a=b.dataset.shot;
 if(a==='mark'){GPS.mark=true;return gpsPanel()}if(a==='cancel'){GPS.mark=false;return gpsPanel()}
 if(a==='green'&&GPS.pos){h.end={lat:+GPS.pos.lat.toFixed(6),lon:+GPS.pos.lng.toFixed(6)};rtSaveLive();return gpsPanel()}
 if(a==='undo'){if(h.end)h.end=null;else if(h.shots)h.shots.pop();rtSaveLive();return gpsPanel()}});
// every measured shot from your rounds, by club (GPS distance includes the roll)
async function clubDistances(){let rs=[];try{rs=await RStore.list()}catch(_){}if(RT.live)rs=rs.concat([RT.live]);const by={};
 for(const r of rs)for(const h of r.holes||[])for(const s of holeShots(h)){if(s.yds==null||s.yds<15||s.yds>380||!s.club)continue;(by[s.club]=by[s.club]||[]).push(s.yds)}
 const out={};for(const k in by){const a=by[k].slice().sort((x,y)=>x-y),n=a.length,trim=n>=5?a.slice(Math.floor(n*0.15),Math.ceil(n*0.85)):a;out[k]={n,avg:Math.round(trim.reduce((p,q)=>p+q,0)/trim.length),lo:a[0],hi:a[n-1]}}
 return out}

// ---- hole notes: yours for each hole of a course, shown when you get there ----
async function noteSave(r,n,text){r.notes=r.notes||{};if(text)r.notes[n]=text.slice(0,240);else delete r.notes[n];rtSaveLive();
 try{const c=await RStore.getCourse(r.course.key);if(c){c.notes=Object.assign({},r.notes);await RStore.saveCourse(c);if(RT.course&&keyBase(RT.course.key)===keyBase(c.key))RT.course.notes=c.notes}}catch(e){console.error(e)}}
function noteHTML(r,h){const n=r.notes&&r.notes[h.n];
 if(RT.noteEd)return `<form class="hNote ed" data-rt-form="note"><label for="rtNote">Your note for hole ${h.n}</label><textarea id="rtNote" maxlength="240" rows="2" placeholder="e.g. Lay up short of the ditch, 7 iron off the tee">${esc(n||'')}</textarea><div class="rtTwo"><button type="button" data-rt="note-cancel">Cancel</button><button type="submit" class="pri">Save note</button></div></form>`;
 return n?`<div class="hNote"><span>Your note</span><p>${esc(n)}</p><button type="button" class="rtLink" data-rt="note-edit">Edit</button></div>`:`<button type="button" class="rtLink hNoteAdd" data-rt="note-edit">Add a note for this hole</button>`}

// ---- playing with friends: up to three others on your phone, with their own handicaps ----
function palCh(p,hs,t){if(p.hi==null||!t||!(+t.rating>0)||!(+t.slope>0))return null;const par=hs.reduce((a,h)=>a+h.par,0);return hs.length>=18?WHS.courseHcp(p.hi,+t.rating,+t.slope,par):WHS.courseHcp9(p.hi,WHS.rating9(+t.rating),+t.slope,par)}
function palsHTML(t,hs){const P=RT.pals||[];
 return `<div class="pals"><p class="rtLab" style="margin:0 0 6px">Playing with</p>
  ${P.length?`<ul class="palList">${P.map((p,i)=>{const ch=palCh(p,hs,t);return `<li><b>${esc(p.name)}</b><span>${p.hi==null?'No handicap':`Index ${WHS.fmt(p.hi)}${ch!=null?` · plays off ${chTxt(ch)}`:''}`}</span><button type="button" class="rtLink" data-pal-del="${i}" aria-label="Remove ${esc(p.name)}">Remove</button></li>`}).join('')}</ul>`:''}
  ${P.length<3?(RT.palAdd?`<form class="palForm" data-rt-form="pal"><input id="palName" maxlength="20" placeholder="Name" aria-label="Their name" autocomplete="off"><input id="palHi" inputmode="decimal" maxlength="5" placeholder="Index" aria-label="Their handicap index (optional)" autocomplete="off"><button type="submit">Add</button></form>${RT.palErr?`<p class="rtMsg" role="alert">${esc(RT.palErr)}</p>`:''}`:`<button type="button" class="rtLink" data-rt="pal-add">${P.length?'Add another player':'Add players to keep their scores too'}</button>`):''}</div>`}
const palShots=(p,holes)=>{if(p.ch==null)return null;const {r:rk}=WHS.ranks(holes);return holes.map((h,i)=>WHS.strokesOn(p.ch,rk[i],holes.length))};
function palTotals(r){return(r.others||[]).map(p=>{const sh=palShots(p,r.holes);let g=0,n=0,pts=0,net=0;r.holes.forEach((h,i)=>{const s=p.sc[i];if(s==null)return;n++;g+=s;if(sh){pts+=rtPts({score:s,par:h.par},sh[i]);net+=s-sh[i]}});return{p,g,n,pts:sh?pts:null,net:sh?net:null}})}
// match play against each friend: the higher handicap gets the difference, on the hardest holes
function matchStatus(r,p){const diff=(p.ch??0)-(r.ch??0),{r:rk}=WHS.ranks(r.holes),N=r.holes.length;
 let up=0,played=0,last=-1;
 for(let i=0;i<N;i++){const h=r.holes[i],a=h.score,b=p.sc[i];if(a==null||b==null)continue;played++;last=i;
  const st=WHS.strokesOn(Math.abs(diff),rk[i],N),na=a-(diff<0?st:0),nb=b-(diff>0?st:0);if(na<nb)up++;else if(nb<na)up--;
  // decided: more holes up than there are left to play
  const left=N-1-i;if(Math.abs(up)>left)return{txt:`${up>0?'You win':`${p.name} wins`} ${left?`${Math.abs(up)}&${left}`:`${Math.abs(up)} up`}`,up,done:true}}
 if(!played)return{txt:'Not started',up:0,done:false};
 const left=N-1-last;if(!left)return{txt:up===0?'Halved':`${up>0?'You win':`${p.name} wins`} ${Math.abs(up)} up`,up,done:true};
 return{txt:up===0?`All square thru ${played}`:`${up>0?'You':p.name} ${Math.abs(up)} up thru ${played}${Math.abs(up)===left?' (dormie)':''}`,up,done:false}}
function palsPlayHTML(r){const O=r.others||[];if(!O.length)return '';const i=r.i,h=r.holes[i];
 return `<div class="card palsPlay"><h2>Your group</h2>${O.map((p,k)=>{const s=p.sc[i],sh=palShots(p,r.holes),st=sh?sh[i]:0;const m=matchStatus(r,p);return `<div class="palRow"><div><b>${esc(p.name)}</b><small>${st>0?`${st} shot${st===1?'':'s'} here · `:''}${esc(m.txt)}</small></div>
   <div class="palStep"><button type="button" data-pal-step="${k}:-1" aria-label="${esc(p.name)}: one fewer">–</button><output>${s??'–'}</output><button type="button" data-pal-step="${k}:1" aria-label="${esc(p.name)}: one more">+</button></div></div>`}).join('')}</div>`}
function palsSummaryHTML(r){if(!(r.others||[]).length)return '';const me=rtNet(r),tl=tally(r.holes),rows=[{name:'You',g:tl.total,n:tl.thru,pts:me?me.pts:null,net:me?me.net:null}].concat(palTotals(r).map(x=>({name:x.p.name,g:x.g,n:x.n,pts:x.pts,net:x.net})));
 const usePts=rows.every(x=>x.pts!=null);rows.sort((a,b)=>usePts?b.pts-a.pts:a.g-b.g);
 return `<div class="card"><h2>Your group</h2><table class="palTab"><thead><tr><th>Player</th><th>Gross</th><th>Net</th><th>Points</th></tr></thead><tbody>${rows.map(x=>`<tr${x.name==='You'?' class="me"':''}><td>${esc(x.name)}</td><td>${x.n?x.g:'–'}</td><td>${x.net??'–'}</td><td>${x.pts??'–'}</td></tr>`).join('')}</tbody></table>
  ${(r.others||[]).map(p=>`<p class="palMatch">Match play against ${esc(p.name)}: <b>${esc(matchStatus(r,p).txt)}</b></p>`).join('')}</div>`}

// ---- share cards: a picture of your round or your swing, for WhatsApp, Instagram or anywhere ----
const SC_FONT='"Instrument Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
function scCanvas(){const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,0,1350);g.addColorStop(0,'#123f26');g.addColorStop(1,'#0a2416');x.fillStyle=g;x.fillRect(0,0,1080,1350);
 x.fillStyle='rgba(255,255,255,.05)';for(let i=0;i<12;i++){x.fillRect(0,i*120+40,1080,48)}   // mown stripes
 return{c,x}}
function scFoot(x){x.fillStyle='rgba(242,245,238,.75)';x.font=`600 34px ${SC_FONT}`;x.textAlign='left';x.fillText('Caddy Coach',72,1290)}
function scFit(x,t,max,size,weight){let s=size;x.font=`${weight||600} ${s}px ${SC_FONT}`;while(x.measureText(t).width>max&&s>20){s-=2;x.font=`${weight||600} ${s}px ${SC_FONT}`}return s}
async function roundCardBlob(r){try{await document.fonts.ready}catch(_){}const {c,x}=scCanvas(),tl=tally(r.holes),nt=rtNet(r),st=rtStats(r.holes);
 x.fillStyle='#f2f5ee';x.textAlign='left';scFit(x,r.course.name,936,64);x.fillText(r.course.name,72,150);
 x.fillStyle='rgba(242,245,238,.75)';x.font=`500 34px ${SC_FONT}`;x.fillText(`${fmtRoundDate(r.date)} · ${r.tee.name} tees · ${tl.thru} holes`,72,205);
 x.fillStyle='#f2f5ee';x.font=`600 300px ${SC_FONT}`;x.fillText(String(tl.total||'–'),60,520);
 const w=x.measureText(String(tl.total||'–')).width;x.font=`600 72px ${SC_FONT}`;x.fillStyle='#e6d7aa';x.fillText(tl.thru?toParShort(tl.toPar):'',60+w+30,430);
 let y=600;const box=(lab,val,i)=>{const bx=72+i*320;x.fillStyle='rgba(255,255,255,.08)';x.beginPath();x.roundRect(bx,y,296,150,24);x.fill();x.fillStyle='#f2f5ee';x.font=`600 64px ${SC_FONT}`;x.fillText(val,bx+28,y+80);x.fillStyle='rgba(242,245,238,.7)';x.font=`500 28px ${SC_FONT}`;x.fillText(lab,bx+28,y+124)};
 const boxes=[];if(nt)boxes.push(['Stableford points',String(nt.pts)]);boxes.push(['Birdies or better',String(tl.k.b+tl.k.e)]);boxes.push(['Pars',String(tl.k.p)]);if(st.pN)boxes.push(['Putts',String(st.putts)]);
 boxes.slice(0,3).forEach((b,i)=>box(b[0],b[1],i));
 // the card: one row per nine
 y=820;const rows=[];for(let i=0;i<r.holes.length;i+=9)rows.push(r.holes.slice(i,i+9));
 rows.forEach((hs,ri)=>{const top=y+ri*170,cw=96;hs.forEach((h,j)=>{const cx=72+j*cw+cw/2;x.textAlign='center';x.fillStyle='rgba(242,245,238,.6)';x.font=`500 26px ${SC_FONT}`;x.fillText(String(h.n),cx,top+30);
   const d=h.score==null?null:h.score-h.par;x.fillStyle=d==null?'rgba(255,255,255,.12)':d<=-1?'#e6d7aa':d===0?'rgba(255,255,255,.16)':d===1?'rgba(255,255,255,.08)':'#d23a2f';
   x.beginPath();x.roundRect(cx-38,top+48,76,76,d!=null&&d<=-1?38:14);x.fill();x.fillStyle=d!=null&&d<=-1?'#0a2416':'#f2f5ee';x.font=`600 40px ${SC_FONT}`;x.fillText(h.score==null?'·':String(h.score),cx,top+100)});x.textAlign='left'});
 scFoot(x);return new Promise(res=>c.toBlob(res,'image/png'))}
async function swingCardBlob(){try{await document.fonts.ready}catch(_){}const {c,x}=scCanvas(),R=RES.R,s=R.scores,L=SwingMetrics.level(s.overall),k=RES.keys&&(RES.keys.find(q=>q.lab==='Top')||RES.keys[0]);
 if(k&&k.img){const im=new Image();im.src=k.img;try{await im.decode();const h=760,w=h*im.width/im.height;x.save();x.beginPath();x.roundRect(1008-w,150,w,h,28);x.clip();x.drawImage(im,1008-w,150,w,h);x.restore()}catch(_){}}
 x.fillStyle='rgba(242,245,238,.75)';x.font=`500 34px ${SC_FONT}`;x.textAlign='left';x.fillText('My swing score',72,190);
 x.fillStyle='#f2f5ee';x.font=`600 240px ${SC_FONT}`;x.fillText(String(s.overall),60,420);x.font=`600 60px ${SC_FONT}`;x.fillStyle='rgba(242,245,238,.6)';x.fillText('/10',72,500);
 if(L){x.fillStyle='#e6d7aa';scFit(x,L.band,350,44);x.fillText(L.band,72,600);x.fillStyle='rgba(242,245,238,.7)';scFit(x,'Handicap '+L.hcp,350,32,500);x.fillText('Handicap '+L.hcp,72,650)}
 const tp=RES.text&&RES.text.top_priority;if(tp){x.fillStyle='rgba(242,245,238,.75)';x.font=`500 30px ${SC_FONT}`;x.fillText('Working on',72,1000);x.fillStyle='#f2f5ee';const words=tp.split(' ');let line='',yy=1050;x.font=`600 44px ${SC_FONT}`;for(const w of words){const t=line?line+' '+w:w;if(x.measureText(t).width>936){x.fillText(line,72,yy);yy+=56;line=w}else line=t}if(line)x.fillText(line,72,yy)}
 scFoot(x);return new Promise(res=>c.toBlob(res,'image/png'))}
async function shareBlob(blob,name,text){const f=new File([blob],name,{type:'image/png'});
 try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],text});return 'shared'}}catch(e){if(e&&e.name==='AbortError')return 'cancelled'}
 return (await saveFile(name,blob))==='saved'?'saved':'cancelled'}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-rt="share-card"],[data-share-swing]');if(!b)return;b.disabled=true;
 try{if(b.dataset.shareSwing!=null){if(!RES||!RES.R)return;const bl=await swingCardBlob();const r=await shareBlob(bl,'my-swing.png',`My swing scored ${RES.R.scores.overall}/10 on Caddy Coach`);if(r==='saved')toast('Picture saved. Share it from your photos or downloads.')}
  else{const r=RT.doneRound||RT.detail;if(!r)return;const bl=await roundCardBlob(r),t=tally(r.holes);const res=await shareBlob(bl,'my-round.png',`${t.total} at ${r.course.name}`);if(res==='saved')toast('Picture saved. Share it from your photos or downloads.')}}
 catch(err){console.error(err);toast('Couldn\'t make the picture just now.')}finally{b.disabled=false}});
// ---- club leaderboards: best Stableford round of the month, and who has brought their handicap down most ----
const LB={month:0,data:null,busy:false,err:''};
const lbMonth=k=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(k||0));return d.toISOString().slice(0,7)};
const lbClub=()=>typeof PROF!=='undefined'&&PROF.me&&PROF.me.course?PROF.me.course:null;
const lbName=()=>PROF.me?`${PROF.me.first} ${(PROF.me.last||'')[0]||''}.`.trim():'';
const lbOn=()=>SB.on()&&!!lbClub()&&!!(PROF.me&&PROF.me.username);
function lbEligible(r){const c=lbClub();return lbOn()&&c&&keyBase(r.course.key)===keyBase(c.key)&&r.holes.length===18&&r.ch!=null&&tally(r.holes).thru>=14}
function lbPosted(r){return lsGet('cc_lbp',{})[r.id]}
async function lbPost(r){const c=lbClub(),nt=rtNet(r),t=tally(r.holes),m=(r.date||hcpToday()).slice(0,7);
 await sbSend('course_cards',[{course_key:`lb~${keyBase(c.key)}~${m}`.slice(0,120),name:'Leaderboard',card:{v:1,u:PROF.me.username,name:lbName(),pts:nt.pts,net:nt.net,gross:t.total,thru:t.thru,date:r.date,rid:r.id},device:SB.device()}]);
 const p=lsGet('cc_lbp',{});p[r.id]=1;lsSet('cc_lbp',p);lsSet('cc_lbjoin_'+keyBase(c.key),1);lbHcpPush(true)}
// your handicap progress this month, for the most-improved table (only once you've joined your club's board)
function lbHcpPush(force){if(!lbOn())return;const c=lbClub(),k=keyBase(c.key);if(!force&&!lsGet('cc_lbjoin_'+k,0))return;const rec=HcpStore.rec;if(!rec||!rec.start)return;
 const cc=WHS.calc(rec);if(cc.hi==null)return;const m=lbMonth(0),before=cc.hist.filter(h=>h.date<m+'-01'),start=before.length?before[before.length-1].hi:cc.hist[0].hi;
 sbSend('course_cards',[{course_key:`lbh~${k}~${m}`.slice(0,120),name:'Leaderboard',card:{v:1,u:PROF.me.username,name:lbName(),start,now:cc.hi},device:SB.device()}])}
async function lbLoad(){const c=lbClub();if(!lbOn()){LB.data=null;return}const k=keyBase(c.key),m=lbMonth(LB.month);LB.busy=true;LB.err='';rtRender();
 try{const [a,b]=await Promise.all([sbGet('course_cards',`course_key=eq.${encodeURIComponent(`lb~${k}~${m}`)}&select=card,created_at&order=created_at.desc&limit=500`),sbGet('course_cards',`course_key=eq.${encodeURIComponent(`lbh~${k}~${m}`)}&select=card,created_at&order=created_at.desc&limit=500`)]);
  const best=new Map();for(const x of a||[]){const v=x.card;if(!v||!v.u||!(v.pts>=0))continue;const o=best.get(v.u);if(!o||v.pts>o.pts||(v.pts===o.pts&&v.gross<o.gross))best.set(v.u,v)}
  const imp=new Map();for(const x of b||[]){const v=x.card;if(!v||!v.u||v.start==null||v.now==null)continue;if(!imp.has(v.u))imp.set(v.u,v)}   // newest first: keep each player's latest
  LB.data={m,best:[...best.values()].sort((p,q)=>q.pts-p.pts||p.gross-q.gross).slice(0,30),imp:[...imp.values()].map(v=>Object.assign({},v,{d:+(v.start-v.now).toFixed(1)})).filter(v=>v.d>0).sort((p,q)=>q.d-p.d).slice(0,20)}}
 catch(e){LB.err='The leaderboard couldn\'t be reached just now. Check your signal and try again.'}
 LB.busy=false;rtRender()}
function lbHTML(){const c=lbClub();
 if(HOSTED_IN_CLAUDE||!SB.on())return `<div class="card"><h2>Club leaderboard</h2><p class="mut" style="margin:0">Club leaderboards work in the Caddy Coach app on your phone.</p></div>`;
 if(!c)return `<div class="card"><h2>Club leaderboard</h2><p class="mut" style="margin:0 0 10px">Set your local course in your profile to see its leaderboard.</p><button type="button" data-pf="to-edit">Choose your local course</button></div>`;
 if(!LB.data&&!LB.busy&&!LB.err){lbLoad();}
 const me=PROF.me.username,mlab=new Date(lbMonth(LB.month)+'-15').toLocaleDateString('en-GB',{month:'long',year:'numeric'}),D=LB.data;
 return `<div class="card"><div class="rtTop"><div><h2 style="margin:0">${esc(c.name)}</h2><small class="mut">${mlab}</small></div><div class="lbMon"><button type="button" data-lb-m="1" aria-label="Previous month">‹</button><button type="button" data-lb-m="-1" aria-label="Next month" ${LB.month===0?'disabled':''}>›</button></div></div>
  ${LB.busy?'<div class="rtLoad" role="status"><span class="spin" aria-hidden="true"></span>Loading the leaderboard…</div>':LB.err?`<p class="rtMsg bad" role="alert">${esc(LB.err)}</p>`:''}
  ${D&&!LB.busy?`<h3 class="lbH">Best Stableford round</h3>${D.best.length?`<ol class="lbList">${D.best.map((v,i)=>`<li${v.u===me?' class="me"':''}><span class="lbN">${i+1}</span><span class="lbW"><b>${esc(v.name||v.u)}</b><small>${fmtRoundDate(v.date)} · ${v.gross} gross</small></span><span class="lbV">${tiles(v.pts,'sm')}<small> pts</small></span></li>`).join('')}</ol>`:'<p class="mut">No rounds posted yet this month. Finish an 18-hole round here with your handicap set, then post it from the round.</p>'}
   <h3 class="lbH">Most improved handicap</h3>${D.imp.length?`<ol class="lbList">${D.imp.map((v,i)=>`<li${v.u===me?' class="me"':''}><span class="lbN">${i+1}</span><span class="lbW"><b>${esc(v.name||v.u)}</b><small>${WHS.fmt(v.start)} to ${WHS.fmt(v.now)}</small></span><span class="lbV">${tiles('−'+v.d.toFixed(1),'sm red')}</span></li>`).join('')}</ol>`:'<p class="mut">Nobody has brought their index down yet this month.</p>'}`:''}
  <p class="mut" style="font-size:12.5px;margin:12px 0 0">Only rounds players choose to post appear here, with their first name and initial.</p></div>`}
function lbRoundHTML(r){if(!lbEligible(r))return '';return lbPosted(r)?`<p class="lbDone">Posted to the ${esc(lbClub().name)} leaderboard.</p>`:`<button type="button" class="lbPostBtn" data-rt="lb-post">Post ${rtNet(r).pts} points to the ${esc(lbClub().name)} leaderboard</button>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-lb-m]');if(!b)return;LB.month=Math.max(0,Math.min(11,LB.month+ +b.dataset.lbM));LB.data=null;lbLoad()});
// ===================== getting started, goals, updates inbox, group rounds, club competitions =====================
const meU=()=>typeof PROF!=='undefined'&&PROF.me&&PROF.me.username||'';
const uKey=k=>`cc_${k}_${meU()}`;
async function allRounds(){try{return (await RStore.list())||[]}catch(_){return []}}
async function allSwings(){try{return (await Store.list())||[]}catch(_){return []}}
const fullRound=r=>r&&r.holes&&r.holes.length===18&&tally(r.holes).thru===18;
const curHi=()=>{const r=typeof HcpStore!=='undefined'&&HcpStore.rec;if(!r||!r.start)return null;const c=WHS.calc(r);return c.hi};

// ---- getting started: a short checklist on Home until it's done or dismissed ----
async function onbSteps(){const [rs,sw]=await Promise.all([allRounds(),allSwings()]),rec=typeof HcpStore!=='undefined'&&HcpStore.rec;
 return [
  {k:'hcp',t:'Set your handicap',d:'Or say you don\'t have one yet. Takes a few seconds.',done:!!(rec&&rec.start),act:'data-pf-open="hcp-start"',btn:'Set it'},
  {k:'swing',t:'Film and analyse a swing',d:'From behind or face-on, phone at hip height.',done:sw.length>0,act:'data-go="1"',btn:'Film'},
  {k:'trace',t:'Trace a shot',d:'Draws the ball flight and reads your clubface and path.',done:!!lsGet('cc_lastflight',null),act:'data-go="6"',btn:'Trace'},
  {k:'round',t:'Play a round',d:'Score as you go, with yardages to the green.',done:rs.some(r=>tally(r.holes||[]).thru>=9),act:'data-onb-round',btn:'Start'},
  {k:'goal',t:'Set a goal',d:'Break 90, get your handicap down, or a better swing score.',done:goalsGet().length>0,act:'data-goal-new',btn:'Add'}]}
async function renderHomeStart(){const el=$('homeStart');if(!el)return;if(!meU()||lsGet(uKey('onb_off'),0)){el.hidden=true;return}
 const S=await onbSteps(),n=S.filter(s=>s.done).length;if(n===S.length){el.hidden=true;return}el.hidden=false;
 el.innerHTML=`<figure class="heroImg sm"><img src="hero-swing.jpg" alt="" decoding="async" onerror="this.parentElement.hidden=true"></figure><div class="rtTop"><div><h2 style="margin:0">Get started</h2><small class="mut">${n} of ${S.length} done</small></div><button type="button" class="link" data-onb-off>Hide</button></div>
  <div class="onbBar" role="progressbar" aria-valuemin="0" aria-valuemax="${S.length}" aria-valuenow="${n}" aria-label="Getting started"><i style="width:${n/S.length*100}%"></i></div>
  <ol class="onbList">${S.map(s=>`<li class="${s.done?'ok':''}"><span class="onbTick" aria-hidden="true">${s.done?'✓':''}</span><span class="onbW"><b>${s.t}</b>${s.done?'<small>Done</small>':`<small>${s.d}</small>`}</span>${s.done?'':`<button type="button" ${s.act}>${s.btn}<span class="sr"> – ${s.t.toLowerCase()}</span></button>`}</li>`).join('')}</ol>`}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-onb-off]')){lsSet(uKey('onb_off'),1);renderHomeStart();return}
 if(e.target.closest('[data-onb-round]')){RT.tab='new';tab(8);return}});

// ---- goals: break a score, get your handicap under a number, or reach a swing score ----
const GOAL_T={break:{lab:'Break a score',unit:'',ph:'90'},hcp:{lab:'Handicap under',unit:'',ph:'18.0'},swing:{lab:'Swing score of',unit:'/10',ph:'7.5'}};
const goalsGet=()=>lsGet(uKey('goals'),[]);
const goalsSet=g=>lsSet(uKey('goals'),g);
const GOALS={add:false,err:'',type:'break'};
async function goalProgress(g){
 if(g.type==='break'){const rs=(await allRounds()).filter(r=>fullRound(r)&&(r.finishedAt||Date.parse(r.date))>=g.at);const best=rs.length?Math.min(...rs.map(r=>tally(r.holes).total)):null;
  return{now:best,done:best!=null&&best<g.target,txt:best==null?'No full rounds since you set this yet.':`Best since: ${best}. ${best<g.target?'Done!':`${best-g.target+1} shot${best-g.target+1===1?'':'s'} to go.`}`,pct:best==null?0:Math.max(0,Math.min(1,1-(best-g.target)/Math.max(10,g.start!=null?g.start-g.target:15)))}}
 if(g.type==='hcp'){const hi=curHi();return{now:hi,done:hi!=null&&hi<g.target,txt:hi==null?'Set your handicap to track this.':`Index now ${WHS.fmt(hi)}. ${hi<g.target?'Done!':`${(hi-g.target+0.1).toFixed(1)} to go.`}`,pct:hi==null||g.start==null?0:Math.max(0,Math.min(1,(g.start-hi)/Math.max(0.1,g.start-g.target+0.1)))}}
 const sw=(await allSwings()).filter(s=>(s.createdAt||0)>=g.at&&s.overall!=null),best=sw.length?Math.max(...sw.map(s=>s.overall)):null;
 return{now:best,done:best!=null&&best>=g.target,txt:best==null?'Analyse a swing to track this.':`Best since: ${best}/10. ${best>=g.target?'Done!':`${(g.target-best).toFixed(1)} to go.`}`,pct:best==null?0:Math.max(0,Math.min(1,(best-(g.start??best-1))/Math.max(0.1,g.target-(g.start??best-1))))}}
function goalName(g){return g.type==='break'?`Break ${g.target}`:g.type==='hcp'?`Handicap under ${WHS.fmt(g.target)}`:`Swing score ${g.target}/10`}
function goalTip(g){if(g.type==='break')return g.target<=80?'Practise putts inside 6 feet and chips to one-putt range.':'Take one club more into greens and aim for the middle; double bogeys cost most.';
 if(g.type==='hcp')return 'Submit every round. The index uses your best 8 of the last 20.';return 'Work on your weakest area in this week\'s practice plan, then film again.'}
async function renderHomeGoals(){const el=$('homeGoals');if(!el)return;if(!meU()){el.hidden=true;return}const G=goalsGet();
 if(!G.length&&!GOALS.add){el.hidden=true;return}el.hidden=false;
 const rows=await Promise.all(G.map(async g=>{const p=await goalProgress(g);
  if(p.done&&!g.doneAt){g.doneAt=Date.now();goalsSet(G);inboxAdd('goal-'+g.id,'Goal reached: '+goalName(g),'Well played. Set the next one from Home.')}
  const late=g.by&&!p.done&&g.by<hcpToday();
  return `<li class="${p.done?'ok':''}"><div class="goTop"><b>${goalName(g)}</b>${g.by?`<small class="${late?'late':''}">by ${fmtRoundDate(g.by)}</small>`:''}<button type="button" class="link" data-goal-del="${g.id}" aria-label="Remove goal ${goalName(g)}">Remove</button></div>
   <div class="onbBar"><i style="width:${Math.round((p.done?1:p.pct)*100)}%"></i></div><p class="mut">${esc(p.txt)}${p.done?'':' '+goalTip(g)}</p></li>`}));
 el.innerHTML=`<div class="rtTop"><h2 style="margin:0">Your goals</h2>${GOALS.add?'':`<button type="button" class="link" data-goal-new>Add a goal</button>`}</div>${rows.length?`<ul class="goList">${rows.join('')}</ul>`:''}${GOALS.add?goalFormHTML():''}`}
function goalFormHTML(){const t=GOALS.type;return `<form class="goForm" data-goal-form novalidate><div class="pfSeg pfSeg3" role="radiogroup" aria-label="Kind of goal">${Object.entries(GOAL_T).map(([k,v])=>`<button type="button" role="radio" data-goal-type="${k}" aria-checked="${k===t}">${v.lab.split(' ')[0]==='Break'?'Score':k==='hcp'?'Handicap':'Swing'}</button>`).join('')}</div>
 <div class="hcIn"><label>${GOAL_T[t].lab}<input id="glTarget" inputmode="decimal" placeholder="${GOAL_T[t].ph}" autocomplete="off" maxlength="5"></label><label>By (optional)<input id="glBy" type="date"></label></div>
 ${GOALS.err?`<p class="rtMsg bad" role="alert">${esc(GOALS.err)}</p>`:''}<div class="rtTwo"><button type="button" data-goal-cancel>Cancel</button><button type="submit" class="pri">Save goal</button></div></form>`}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-goal-new],[data-goal-del],[data-goal-type],[data-goal-cancel]');if(!b)return;
 if(b.dataset.goalNew!=null){GOALS.add=true;GOALS.err='';const el=$('homeGoals');if(el)el.hidden=false;await renderHomeGoals();const i=$('glTarget');if(i){i.focus();i.scrollIntoView({block:'center'})}renderHomeStart();return}
 if(b.dataset.goalCancel!=null){GOALS.add=false;return renderHomeGoals()}
 if(b.dataset.goalType){GOALS.type=b.dataset.goalType;return renderHomeGoals()}
 if(b.dataset.goalDel){goalsSet(goalsGet().filter(g=>g.id!==b.dataset.goalDel));renderHomeGoals();renderHomeStart()}});
document.addEventListener('submit',async e=>{if(!e.target.matches('[data-goal-form]'))return;e.preventDefault();const t=GOALS.type,v=parseFloat(String($('glTarget').value).replace(',','.')),by=$('glBy').value||null;
 const bad=t==='break'?!(v>=55&&v<=140&&Number.isInteger(v)):t==='hcp'?!(v>=-5&&v<=54):!(v>0&&v<=10);
 if(bad){GOALS.err=t==='break'?'Enter a whole score between 55 and 140, like 90.':t==='hcp'?'Enter a handicap between +5 and 54, like 18.0.':'Enter a swing score up to 10, like 7.5.';return renderHomeGoals()}
 if(by&&by<hcpToday()){GOALS.err='Pick a date in the future, or leave it blank.';return renderHomeGoals()}
 let start=null;if(t==='hcp')start=curHi();else if(t==='swing'){const s=(await allSwings()).find(x=>x.overall!=null);start=s?s.overall:null}else{const rs=(await allRounds()).filter(fullRound).slice(0,5);start=rs.length?Math.round(rs.reduce((a,r)=>a+tally(r.holes).total,0)/rs.length):null}
 const G=goalsGet();G.push({id:Math.random().toString(36).slice(2,9),type:t,target:t==='hcp'?Math.round(v*10)/10:v,by,at:Date.now(),start});goalsSet(G);GOALS.add=false;GOALS.err='';toast('Goal saved.');renderHomeGoals();renderHomeStart()});

// ---- updates: an inbox on Home, plus a phone notification when a long job finishes in the background ----
const inboxGet=()=>lsGet(uKey('inbox'),[]);
function inboxAdd(id,title,body,go){if(!meU())return;const I=inboxGet();if(I.some(x=>x.id===id))return;I.unshift({id,t:Date.now(),title,body,go:go||null,read:false});lsSet(uKey('inbox'),I.slice(0,30));renderHomeNews()}
function renderHomeNews(){const el=$('homeNews');if(!el)return;const I=inboxGet(),un=I.filter(x=>!x.read);if(!meU()||!un.length){el.hidden=true;return}el.hidden=false;
 el.innerHTML=`<div class="rtTop"><h2 style="margin:0">Updates <span class="nwN">${un.length}</span></h2><button type="button" class="link" data-nw-all>Mark all read</button></div>
  <ul class="nwList">${un.slice(0,5).map(x=>`<li><div><b>${esc(x.title)}</b><p class="mut">${esc(x.body)}</p><small class="mut">${fmtDate(x.t)}</small></div><div class="nwAct">${x.go?`<button type="button" data-nw-go="${esc(x.id)}">Open</button>`:''}<button type="button" class="link" data-nw-read="${esc(x.id)}" aria-label="Dismiss: ${esc(x.title)}">Dismiss</button></div></li>`).join('')}</ul>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-nw-all],[data-nw-read],[data-nw-go]');if(!b)return;const I=inboxGet();
 if(b.dataset.nwAll!=null)I.forEach(x=>x.read=true);
 const id=b.dataset.nwRead||b.dataset.nwGo,x=id&&I.find(q=>q.id===id);if(x)x.read=true;lsSet(uKey('inbox'),I);renderHomeNews();
 if(b.dataset.nwGo&&x&&x.go){if(x.go==='coach'){profShow('me');coachOpenMine();return}if(x.go==='club'){RT.tab='club';LB.data=null;tab(8)}else if(x.go==='plan'){const p=$('homePlan');if(p)p.scrollIntoView({block:'start'})}else if(x.go==='hcp')profShow('hcp');else if(x.go==='group'){RT.tab='new';tab(8)}}});
// things worth telling you, checked when Home opens (at most every 20 minutes for the online ones)
async function inboxCheck(){if(!meU())return;
 const hi=curHi(),hk=uKey('lasthi'),was=lsGet(hk,null);if(hi!=null){if(was!=null&&Math.abs(was-hi)>=0.05)inboxAdd('hi-'+hi+'-'+Date.now(),`Your handicap estimate is now ${WHS.fmt(hi)}`,`It was ${WHS.fmt(was)}. ${hi<was?'Nice work.':'One good round brings it back down.'}`,'hcp');lsSet(hk,hi)}
 try{const p=lsGet(planKey(),null);if(p&&p.sessions&&p.sessions.length){const left=p.sessions.filter((s,i)=>!p.done['s'+i]).length,sw=await allSwings(),last=sw.length?Math.max(...sw.map(s=>s.createdAt||0)):0;
  if(left&&Date.now()-last>4*864e5)inboxAdd('prac-'+isoWeek()+'-'+Math.floor(Date.now()/(4*864e5)),'Time for some practice',`${left} session${left===1?'':'s'} left in this week's plan.`,'plan')}}catch(_){}
 if(HOSTED_IN_CLAUDE||!SB.on()||!navigator.onLine)return;const ck=uKey('nwchk');if(Date.now()-lsGet(ck,0)<12e5)return;lsSet(ck,Date.now());
 const c=lbClub();if(c){try{const k=keyBase(c.key),seen=lsGet(uKey('lbseen'),null),rows=await sbGet('course_cards',`course_key=eq.${encodeURIComponent(`lb~${k}~${lbMonth(0)}`)}&select=card,created_at&order=created_at.desc&limit=50`)||[];
  const others=rows.filter(r=>r.card&&r.card.u!==meU()&&(!seen||r.created_at>seen));if(rows[0])lsSet(uKey('lbseen'),rows[0].created_at);
  if(seen&&others.length){const names=[...new Set(others.map(r=>r.card.name||r.card.u))].slice(0,3).join(', ');inboxAdd('lb-'+rows[0].created_at,`${others.length} new round${others.length===1?'':'s'} on the ${c.name} leaderboard`,`From ${names}.`,'club')}
  const comps=await compRows(k),cseen=lsGet(uKey('compseen'),null);const fresh=comps.filter(x=>x.by!==meU()&&(!cseen||x.at>cseen));if(comps[0])lsSet(uKey('compseen'),comps[0].at);
  if(cseen)fresh.forEach(x=>inboxAdd('comp-'+x.id,`New competition: ${x.name}`,`${COMP_F[x.format]||''}, ${fmtRoundDate(x.start)} to ${fmtRoundDate(x.end)}. Post a round to enter.`,'club'))}catch(_){}}}
// phone notifications for jobs that finish while Caddy Coach is in the background
const NOTIFY={on:()=>!!lsGet('cc_notify',0)&&'Notification'in window&&Notification.permission==='granted'};
async function ccNotify(title,body){if(!NOTIFY.on()||!document.hidden)return;
 try{const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(reg&&reg.showNotification){await reg.showNotification(title,{body,icon:'icon-192.png',badge:'icon-192.png',tag:'cc-job'});return}}catch(_){}
 try{new Notification(title,{body})}catch(_){}}
async function notifyToggle(on){if(!on){lsSet('cc_notify',0);return 'off'}if(!('Notification'in window))return 'unsupported';
 let p=Notification.permission;if(p==='default')try{p=await Notification.requestPermission()}catch(_){}lsSet('cc_notify',p==='granted'?1:0);return p}

// ---- group rounds: friends score on their own phones and see each other's cards live ----
const GRP={rows:null,t:0,timer:0,err:''};
const grpOn=()=>!HOSTED_IN_CLAUDE&&SB.on()&&!!meU();
const grpNew=()=>Array.from(crypto.getRandomValues(new Uint8Array(5)),b=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b%31]).join('');
function grpSetupHTML(){if(!grpOn())return '';const g=RT.grp;
 return `<div class="grpBox"><b>Playing with friends on their own phones?</b>${g?`<p>Group code <span class="grpCode">${esc(g)}</span>. Friends enter it on their phone before they start, and you'll all see each other's scores as you play.</p><button type="button" class="rtLink" data-grp-leave>Leave the group</button>`
  :`<p class="mut">Start a group and share the code, or join a friend's group.</p><div class="grpRow"><button type="button" data-grp-make>Start a group</button><form class="grpJoin" data-grp-join novalidate><input id="grpIn" maxlength="5" placeholder="Code" aria-label="Group code" autocapitalize="characters" autocomplete="off"><button type="submit">Join</button></form></div>${GRP.err?`<p class="rtMsg bad" role="alert">${esc(GRP.err)}</p>`:''}`}</div>`}
function grpMine(r){const t=tally(r.holes),nt=rtNet(r);return{v:1,u:meU(),name:lbName(),course:String(r.course.name||'').slice(0,80),thru:t.thru,toPar:t.toPar,total:t.total,pts:nt?nt.pts:null,sc:r.holes.map(h=>h.score??null),t:Date.now()}}
let _grpPushT=0;
function grpPush(r,now){if(!r||!r.grp||!grpOn())return;clearTimeout(_grpPushT);_grpPushT=setTimeout(()=>{sbSend('course_cards',[{course_key:'grp~'+r.grp,name:'Group',card:grpMine(r),device:SB.device()}])},now?0:3000)}
async function grpPoll(){const r=RT.live||RT.doneRound;if(!r||!r.grp||!grpOn())return;
 try{const rows=await sbGet('course_cards',`course_key=eq.${encodeURIComponent('grp~'+r.grp)}&select=card,created_at&order=created_at.desc&limit=300`)||[];
  const by=new Map();rows.forEach(x=>{const c=x.card;if(c&&c.u&&!by.has(c.u))by.set(c.u,c)});GRP.rows=[...by.values()];GRP.t=Date.now();GRP.err=''}catch(_){GRP.err='Can\'t reach the group just now.'}
 if(RT.view==='play'||RT.view==='done'){const s=$('grpLive');if(s)s.outerHTML=grpLiveHTML(r)}}
function grpLoop(){clearInterval(GRP.timer);GRP.timer=setInterval(()=>{if(document.hidden)return;const r=RT.live;if(r&&r.grp&&RT.view==='play')grpPoll();else if(!(RT.view==='done'&&RT.doneRound&&RT.doneRound.grp))clearInterval(GRP.timer)},15000)}
function grpLiveHTML(r){if(!r||!r.grp)return '';const me=meU(),L=(GRP.rows||[]).filter(x=>x.u!==me),mine=grpMine(r),all=[mine].concat(L);
 const pts=all.every(x=>x.pts!=null);all.sort((a,b)=>pts?(b.pts??-1)-(a.pts??-1):(a.thru&&b.thru?a.toPar-b.toPar:b.thru-a.thru));
 return `<div class="card" id="grpLive"><div class="rtTop"><h2 style="margin:0">Group ${esc(r.grp)}</h2><small class="mut">${GRP.t?'Updated '+new Date(GRP.t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'Waiting for friends…'}</small></div>
  ${L.length?'':'<p class="mut" style="margin:6px 0">Nobody else has scored yet. Friends join with this code before they start their round.</p>'}
  <ol class="lbList">${all.map((x,i)=>`<li${x.u===me?' class="me"':''}><span class="lbN">${i+1}</span><span class="lbW"><b>${esc(x.u===me?'You':x.name||x.u)}</b><small>${x.thru?`thru ${x.thru} · ${x.total} strokes`:'Not started'}</small></span><span class="lbV">${x.thru?tiles(toParShort(x.toPar),'sm'+(x.toPar<0?' red':'')):'–'}${x.pts!=null&&x.thru?`<small> ${x.pts} pts</small>`:''}</span></li>`).join('')}</ol>
  ${GRP.err?`<p class="rtMsg bad" role="alert">${esc(GRP.err)}</p>`:''}</div>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-grp-make],[data-grp-leave]');if(!b)return;
 if(b.dataset.grpMake!=null){RT.grp=grpNew();GRP.err='';navigator.clipboard&&navigator.clipboard.writeText(RT.grp).catch(()=>{});toast('Group code '+RT.grp+' copied. Send it to your friends.')}else{RT.grp=null}rtRender()});
document.addEventListener('submit',e=>{if(!e.target.matches('[data-grp-join]'))return;e.preventDefault();const v=String($('grpIn').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(!/^[A-Z0-9]{5}$/.test(v)){GRP.err='Group codes are 5 letters and numbers, like K7QPM.';return rtRender()}RT.grp=v;GRP.err='';if(typeof track==='function')track('group');toast('Joined group '+v+'.');rtRender()});

// ---- club competitions: anyone at the club can set one up; posted rounds in the dates count ----
const COMP_F={stableford:'Stableford',net:'Medal (net)'};
const COMP={add:false,err:'',data:null,busy:false,open:null};
async function compRows(k){const rows=await sbGet('course_cards',`course_key=eq.${encodeURIComponent('comp~'+k)}&select=card,created_at&order=created_at.desc&limit=100`)||[];
 const seen=new Set();return rows.map(x=>Object.assign({},x.card,{at:x.created_at})).filter(c=>c&&c.id&&c.name&&c.start&&c.end&&COMP_F[c.format]&&!seen.has(c.id)&&seen.add(c.id))}
const monthsBetween=(a,b)=>{const o=[];let d=new Date(a.slice(0,7)+'-15');const e=b.slice(0,7);while(d.toISOString().slice(0,7)<=e&&o.length<4){o.push(d.toISOString().slice(0,7));d.setMonth(d.getMonth()+1)}return o};
async function compTable(k,c){const ms=monthsBetween(c.start,c.end),rows=[];for(const m of ms){const r=await sbGet('course_cards',`course_key=eq.${encodeURIComponent(`lb~${k}~${m}`)}&select=card,created_at&order=created_at.desc&limit=500`)||[];rows.push(...r)}
 const best=new Map(),net=c.format==='net';for(const x of rows){const v=x.card;if(!v||!v.u||!v.date||v.date<c.start||v.date>c.end)continue;if(net&&v.net==null)continue;if(!net&&!(v.pts>=0))continue;
  const o=best.get(v.u);if(!o||(net?v.net<o.net:v.pts>o.pts))best.set(v.u,v)}
 return [...best.values()].sort((a,b)=>net?a.net-b.net:b.pts-a.pts)}
async function compLoad(){const c=lbClub();if(!c||!lbOn())return;const k=keyBase(c.key);COMP.busy=true;
 try{const list=await compRows(k),today=hcpToday();COMP.data={list:list.filter(x=>x.end>=lbMonth(2)+'-01').sort((a,b)=>(a.end<today)-(b.end<today)||(a.start<b.start?-1:1))};
  for(const x of COMP.data.list.slice(0,4))x.table=await compTable(k,x).catch(()=>null)}catch(_){COMP.err='Competitions couldn\'t be reached just now.'}
 COMP.busy=false;if(RT.tab==='club')rtRender()}
function compHTML(){const c=lbClub();if(HOSTED_IN_CLAUDE||!SB.on()||!c||!lbOn())return '';if(!COMP.data&&!COMP.busy&&!COMP.err)compLoad();
 const today=hcpToday(),me=meU(),L=COMP.data&&COMP.data.list||[];
 return `<div class="card"><div class="rtTop"><h2 style="margin:0">Competitions</h2>${COMP.add?'':'<button type="button" class="link" data-comp-new>Set one up</button>'}</div>
  ${COMP.add?compFormHTML():''}
  ${COMP.busy?'<div class="rtLoad" role="status"><span class="spin" aria-hidden="true"></span>Loading competitions…</div>':''}
  ${!COMP.busy&&!L.length&&!COMP.add?`<p class="mut" style="margin:6px 0 0">No competitions at ${esc(c.name)} right now. Set one up for your roll-up or society: rounds posted to the club leaderboard between the dates count.</p>`:''}
  ${L.map(x=>{const st=x.start>today?'Starts '+fmtRoundDate(x.start):x.end<today?'Finished':'On now, until '+fmtRoundDate(x.end),T=x.table||[],net=x.format==='net';
   return `<div class="cpItem"><div class="cpHead"><b>${esc(x.name)}${CLUB.admins.some(a=>a.username===x.by)?' <span class="offTag">Official</span>':''}</b><small class="mut">${COMP_F[x.format]} · ${fmtRoundDate(x.start)} to ${fmtRoundDate(x.end)} · ${st}</small></div>
    ${T.length?`<ol class="lbList">${T.slice(0,10).map((v,i)=>`<li${v.u===me?' class="me"':''}><span class="lbN">${i+1}</span><span class="lbW"><b>${esc(v.name||v.u)}</b><small>${fmtRoundDate(v.date)} · ${v.gross} gross</small></span><span class="lbV">${tiles(net?v.net:v.pts,'sm')}<small>${net?' net':' pts'}</small></span></li>`).join('')}</ol>`:`<p class="mut" style="margin:6px 0 0">${x.start>today?'Entries open on the start date.':'No entries yet. Finish an 18-hole round here with your handicap set and post it to the leaderboard to enter.'}</p>`}</div>`}).join('')}
  ${COMP.err?`<p class="rtMsg bad" role="alert">${esc(COMP.err)}</p>`:''}</div>`}
function compFormHTML(){const t=hcpToday();return `<form class="goForm" data-comp-form novalidate><div class="pfF"><label for="cpName">Name</label><input id="cpName" maxlength="40" placeholder="Saturday roll-up" autocomplete="off"></div>
 <div class="pfF"><label for="cpFmt">Format</label><select id="cpFmt">${Object.entries(COMP_F).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
 <div class="hcIn"><label>Starts<input id="cpStart" type="date" value="${t}" min="${t}"></label><label>Ends<input id="cpEnd" type="date" value="${t}" min="${t}"></label></div>
 ${COMP.err?`<p class="rtMsg bad" role="alert">${esc(COMP.err)}</p>`:''}<div class="rtTwo"><button type="button" data-comp-cancel>Cancel</button><button type="submit" class="pri">Set it up</button></div></form>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-comp-new],[data-comp-cancel]');if(!b)return;COMP.add=b.dataset.compNew!=null;COMP.err='';rtRender();if(COMP.add)setTimeout(()=>{const i=$('cpName');if(i)i.focus()},30)});
document.addEventListener('submit',async e=>{if(!e.target.matches('[data-comp-form]'))return;e.preventDefault();const n=String($('cpName').value||'').trim(),f=$('cpFmt').value,s=$('cpStart').value,en=$('cpEnd').value;
 COMP.err=n.length<3?'Give the competition a name.':!s||!en?'Choose the start and end dates.':en<s?'The end date is before the start date.':(Date.parse(en)-Date.parse(s))/864e5>92?'Competitions can run for up to 3 months.':'';if(COMP.err)return rtRender();
 const c=lbClub(),k=keyBase(c.key);try{if(!await sbPost('course_cards',[{course_key:('comp~'+k).slice(0,120),name:'Competition',card:{v:1,id:Math.random().toString(36).slice(2,10),by:meU(),name:n,format:f,start:s,end:en},device:SB.device()}]))throw new Error('not saved');
  COMP.add=false;COMP.data=null;toast('Competition set up. Rounds posted between the dates will count.');compLoad();rtRender()}catch(err){COMP.err='It couldn\'t be saved. Check your signal and try again.';rtRender()}});

// ---- export: a scorecard to paste anywhere, and every round as a spreadsheet ----
function roundText(r){const tl=tally(r.holes),nt=rtNet(r),st=rtStats(r.holes),L=[];
 L.push(`${r.course.name} · ${r.tee.name} tees · ${fmtRoundDate(r.date)}`);
 L.push(`Score ${tl.total} (${toParShort(tl.toPar)})${nt?` · Net ${nt.net} · ${nt.pts} Stableford points · course handicap ${chTxt(r.ch)}`:''}`);
 L.push('Hole  '+r.holes.map(h=>String(h.n).padStart(3)).join(''));L.push('Par   '+r.holes.map(h=>String(h.par).padStart(3)).join(''));L.push('Score '+r.holes.map(h=>String(h.score??'-').padStart(3)).join(''));
 if(st.pN)L.push(`Putts ${st.putts}${st.fwN?` · Fairways ${st.fw}/${st.fwN}`:''} · Greens ${st.gir}/${st.girN}`);
 (r.others||[]).forEach(p=>{const g=p.sc.reduce((a,v)=>a+(v||0),0);L.push(`${p.name}: ${g}`)});
 return L.join('\n')}
function roundsCSV(rs){const head=['Date','Course','Tees','Holes','Par','Score','To par','Course handicap','Net','Stableford','Putts','Fairways hit','Fairways','Greens in regulation'].concat(Array.from({length:18},(_,i)=>'H'+(i+1)));
 const q=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const rows=rs.map(r=>{const t=tally(r.holes),n=rtNet(r),s=rtStats(r.holes);return[r.date,r.course.name,r.tee.name,r.holes.length,t.fullPar,t.total,t.toPar,r.ch??'',n?n.net:'',n?n.pts:'',s.pN?s.putts:'',s.fwN?s.fw:'',s.fwN||'',s.girN?s.gir:''].concat(Array.from({length:18},(_,i)=>r.holes[i]?r.holes[i].score??'':''))});
 return [head].concat(rows).map(r=>r.map(q).join(',')).join('\n')}
// hand the viewer a file: inside Claude through its download prompt, otherwise a normal download
async function saveFile(name,blob){
 if(HOSTED_IN_CLAUDE&&window.claude&&claude.use){try{const dl=await claude.use('downloads');if(dl){await dl.save({filename:name,data:blob});return 'saved'}}catch(e){if(e&&e.code==='declined')return 'declined';console.warn(e)}}
 const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},4000);return 'saved'}
window.ccSaveFile=saveFile;

// ---- rounds: shots received, net score and Stableford points ----
// your course handicap for the holes you're playing, from your Handicap Index and the tee's rating and slope
function rtCourseHcp(hs,t){const rec=typeof HcpStore!=='undefined'&&HcpStore.rec;if(!rec||!rec.start||!t||!(+t.rating>0)||!(+t.slope>0))return null;
 const hi=WHS.calc(rec).hi;if(hi==null)return null;const par=hs.reduce((a,h)=>a+h.par,0);
 return{hi,ch:hs.length>=18?WHS.courseHcp(hi,+t.rating,+t.slope,par):WHS.courseHcp9(hi,WHS.rating9(+t.rating),+t.slope,par),cr:+t.rating,sl:+t.slope}}
function rtShots(r){if(!r||r.ch==null)return null;const {r:rk}=WHS.ranks(r.holes);return r.holes.map((h,i)=>WHS.strokesOn(r.ch,rk[i],r.holes.length))}
const rtPts=(h,st)=>h.score==null?null:Math.max(0,2+h.par+st-h.score);
function rtNet(r){const sh=rtShots(r);if(!sh)return null;let pts=0,net=0,np=0,thru=0;r.holes.forEach((h,i)=>{if(h.score==null)return;thru++;pts+=rtPts(h,sh[i]);net+=h.score-sh[i];np+=h.par});return{pts,net,netToPar:net-np,thru,sh,ch:r.ch}}
const shotsTxt=n=>n===0?'No shots':n>0?`${n} shot${n===1?'':'s'}`:`Give back ${-n}`;
const chTxt=ch=>ch<0?'+'+(-ch):String(ch);
// ---- round stats: fairways, greens in regulation, putts ----
const FP=[['a','Under 3 ft'],['b','3–6 ft'],['c','6–10 ft'],['d','10–20 ft'],['e','20–40 ft'],['f','40 ft+']];
function rtStats(holes){let fw=0,fwN=0,fl=0,fr=0,gir=0,girN=0,putts=0,pN=0,ud=0,udN=0,sand=0,sandN=0,three=0,one=0;const fp={};
 for(const h of holes){if(h.score==null)continue;
  if(h.par>=4&&h.fw){fwN++;if(h.fw==='hit')fw++;else if(h.fw==='left')fl++;else if(h.fw==='right')fr++}
  if(h.putts!=null){pN++;putts+=h.putts;girN++;const g=h.score-h.putts<=h.par-2;if(g)gir++;else{udN++;if(h.score<=h.par)ud++}if(h.putts>=3)three++;if(h.putts===1)one++;
   if(h.fp){const b=fp[h.fp]=fp[h.fp]||{n:0,made:0,putts:0};b.n++;b.putts+=h.putts;if(h.putts<=1)b.made++}}
  if(h.sand){sandN++;if(h.score<=h.par)sand++}}
 return{fw,fwN,fl,fr,gir,girN,putts,pN,ud,udN,sand,sandN,three,one,fp}}
function rtStatsHTML(holes){const s=rtStats(holes);if(!s.fwN&&!s.pN)return '';const pc=(a,b)=>b?Math.round(a/b*100)+'%':'–';
 return `${s.pN?`<div class="rtStats rtStats3"><div><b>${s.udN?`${s.ud}/${s.udN}`:'–'}</b><span>Up and downs</span></div><div><b>${s.sandN?`${s.sand}/${s.sandN}`:'–'}</b><span>Sand saves</span></div><div><b>${s.three}</b><span>Three-putts</span></div></div>`:''}<div class="rtStats rtStats3"><div><b>${s.fwN?`${s.fw}/${s.fwN}`:'–'}</b><span>Fairways${s.fwN&&(s.fl||s.fr)?` · missed ${s.fl} left, ${s.fr} right`:''}</span></div><div><b>${s.girN?`${s.gir}/${s.girN}`:'–'}</b><span>Greens in regulation</span></div><div><b>${s.pN?s.putts:'–'}</b><span>Putts${s.pN?` · ${(s.putts/s.pN).toFixed(1)} a hole`:''}</span></div></div>`}
// across your rounds: how you score and where the shots go
function rtTrendsHTML(rs){const full=rs.filter(r=>r.holes.length===18&&tally(r.holes).thru===18).slice().sort((a,b)=>(a.finishedAt||a.createdAt||0)-(b.finishedAt||b.createdAt||0)).slice(-12);
 const shortD=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}catch(_){return d}};
 const sc=full.map(r=>{const t=tally(r.holes);return{y:t.total,lab:shortD(r.date),tip:`${t.total} (${toParShort(t.toPar)}) at ${r.course.name}`}});
 const withPts=full.filter(r=>r.ch!=null).map(r=>{const n=rtNet(r);return{y:n.pts,lab:shortD(r.date),tip:`${n.pts} points at ${r.course.name}`}});
 const recent=rs.slice(0,10),agg=recent.map(r=>rtStats(r.holes)).reduce((a,s)=>{for(const k in s)a[k]=(a[k]||0)+s[k];return a},{});
 const statN=recent.filter(r=>{const s=rtStats(r.holes);return s.fwN||s.pN}).length;
 let h='';
 if(sc.length>=2)h+=`<div class="card"><h2>Your scoring</h2><p class="mut" style="margin:0 0 6px">Strokes in your last ${sc.length} full 18-hole rounds. Tap a point for the round.</p>${trendChart(sc,{title:'Strokes per 18-hole round',invert:true})}<p class="tcNote">Lower is better, so the line rises as you improve.</p></div>`;
 if(withPts.length>=2)h+=`<div class="card"><h2>Stableford points</h2><p class="mut" style="margin:0 0 6px">Points with your handicap in your last ${withPts.length} rounds where it was set. 36 means you played to your handicap.</p>${trendChart(withPts,{title:'Stableford points per round'})}</div>`;
 if(statN){const pc=(a,b)=>b?Math.round(a/b*100):null,fwp=pc(agg.fw,agg.fwN),gp=pc(agg.gir,agg.girN),miss=agg.fl+agg.fr;
  const tip=fwp!=null&&miss>=3&&Math.max(agg.fl,agg.fr)/miss>=0.65?`Most of your missed fairways go ${agg.fl>agg.fr?'left':'right'} (${Math.max(agg.fl,agg.fr)} of ${miss}). The Practice tab's Guide explains what sends the ball that way.`:'';
  h+=`<div class="card"><h2>Where your shots go</h2><p class="mut" style="margin:0 0 10px">From the last ${statN} round${statN===1?'':'s'} where you logged fairways or putts.</p>
   <div class="rtStats rtStats3"><div><b>${fwp==null?'–':fwp+'%'}</b><span>Fairways hit</span></div><div><b>${gp==null?'–':gp+'%'}</b><span>Greens in regulation</span></div><div><b>${agg.pN?(agg.putts/agg.pN*18).toFixed(1):'–'}</b><span>Putts per 18 holes</span></div></div>
   ${agg.fwN?`<div class="fwBar" role="img" aria-label="Tee shots: ${agg.fl} left, ${agg.fw} fairway, ${agg.fr} right"><i class="l" style="flex:${agg.fl||0.0001}"></i><i class="m" style="flex:${agg.fw||0.0001}"></i><i class="r" style="flex:${agg.fr||0.0001}"></i></div><div class="fwKey"><span>Left ${agg.fl}</span><span>Fairway ${agg.fw}</span><span>Right ${agg.fr}</span></div>`:''}
   ${tip?`<p class="hcNote" style="margin-top:12px">${esc(tip)}</p>`:''}</div>`}
 else h+=`<div class="card"><h2>Where your shots go</h2><p class="mut" style="margin:0">Log your tee shot and putts on each hole while you play (both optional) and your fairways, greens and putts appear here.</p></div>`;
 return h}

// ---- handicap: the World Handicap System, worked out the way England Golf does ----
const hcpToday=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const hcpEmpty=()=>({v:1,start:null,scores:[],removed:[]});
function hcpClean(r){if(!r||typeof r!=='object')return null;const st=r.start&&r.start.date?{hi:r.start.hi==null?null:+r.start.hi,date:String(r.start.date).slice(0,10),at:+r.start.at||0}:null;
 return{v:1,start:st,scores:(Array.isArray(r.scores)?r.scores:[]).filter(s=>s&&s.id&&s.d&&(s.n===9||s.n===18)&&+s.sl>0&&+s.cr>0&&+s.a>0),removed:Array.isArray(r.removed)?r.removed.slice():[],updatedAt:+r.updatedAt||0}}
// two copies of the record (this phone, the cloud) become one: the first starting index ever set wins, scores are combined
function hcpMerge(a,b){a=hcpClean(a);b=hcpClean(b);if(!a)return b;if(!b)return a;
 const st=[a.start,b.start].filter(Boolean).sort((x,y)=>(x.at||0)-(y.at||0))[0]||null;const m=new Map();
 a.scores.concat(b.scores).forEach(s=>{if(!m.has(s.id))m.set(s.id,s)});
 return{v:1,start:st,scores:[...m.values()],removed:[...new Set(a.removed.concat(b.removed))],updatedAt:Math.max(a.updatedAt,b.updatedAt)}}
// the copy kept in the cloud: the latest 80 scores fit comfortably
function hcpSnap(r){const rm=new Set(r.removed);let sc=r.scores.filter(s=>!rm.has(s.id)).sort((x,y)=>x.d<y.d?-1:x.d>y.d?1:(x.t||0)-(y.t||0)).slice(-80);
 let o={v:1,start:r.start,scores:sc,removed:r.removed.slice(-40),updatedAt:r.updatedAt||Date.now()};while(JSON.stringify(o).length>18000&&o.scores.length>20)o.scores=o.scores.slice(5);return o}
const hcpSig=r=>r?JSON.stringify([r.start,r.scores.map(s=>s.id).sort(),r.removed.slice().sort()]):'';
const HcpCloud={
 on(){return SB.on()&&!!Store.user},
 key(){return 'hcp~'+Store.user},
 async pull(){const rows=await sbGet('course_cards',`course_key=eq.${encodeURIComponent(this.key())}&select=card,created_at&order=created_at.desc&limit=8`);
  return(rows||[]).map(x=>x.card).filter(c=>c&&c.v===1).reduce((a,c)=>hcpMerge(a,c),null)},
 push(r){if(!this.on())return;clearTimeout(this.t);this.t=setTimeout(()=>sbSend('course_cards',[{course_key:this.key(),name:'My handicap',card:hcpSnap(r),device:SB.device()}]),400)}};
const HcpStore={rec:null,
 local(){if(Store.mode==='db')return null;return Store.mode==='local'?Store.lget('cc_hcp',null):Store.mem.hcp||null},
 async keep(r){if(Store.mode==='db'){try{await Store.col().doc('hcp').set(Object.assign({kind:'hcp'},r))}catch(e){console.error(e)}return}
  if(Store.mode==='local'){try{Store.lset('cc_hcp',r);return}catch(_){Store.mode='memory'}}Store.mem.hcp=r},
 async load(){await Store.init();let r=null;
  if(Store.mode==='db'){try{const d=await Store.col().doc('hcp').get();r=d.exists?d.data():null}catch(_){}}else r=this.local();
  r=hcpClean(r)||hcpEmpty();this.rec=r;
  if(HcpCloud.on()){const take=c=>{if(c===undefined)return;const m=hcpMerge(this.rec,c)||hcpEmpty();
    if(hcpSig(m)!==hcpSig(this.rec)){this.rec=m;this.keep(m)}if((m.start||m.scores.length)&&(!c||hcpSig(m)!==hcpSig(hcpClean(c))))HcpCloud.push(m)};
   const pull=HcpCloud.pull().catch(()=>undefined),c=await Promise.race([pull,sleep(2500).then(()=>'late')]);
   if(c==='late')pull.then(c2=>{take(c2);hcpRefresh()});else take(c)}
  return this.rec},
 async save(){const r=this.rec;r.updatedAt=Date.now();await this.keep(r);HcpCloud.push(r);try{renderHomeHcp()}catch(_){}try{lbHcpPush()}catch(_){}}};
function hcpRefresh(){try{renderHomeHcp()}catch(_){}if(!$('prof').hidden&&/^(me|hcp)/.test(PROF.mode||''))profRender();if(typeof RT!=='undefined'&&(RT.view==='done'||RT.detail)&&!$('p8').hidden)rtRender()}
async function hcpSetStart(hi){const r=HcpStore.rec;if(!r||r.start)return false;r.start={hi,date:hcpToday(),at:Date.now()};await HcpStore.save();return true}
async function hcpAdd(s){const r=HcpStore.rec;if(!r)return;r.scores=r.scores.filter(x=>x.id!==s.id);r.removed=r.removed.filter(x=>x!==s.id);r.scores.push(s);await HcpStore.save()}
async function hcpRemove(id){const r=HcpStore.rec;if(!r)return;if(!r.removed.includes(id))r.removed.push(id);await HcpStore.save()}
function hcpSub(c){if(c.hi==null)return c.pending9&&!c.needed?'Your 9-hole score is waiting for a second nine':`Submit ${c.needed} more score${c.needed===1?'':'s'} to get your first index`;
 if(c.prev!=null&&Math.abs(c.prev-c.hi)>.01)return `${c.hi<c.prev?'Down':'Up'} ${Math.abs(c.hi-c.prev).toFixed(1)} after your last score`;
 if(!c.total)return 'Your starting index. Submit scores to update it';if(c.prev==null)return `Your first index, from ${c.real} score${c.real===1?'':'s'}`;return 'No change after your last score'}
function hcpMeHTML(){const r=HcpStore.rec;
 if(!r)return `<div class="hcBox"><p class="mut" role="status" style="margin:0">Loading your handicap…</p></div>`;
 if(!r.start)return `<div class="hcBox hcSet"><b>Handicap</b><p class="pfHint">Set your starting handicap from your England Golf Handicap Index. It's locked once it's set, then it moves only with the scores you submit, worked out with World Handicap System rules.</p><button type="button" class="pri pfBig" data-pf="hcp-start">Set your starting handicap</button></div>`;
 const c=WHS.calc(r);
 return `<button type="button" class="hcBox hcTap" data-pf="hcp" aria-label="Handicap estimate ${c.hi==null?'not set yet':WHS.fmt(c.hi)}. Open your handicap record"><span class="hcNum">${c.hi==null?'–':WHS.fmt(c.hi)}</span><span class="hcTxt"><b>Handicap (WHS estimate)</b><small>${esc(hcpSub(c))}</small></span><span class="hcGo" aria-hidden="true">Record</span></button>`}
const hcpDate=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}catch(_){return d}};
function hcpRowHTML(e,row,counts){const s=e.s,n=s.n===9?'9 holes':'18 holes',del=PROF.hcDel===s.id;
 const val=e.d+e.adj,adj=e.adj?` <small class="hcEsr">${e.d.toFixed(1)} less ${(-e.adj).toFixed(0)} for an exceptional score</small>`:'';
 return `<li class="hcRow${counts?' on':''}"><div class="hcL"><b>${esc(s.c||'Course')}</b><small>${hcpDate(s.d)} · ${n} · ${s.a}${s.g&&s.g!==s.a?` (${s.g} gross)`:''} · rating ${(+s.cr).toFixed(1)}, slope ${s.sl}</small>${row&&row.d9!=null?`<small>9-hole differential ${row.d9.toFixed(1)}${row.exp!=null?` + ${row.exp.toFixed(1)} expected for the other nine`:row.pair?' + your other nine':''}</small>`:''}${adj}
  <button type="button" class="link hcDel" data-pf="hcp-del" data-id="${esc(s.id)}">${del?'Tap again to remove this score':'Remove'}</button></div>
  <div class="hcR"><b>${val.toFixed(1)}</b>${counts?'<span class="hcCount">Counts</span>':''}</div></li>`}
function hcpRecordHTML(){const r=HcpStore.rec;if(!r||!r.start)return '';const c=WHS.calc(r),byId=new Map(c.rows.map(x=>[x.s.id,x]));
 const latest=c.rows.find(x=>!x.waiting),notes=[];
 if(latest&&latest.esr)notes.push(`Your last score was ${latest.esr===2?'10 or more':'7 or more'} below your index, so ${latest.esr} is taken off each of your last 20 differentials (Exceptional Score Reduction).`);
 if(latest&&latest.hard)notes.push(`Your index can't rise more than 5.0 above your low index of ${WHS.fmt(latest.low)}, so it's held at ${WHS.fmt(latest.hi)} (hard cap).`);
 else if(latest&&latest.soft)notes.push(`Your index rose more than 3.0 above your low index of ${WHS.fmt(latest.low)}, so only half of the rise above 3.0 counts (soft cap).`);
 const seeds=c.last.filter(e=>e.seed),realLast=c.last.filter(e=>!e.seed),cnt=c.counting;
 const seedCount=seeds.filter(e=>cnt.has(e)).length;
 const lastIds=new Set(realLast.map(e=>e.s.id));const older=c.rows.filter(x=>x.e&&!lastIds.has(x.s.id));const waiting=c.rows.filter(x=>x.waiting&&!x.paired);
 const st=r.start;
 return `<div class="pfCard hcRec"><button type="button" class="link pfBack" data-pf="to-me">Back</button><h2>Your handicap</h2>
  <div class="hcHero"><span class="hcNum">${c.hi==null?'–':WHS.fmt(c.hi)}</span><div><b>Handicap (WHS estimate)</b><small>${esc(hcpSub(c))}</small></div></div>
  <p class="pfHint hcOfficial">Worked out with World Handicap System rules from the scores you enter in Caddy Coach. It's an estimate, not your official England Golf Handicap Index®, which only your club or England Golf can set.</p>
  ${PROF.note?`<p class="hcNote" role="status">${esc(PROF.note)}</p>`:''}
  <dl class="hcFacts"><div><dt>Low index</dt><dd>${c.low==null?'–':WHS.fmt(c.low)}</dd></div><div><dt>Scores</dt><dd>${c.total}</dd></div><div><dt>Started at</dt><dd>${st.hi==null?'None':WHS.fmt(st.hi)}</dd></div></dl>
  ${c.hist.length>=2?`<div class="hcTrend"><b>Your index over time</b>${trendChart(hcpChartPts(c,r,20),{title:'Your handicap estimate over time',fmt:v=>WHS.fmt(+v.toFixed(1)),invert:true,h:120})}<p class="tcNote">Lower is better, so the line rises as your handicap comes down.</p></div>`:''}
  <p class="pfHint hcLock">Starting index ${st.hi==null?'not held (worked out from your first 3 scores)':WHS.fmt(st.hi)}, set ${hcpDate(st.date)}. It's locked and can't be changed.</p>
  ${notes.map(t=>`<p class="hcNote">${esc(t)}</p>`).join('')}
  <button type="button" class="pri pfBig" data-pf="hcp-add">Add a score</button>
  <p class="pfHint">Rounds you finish in Rounds can be submitted from that round's screen, with each hole capped for you.</p>
  <h3 class="hcH">Scoring record</h3>
  <p class="pfHint">${c.use?`Your index is the average of the lowest ${c.use} of your last ${c.last.length} score differentials${c.adj?`, then ${c.adj}.0`:''}.`:'Your index starts once you have 3 score differentials (54 holes).'}${seeds.length?` Until 20 real scores replace them, your starting index fills the rest of the 20.`:''}</p>
  <ol class="hcList">${c.last.filter(e=>!e.seed).map(e=>hcpRowHTML(e,byId.get(e.s.id),cnt.has(e))).join('')}
   ${seeds.length?`<li class="hcRow hcSeed${seedCount?' on':''}"><div class="hcL"><b>Starting index × ${seeds.length}</b><small>Stand-ins for your scoring record until real scores replace them</small></div><div class="hcR"><b>${(seeds[0].d+seeds[0].adj).toFixed(1)}</b>${seedCount?`<span class="hcCount">${seedCount} counting</span>`:''}</div></li>`:''}
   ${!c.last.length?'<li class="hcRow"><div class="hcL"><small>No scores yet.</small></div></li>':''}</ol>
  ${waiting.length?`<p class="hcH3">Waiting for a second nine</p><ol class="hcList">${waiting.map(x=>`<li class="hcRow"><div class="hcL"><b>${esc(x.s.c||'Course')}</b><small>${hcpDate(x.s.d)} · 9 holes · ${x.s.a} · differential ${x.d9.toFixed(1)}. Joins your next 9-hole score to make one 18-hole score.</small><button type="button" class="link hcDel" data-pf="hcp-del" data-id="${esc(x.s.id)}">${PROF.hcDel===x.s.id?'Tap again to remove this score':'Remove'}</button></div></li>`).join('')}</ol>`:''}
  ${older.length?`<details class="hcOld"><summary>Older scores (${older.length})</summary><ol class="hcList">${older.map(x=>hcpRowHTML(x.e,x,false)).join('')}</ol></details>`:''}
  <details class="hcHow"><summary>How your handicap is worked out</summary><div>
   <p><b>1. Each hole is capped.</b> A bad hole counts as no more than net double bogey: par, plus 2, plus any shots you get on that hole from your course handicap.${''} Before you have an index, the cap is par plus 5.</p>
   <p><b>2. The round becomes a score differential.</b> (113 ÷ slope) × (adjusted score − course rating). It says how well you played against how hard the course is. A 9-hole score gets an expected score for the other nine added, based on your index.</p>
   <p><b>3. Your index is the average of your best 8 of your last 20.</b> With fewer than 20 scores, fewer count (best 1 of 3, rising to best 8 of 20).</p>
   <p><b>4. Safeguards.</b> A score 7 or more below your index cuts your index by 1 (10 or more: by 2). Your index can rise only 3.0 above your lowest index of the past year before the rise is halved, and never more than 5.0. The most it can be is 54.0.</p>
   <p class="pfHint">England Golf also adjusts a day's scores for unusual weather or course set-up (the Playing Conditions Calculation), which needs everyone's scores from that day. Caddy Coach can't see those, so it treats every day as normal. Use your official England Golf record for competitions.</p></div></details></div>`}
function hcpStartHTML(){const f=PROF.f,none=f.hcNone===true;
 return `<form class="pfCard" data-pf-form="hcp-start" novalidate><button type="button" class="link pfBack" data-pf="to-me">Back</button><h2>Your starting handicap</h2>${pErr('_form')}
  <p class="mut" style="margin:0">Enter your current Handicap Index, as shown on the England Golf app. Once it's set you can't change it: from then on it updates only from the scores you submit.</p>
  <div class="pfSeg" role="radiogroup" aria-label="Do you have a handicap?"><button type="button" role="radio" data-pf-hcn="0" aria-checked="${!none}">I have a handicap</button><button type="button" role="radio" data-pf-hcn="1" aria-checked="${none}">I don't have one</button></div>
  ${none?'<p class="pfHint">Your first handicap estimate is worked out once you submit 3 scores (54 holes), the same way England Golf does for new golfers.</p>':pIn('hcHi','Handicap Index','inputmode="decimal" autocomplete="off" placeholder="For example 18.4" maxlength="5"',f.hcHi,'<p class="pfHint">From 54.0 down to plus 10.0. For a plus handicap, type + first, like +1.2.</p>')}
  ${PROF.hcArm?`<div class="hcConfirm" role="alert"><b>${none?'Start without a handicap?':`Set ${esc(WHS.fmt(PROF.hcArm.hi))} as your starting index?`}</b><p>You won't be able to change it later.</p></div>
   <div class="pfTwo hcTwo"><button type="button" class="pfBig" data-pf="hcp-unarm">Go back</button><button type="submit" class="pri pfBig">${none?'Yes, start without one':'Yes, lock it in'}</button></div>`
  :`<button type="submit" class="pri pfBig">${none?'Start without a handicap':'Set starting handicap'}</button>`}</form>`}
function hcpAddHTML(){const f=PROF.f,n=f.hcN==='9'?9:18;
 return `<form class="pfCard" data-pf-form="hcp-add" novalidate><button type="button" class="link pfBack" data-pf="hcp">Back</button><h2>Add a score</h2>${pErr('_form')}
  <p class="mut" style="margin:0">For a round you didn't keep in Caddy Coach. The course rating, slope and par are on the scorecard or the club's website.</p>
  <div class="pfF"><span class="pfLab" id="hcNLab">Holes</span><div class="pfSeg" role="radiogroup" aria-labelledby="hcNLab"><button type="button" role="radio" data-pf-hcholes="18" aria-checked="${n===18}">18 holes</button><button type="button" role="radio" data-pf-hcholes="9" aria-checked="${n===9}">9 holes</button></div></div>
  ${pIn('hcD','Date played','type="date" max="'+hcpToday()+'" required',f.hcD||hcpToday())}
  ${pIn('hcC','Course','autocomplete="off" maxlength="60" required',f.hcC)}
  ${pIn('hcA','Adjusted gross score','inputmode="numeric" autocomplete="off" required maxlength="3"',f.hcA,`<p class="pfHint">Your total with each hole capped at net double bogey (par + 2 + your shots on that hole).</p>`)}
  <div class="pfTwo hcThree">${pIn('hcCR','Course rating','inputmode="decimal" autocomplete="off" required maxlength="4"',f.hcCR)}${pIn('hcSl','Slope','inputmode="numeric" autocomplete="off" required maxlength="3"',f.hcSl)}${pIn('hcP','Par','inputmode="numeric" autocomplete="off" required maxlength="2"',f.hcP||(n===9?'36':'72'))}</div>
  <p class="pfHint">Use the 18-hole rating and slope for your tees. For 9 holes, Caddy Coach halves an 18-hole rating for you.</p>
  <button type="submit" class="pri pfBig">Add score</button></form>`}
// checks for a score typed in by hand
function hcpCheckNums(f,n,e){const cr=+String(f.hcCR||'').replace(',','.'),sl=+f.hcSl,par=+f.hcP;
 if(!(cr>=25&&cr<=85))e.hcCR='Enter the course rating, like 70.4.';else if(n===18&&cr<50)e.hcCR='That looks like a 9-hole rating. Use the 18-hole rating, like 70.4.';
 if(!(sl>=55&&sl<=155&&Number.isInteger(sl)))e.hcSl='Slope is a whole number from 55 to 155.';
 if(!(Number.isInteger(par)&&(n===18?par>=54&&par<=78:par>=27&&par<=39)))e.hcP=n===18?'Par for 18 holes is between 54 and 78.':'Par for 9 holes is between 27 and 39.';return{cr,sl,par}}
async function hcpSubmitForm(kind){const f=PROF.f;PROF.err={};
 if(kind==='hcp-start'){const none=f.hcNone===true;let hi=null;
  if(!none){hi=WHS.parse(f.hcHi);if(hi==null||isNaN(hi)||hi>54||hi<-10){PROF.err.hcHi='Enter your Handicap Index, from 54.0 down to +10.0, like 18.4.';PROF.hcArm=null;profRender();const el=$('hcHi');if(el)el.focus();return}}
  if(!PROF.hcArm){PROF.hcArm={hi};return profRender()}
  PROF.hcArm=null;if(!HcpStore.rec)await HcpStore.load();const ok=await hcpSetStart(none?null:hi);
  PROF.note=ok?(none?'Your handicap record has started. Submit 3 scores to get your first index.':`Your starting index of ${WHS.fmt(hi)} is set.`):'Your starting index was already set, so it hasn\'t changed.';return profShow('hcp')}
 const n=f.hcN==='9'?9:18,e={},d=String(f.hcD||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))e.hcD='Enter the date you played.';else if(d>hcpToday())e.hcD='The date can\'t be in the future.';
 if(!String(f.hcC||'').trim())e.hcC='Enter the course name.';
 const a=+f.hcA;if(!(Number.isInteger(a)&&(n===18?a>=54&&a<=200:a>=27&&a<=100)))e.hcA=n===18?'Enter your adjusted score for 18 holes, like 92.':'Enter your adjusted score for 9 holes, like 46.';
 const {cr,sl,par}=hcpCheckNums(f,n,e);
 if(Object.keys(e).length){PROF.err=e;profRender();const el=$(Object.keys(e)[0]);if(el)el.focus();return}
 const s={id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),d,t:Date.now(),n,cr:Math.round(cr*10)/10,sl,par,g:null,a,c:String(f.hcC).trim().slice(0,60),src:'manual'};
 await hcpAdd(s);PROF.note=hcpAfterNote(s.id);PROF.f={};profShow('hcp')}
function hcpAfterNote(id){const c=WHS.calc(HcpStore.rec),row=c.rows.find(x=>x.s.id===id);if(!row)return 'Score added.';
 if(row.waiting)return 'Score added. It counts once you add a second 9-hole score.';
 return `Score added: differential ${row.d.toFixed(1)}. Your handicap estimate is ${c.hi==null?`not set yet (${c.needed} more score${c.needed===1?'':'s'} needed)`:'now '+WHS.fmt(c.hi)}.`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-pf-hcn],[data-pf-hcholes]');if(!b)return;profCollect();
 if(b.dataset.pfHcn!=null){PROF.f.hcNone=b.dataset.pfHcn==='1';PROF.hcArm=null;PROF.err={}}else PROF.f.hcN=b.dataset.pfHcholes;profRender()});
// ---- submitting a finished round from Rounds ----
RT.hcTee={};
async function hcpTeeLookup(r){if(RT.hcTee[r.id]!==undefined)return;RT.hcTee[r.id]=null;let t=null;
 try{const c=(RT.course&&keyBase(RT.course.key)===keyBase(r.course.key))?RT.course:await RStore.getCourse(r.course.key);if(c&&c.tees)t=c.tees.find(x=>x.name===r.tee.name)||null}catch(_){}
 RT.hcTee[r.id]=t?{cr:t.rating||null,sl:t.slope||null}:{};if(t&&(t.rating||t.slope))rtRender()}
function hcpRoundPreview(r,cr,sl){const rec=HcpStore.rec,n=WHS.eligible(r.holes);if(!rec||!n)return null;
 const hi=WHS.calc(rec,{before:r.date,beforeT:r.finishedAt||r.createdAt}).hi,par=r.holes.reduce((a,h)=>a+h.par,0);
 const cr9=n===9?WHS.rating9(cr):cr,ch=hi==null?null:(n===18?WHS.courseHcp(hi,cr,sl,par):WHS.courseHcp9(hi,cr9,sl,par)),adj=WHS.adjust(r.holes,ch);
 return{n,hi,par,ch,adj,cr,sl}}
function hcpPreviewText(p){if(!p)return '';const a=p.adj,miss=r=>r.per.filter(x=>x.missing).length;
 return `${p.ch==null?'No index yet, so each hole is capped at par + 5.':`Your course handicap here: <b>${p.ch<0?'+'+(-p.ch):p.ch}</b>.`} Adjusted gross score: <b>${a.ags}</b>${a.capped?` (${a.capped} hole${a.capped===1?'':'s'} capped at net double bogey)`:''}${miss(a)?`, with ${miss(a)} unplayed hole${miss(a)===1?'':'s'} at net par`:''}.${a.siOk?'':' This card has no stroke indexes, so shots are given in hole order.'}`}
function hcpRoundHTML(r){const rec=HcpStore.rec;if(!rec)return '';
 const rm=new Set(rec.removed),done=rec.scores.find(s=>s.rid===r.id&&!rm.has(s.id));
 if(done){const c=WHS.calc(rec),row=c.rows.find(x=>x.s.id===done.id);
  return `<div class="card hcRound"><h2>Handicap</h2><p class="mut" style="margin:0 0 12px">Submitted. ${row&&row.waiting?'This 9-hole score counts once you add a second nine.':`Score differential <b>${row?row.d.toFixed(1):'–'}</b>. Your handicap estimate is <b>${c.hi==null?'not set yet':WHS.fmt(c.hi)}</b>.`}</p><button type="button" data-rt="hcp-open">See your handicap record</button></div>`}
 const n=WHS.eligible(r.holes);if(!n)return `<div class="card hcRound"><h2>Handicap</h2><p class="mut" style="margin:0">This round can't count for your handicap: a score needs at least 14 of 18 holes, or 7 of 9.</p></div>`;
 if(!rec.start)return `<div class="card hcRound"><h2>Handicap</h2><p class="mut" style="margin:0 0 12px">Set your starting handicap in your profile, then rounds like this one can count towards it.</p><button type="button" data-rt="hcp-open-start">Set your starting handicap</button></div>`;
 hcpTeeLookup(r);const t=RT.hcTee[r.id]||{},f=RT.hcF&&RT.hcF.id===r.id?RT.hcF:{id:r.id,cr:r.cr!=null?String(r.cr):t.cr!=null?String(t.cr):'',sl:r.sl!=null?String(r.sl):t.sl!=null?String(t.sl):''};RT.hcF=f;
 const cr=+String(f.cr).replace(',','.'),sl=+f.sl,okN=cr>=25&&cr<=85&&sl>=55&&sl<=155,p=okN?hcpRoundPreview(r,cr,sl):null;
 return `<div class="card hcRound"><h2>Submit for handicap</h2><p class="mut" style="margin:0 0 12px">Enter the ${n===9?'18-hole ':''}course rating and slope for the ${esc(r.tee.name)} tees. They're on the scorecard or the club's website.</p>
  <div class="hcIn"><label>Course rating<input id="hcRCR" inputmode="decimal" autocomplete="off" maxlength="4" value="${esc(f.cr)}" placeholder="70.4"></label><label>Slope<input id="hcRSl" inputmode="numeric" autocomplete="off" maxlength="3" value="${esc(f.sl)}" placeholder="125"></label></div>
  <p class="hcPrev" id="hcPrev" aria-live="polite">${p?hcpPreviewText(p):''}</p>${RT.hcErr?`<p class="rtMsg" role="alert">${esc(RT.hcErr)}</p>`:''}
  <button type="button" class="pri" data-rt="hcp-submit" style="width:100%;min-height:48px">Submit score for handicap</button></div>`}
document.addEventListener('input',e=>{if(e.target.id!=='hcRCR'&&e.target.id!=='hcRSl')return;const f=RT.hcF;if(!f)return;if(e.target.id==='hcRCR')f.cr=e.target.value;else f.sl=e.target.value;
 const r=RT.doneRound||RT.detail;if(!r)return;const cr=+String(f.cr).replace(',','.'),sl=+f.sl,el=$('hcPrev');if(el)el.innerHTML=cr>=25&&cr<=85&&sl>=55&&sl<=155?hcpPreviewText(hcpRoundPreview(r,cr,sl)):''});
async function hcpSubmitRound(r){const f=RT.hcF||{},cr=+String(f.cr).replace(',','.'),sl=+f.sl,n=WHS.eligible(r.holes);RT.hcErr='';
 if(!(cr>=25&&cr<=85))RT.hcErr='Enter the course rating from the scorecard, like 70.4.';else if(n===18&&cr<50)RT.hcErr='That looks like a 9-hole rating. Use the 18-hole rating, like 70.4.';else if(!(sl>=55&&sl<=155&&Number.isInteger(sl)))RT.hcErr='Enter the slope from the scorecard: a whole number from 55 to 155.';
 if(RT.hcErr)return rtRender();
 const p=hcpRoundPreview(r,cr,sl);if(!p)return;
 await hcpAdd({id:'r'+r.id,rid:r.id,d:r.date,t:r.finishedAt||r.createdAt||Date.now(),n,cr:Math.round(cr*10)/10,sl,par:p.par,g:p.adj.gross,a:p.adj.ags,c:r.course.name,tee:r.tee.name,src:'round'});
 // remember the rating and slope on the course so they're filled in next time
 try{const c=await RStore.getCourse(r.course.key);if(c&&c.tees){const t=c.tees.find(x=>x.name===r.tee.name);if(t&&(t.rating!==cr||t.slope!==sl)){t.rating=cr;t.slope=sl;await RStore.saveCourse(c);if(RT.course&&keyBase(RT.course.key)===keyBase(c.key)){const t2=RT.course.tees.find(x=>x.name===r.tee.name);if(t2){t2.rating=cr;t2.slope=sl}}}}}catch(_){}
 RT.hcTee[r.id]={cr,sl};toast(hcpAfterNote('r'+r.id).replace('Score added','Submitted'));rtRender()}
// ---- finding your local course ----
async function profCourseSearch(){profCollect();const q=String(PROF.f.cq||'').trim();PROF.clMsg='';if(q.length<2){PROF.clMsg='Type at least two letters of the course or town.';return profRender()}
 PROF.clBusy=`Searching for “${q}”…`;PROF.cl=null;profRender();let cs=[];
 if(!HOSTED_IN_CLAUDE){try{const rs=await OSM.nom({q:/golf/i.test(q)?q:q+' golf',limit:12});cs=dedupe(rs.filter(isGolf).map(n=>nomRow(n,null)).filter(Boolean))}catch(_){}}
 cs=rtExtraSearch(q,cs).slice(0,12);PROF.clBusy='';PROF.cl=cs;if(!cs.length)PROF.clMsg=HOSTED_IN_CLAUDE?'No match in Caddy Coach\'s course list. Use the name as you typed it, below.':'No UK course matched. Check the spelling, try the town, or use the name as you typed it.';profRender()}
async function profCourseNear(){PROF.clMsg='';PROF.cl=null;
 if(gpsBlocked()||!navigator.geolocation){PROF.clMsg=HOSTED_IN_CLAUDE?'Location isn\'t available inside Claude. Search for your course by name instead; the phone app can use your location.':'This phone can\'t share its location. Search by name instead.';return profRender()}
 PROF.clBusy='Finding your location…';profRender();
 const pos=await new Promise(res=>navigator.geolocation.getCurrentPosition(p=>res(p),e=>res({err:e}),{enableHighAccuracy:false,timeout:12000,maximumAge:300000}));
 if(!pos||pos.err){PROF.clBusy='';PROF.clMsg=pos&&pos.err&&pos.err.code===1?'Location is turned off for Caddy Coach. Turn it on in your phone\'s settings, or search by name.':'Couldn\'t get your location. Search by name instead.';return profRender()}
 const lat=pos.coords.latitude,lon=pos.coords.longitude;PROF.clBusy='Looking for courses near you…';profRender();let cs=[];
 if(!HOSTED_IN_CLAUDE){const d=.25,k=Math.cos(lat*Math.PI/180),vb=[lon-d/k,lat+d,lon+d/k,lat-d].map(x=>x.toFixed(4)).join(',');
  try{const rs=await OSM.nom({q:'golf course',viewbox:vb,bounded:1,limit:40});cs=rs.filter(isGolf).map(n=>nomRow(n,{lat,lon})).filter(Boolean)}catch(_){}}
 cs=rtExtraNear(lat,lon,dedupe(cs)).map(c=>Object.assign(c,{mi:c.mi??miles(lat,lon,c.lat,c.lon)})).filter(c=>c.mi<=20).sort((a,b)=>a.mi-b.mi).slice(0,10);
 PROF.clBusy='';PROF.cl=cs;if(!cs.length)PROF.clMsg='No courses found within 20 miles. Search by name instead.';profRender()}
// ---- validation and saving ----
async function profCheckName(un){if(!UN_RE.test(un)||PROF.avail[un]==='free'||PROF.avail[un]==='taken')return;PROF.avail[un]='checking';profAvailText();
 try{const p=await PDir.get(un);PROF.avail[un]=p?'taken':(PDir.cached(un)?'taken':'free')}catch(_){PROF.avail[un]=PDir.cached(un)?'taken':'unknown'}profAvailText()}
function profAvailText(){if(PROF.mode!=='signup')return;const el=$('pfAvail');if(!el)return;const un=unorm($('pfUser')&&$('pfUser').value),av=PROF.avail[un];
 el.textContent=!un?'3 to 20 letters, numbers, dots or underscores.':!UN_RE.test(un)?'Use 3 to 20 letters, numbers, dots or underscores.':av==='free'?`@${un} is free.`:av==='taken'?`@${un} is taken. Try another.`:av==='checking'?'Checking…':av==='unknown'?`Couldn't check @${un} right now; it's checked again when you save.`:'';
 el.className='pfHint'+(av==='taken'?' bad':av==='free'?' good':'')}
function profValidate(ed){const f=PROF.f,e={};if(!String(f.pfFirst||'').trim())e.pfFirst='Enter your first name.';if(!String(f.pfLast||'').trim())e.pfLast='Enter your last name.';
 if(!ed){const un=unorm(f.pfUser);if(!un)e.pfUser='Choose a username.';else if(!UN_RE.test(un))e.pfUser='Use 3 to 20 letters, numbers, dots or underscores, with no spaces.';else if(PROF.avail[un]==='taken')e.pfUser=`@${un} is taken. Try another.`}
 if(!PROF.course)e.course='Choose your local course. Search for it, or use your location.';return e}
async function profSubmit(kind){profCollect();PROF.err={};
 if(kind==='hcp-start'||kind==='hcp-add')return hcpSubmitForm(kind);
 if(kind==='login')return profLogin();
 if(kind==='setpw'||kind==='chpw')return profSetPw(kind);
 if(kind==='forgot')return profForgot();
 if(kind==='resetpw')return profResetPw();
 if(kind==='email')return profSaveEmail();
 if(kind==='feedback'){const f=PROF.f,msg=String($('pfFb').value||'').trim();f.pfFb=msg;f.fbDev=$('pfFbDev').checked;PROF.err={};if(msg.length<5){PROF.err.pfFb='Write a few words so we know what you mean.';return profRender()}
  const card={v:1,u:PROF.me.username,cat:f.fbk||'bug',msg,at:new Date().toISOString()};if(f.fbDev)Object.assign(card,{ua:navigator.userAgent.slice(0,240),scr:`${screen.width}x${screen.height}@${devicePixelRatio}`,ver:window.CC_VER||document.documentElement.dataset.ver||'',mode:HOSTED_IN_CLAUDE?'claude':'app'});
  PROF.busy=true;profRender();try{if(HOSTED_IN_CLAUDE){const db=await PDir.db();if(!db)throw new Error('offline');await db.doc('feedback/'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)).set(card)}else await sbSend('course_cards',[{course_key:'fb~'+card.at.slice(0,10)+'~'+Math.random().toString(36).slice(2,8),name:'Feedback',card,device:SB.device()}])}
  catch(e){PROF.busy=false;PROF.err._form='Couldn\'t send it just now. Try again.';return profRender()}
  PROF.busy=false;PROF.f={};PROF.note='Thanks: your feedback has been sent.';return profShow('me')}
 if(kind==='delacct'){const f=PROF.f;PROF.err={};if(!f.pfDelPw)PROF.err.pfDelPw='Enter your password.';f.delOk=$('pfDelOk').checked;if(!f.delOk)PROF.err.pfDelOk='Tick the box to confirm.';if(Object.keys(PROF.err).length)return profRender();
  PROF.busy=true;profRender();const u=PROF.me.username;
  try{if(HOSTED_IN_CLAUDE){const cur=await PDir.get(u);if(cur&&cur.pw&&!await pwMatches(f.pfDelPw,cur.pw)){PROF.busy=false;PROF.err.pfDelPw='That password isn\'t right.';return profRender()}}
   else{try{await Auth.signIn(u,f.pfDelPw)}catch(err){PROF.busy=false;PROF.err.pfDelPw=err.status===400?'That password isn\'t right.':'Deleting your account needs a connection. Check your signal and try again.';return profRender()}}
   await deleteMyEverything();lsSet('cc_deleted',1);location.reload()}
  catch(err){console.error(err);PROF.busy=false;PROF.err._form='Your account couldn\'t be deleted just now. Nothing has been removed. Check your signal and try again.';profRender()}return}
 const ed=kind==='edit';const e=profValidate(ed);if(!ed&&!HOSTED_IN_CLAUDE&&!emailOk(PROF.f.pfEmail))e.pfEmail=PROF.f.pfEmail?'That doesn\'t look like an email address. Check it, like name@example.com.':'Enter your email address.';if(!ed)Object.assign(e,pwProblems(PROF.f.pfPw1,PROF.f.pfPw2,unorm(PROF.f.pfUser),'pfPw1','pfPw2'));
 if(Object.keys(e).length){PROF.err=e;profRender();const k=Object.keys(e)[0];const el=$(k)||$('pfCq');if(el)el.focus();return}
 const f=PROF.f;PROF.busy=true;profRender();
 const p={username:ed?PROF.me.username:unorm(f.pfUser),first:f.pfFirst.trim(),last:f.pfLast.trim(),photo:PROF.photo||null,course:PROF.course,updatedAt:Date.now()};
 const hand=f.hand||Hand.get();
 try{if(ed){Hand.set(hand);p.createdAt=PROF.me.createdAt;if(PROF.me.pw)p.pw=PROF.me.pw;if(PROF.me.authId)p.authId=PROF.me.authId;try{await PDir.update(p)}catch(_){const q=lsGet('cc_prof_out',[]);q.push({op:'update',p});lsSet('cc_prof_out',q)}PDir.cache(p);PROF.me=p;PROF.busy=false;PROF.note='Profile saved.';profTopbar();return profShow('me')}
  p.createdAt=Date.now();const pw=String(PROF.f.pfPw1);let r;
  // a new profile needs a connection: that's how Caddy Coach makes sure nobody else already has the username
  try{const o=await PDir.get(p.username);if(o)r='taken'}catch(_){PROF.busy=false;PROF.err._form='Creating a profile needs a connection, so Caddy Coach can check nobody else has that username. Check your signal and try again.';return profRender()}
  if(!r){if(HOSTED_IN_CLAUDE){p.pw=await pwHash(pw);r=await PDir.create(p)}
   else{try{const ss=await Auth.signUp(p.username,pw,String(PROF.f.pfEmail).trim());p.authId=ss.user.id}catch(err){PROF.busy=false;
     if(err.code==='email_exists'||err.code==='bad_email'){PROF.err.pfEmail=err.code==='email_exists'?'That email is already used by another Caddy Coach account. Log in instead, or use a different email.':'That email address was refused. Check it and try again.';return profRender()}
     if(err.status===422&&/already|registered|exists/i.test(err.message+err.code))r='taken';
     else if(err.code==='needs_confirm'){PROF.err._form='Your account was made, but the app\'s server is asking for email confirmation. The app owner needs to turn off "Confirm email" in Supabase.';return profRender()}
     else if(err.status===422||/weak|password/i.test(err.message)){PROF.err.pfPw1='The server says that password isn\'t strong enough. Try a longer one.';return profRender()}
     else if(err.status===429){PROF.err._form='Too many tries. Wait a minute and try again.';return profRender()}
     else{PROF.err._form='Couldn\'t create your account just now. Check your signal and try again.';return profRender()}}
    if(!r){try{r=await PDir.create(p)}catch(_){r='error'}if(r!=='ok'){try{await sbRpc('delete_my_account')}catch(_){}await Auth.signOut()}}}}
  if(r==='taken'){PROF.busy=false;PROF.avail[p.username]='taken';PROF.err.pfUser=`@${p.username} is taken. Try another.`;profRender();$('pfUser')&&$('pfUser').focus();return}
  if(r!=='ok'){PROF.busy=false;PROF.err._form='Couldn\'t create your profile just now. Try again.';return profRender()}
  PDir.cache(p);Hand.setLocal(hand,p.username);lsSet('cc_hand_push_'+p.username,1);PROF.busy=false;await profEnter(p,true)}
 catch(err){console.error(err);PROF.busy=false;PROF.err._form='Something went wrong saving your profile. Try again.';profRender()}}
// logging in: remember who it is, then start the app fresh under their profile
async function profEnter(p,isNew){await Sess.set(p.username);if(isNew)lsSet('cc_welcome',p.username);location.reload()}
// ---- privacy: what's kept where, a copy of everything, and deleting your account ----
const APP_OWNER_EMAIL='';   // put the address people can contact you on here before launch
function privacyHTML(){const back=PROF.me?'to-me':(PROF.privBack||'to-signup');
 return `<div class="pfCard pfPriv"><button type="button" class="link pfBack" data-pf="${back}">Back</button><h2>Privacy and your data</h2>
  <p>Caddy Coach is a coaching app for golfers. Here's what it keeps, where, and why.</p>
  <h3>Kept only on your phone</h3><ul><li>Your swing videos, swing analyses and the body-tracking from them. Tracking runs on your phone; videos aren't uploaded.</li><li>Your rounds, scorecards, hole notes, practice plan and the players you add to a round.</li></ul>
  <h3>Kept online with your profile</h3><ul><li>Your name, username, photo, local course and which hand you play.</li><li>Your email address, kept with your login and used only to send you a password reset link when you ask for one. Other golfers can't see it.</li><li>Your club yardages and your handicap record, so they're there on any phone you log in on. Only you can read these.</li><li>Rounds you choose to post to your club leaderboard, with your first name and initial.</li><li>Feedback you send, with your phone model, so problems can be fixed.</li><li>Pin positions you mark on a green (with your username, for that day).</li><li>If you link to a coach: the swings you choose to send them (scores and key-position pictures, never your video) and their notes.</li></ul>
  <h3>Shared with every Caddy Coach golfer, without your name</h3><ul><li>Green and tee positions you map, and scorecards, course ratings and slopes you correct.</li></ul>
  <h3>Counted anonymously</h3><ul><li>Which days you open the app and how many rounds, swings and practice sessions you do, stored under a one-way code instead of your name, so we can see how Caddy Coach is used.</li></ul>
  <h3>Error reports</h3><ul><li>If something goes wrong in the app, a report of the error (the screen, your phone and browser type and the app version, but not your name, username, email, location or videos) is sent to Sentry so it can be fixed.</li></ul>
  <h3>Other services the app uses</h3><ul><li>OpenStreetMap (course search and course maps), Esri (satellite pictures) and the weather service (conditions at the course) receive the course or area you look at. Your location itself isn't stored by Caddy Coach.</li></ul>
  <h3>Your rights</h3><p>You can download everything Caddy Coach holds about you, and delete your account and all of it, below. Under UK data protection law you can also ask for a copy or a correction${APP_OWNER_EMAIL?` at <a href="mailto:${esc(APP_OWNER_EMAIL)}">${esc(APP_OWNER_EMAIL)}</a>`:' from the app owner'}.</p>
  ${PROF.me?`<button type="button" class="pfBig" data-pf="data-download">Download all my data</button><button type="button" class="pfBig" data-pf="data-import">Bring in data from a file</button><input type="file" id="pfImport" accept="application/json,.json" hidden><button type="button" class="pfBig pfOut" data-pf="to-delacct">Delete my account</button>${PROF.note?`<p class="mut" role="status">${esc(PROF.note)}</p>`:''}`:''}</div>`}
function delAcctHTML(){return `<form class="pfCard" data-pf-form="delacct" novalidate><button type="button" class="link pfBack" data-pf="to-privacy">Back</button><h2>Delete your account</h2>${pErr('_form')}
  <p class="mut" style="margin:0">This deletes your profile, your login, your yardages and handicap record online, your leaderboard entries, and every round, swing and video of yours on this phone. It can't be undone. You can download your data first.</p>
  ${pIn('pfDelPw','Your password','type="password" autocomplete="current-password" required',PROF.f.pfDelPw)}
  <label class="fgNo"><input type="checkbox" id="pfDelOk" ${PROF.f.delOk?'checked':''}> I understand this deletes everything and can't be undone</label>${pErr('pfDelOk')}
  <button type="submit" class="pfBig pfOut" ${PROF.busy?'disabled':''}>${PROF.busy?'Deleting…':'Delete my account for good'}</button></form>`}
async function myDataBlob(){const me=Object.assign({},PROF.me);delete me.pw;let rounds=[],swings=[],det=[];try{rounds=await RStore.list()}catch(_){}try{swings=await Store.list()}catch(_){}
 for(const s of swings){try{const d=await Store.detail(s.id);if(d){const c=Object.assign({},d);delete c.keys;delete c.clip;det.push(c)}}catch(_){}}
 const out={exported:new Date().toISOString(),app:'Caddy Coach',profile:me,accountEmail:typeof Auth!=='undefined'&&Auth.realEmail()||null,hand:Hand.get(),bag:await BagStore.load().catch(()=>BG.bag||null),handicap:HcpStore.rec||null,
  rounds,swings:swings.map(s=>Object.assign({},s,{thumb:undefined})),swingDetails:det,practicePlan:lsGet(planKey(),null),playingPartners:RT.pals||[],leaderboardPosts:Object.keys(lsGet('cc_lbp',{}))};
 return new Blob([JSON.stringify(out,null,1)],{type:'application/json'})}
// bring in a file made with "Download all my data" (for example from the app's old web address, or another phone).
// Adds what isn't here yet; never overwrites or removes anything.
async function importMyData(file){
 let j;try{j=JSON.parse(await file.text())}catch(_){throw Object.assign(new Error('bad'),{why:'That file isn\'t a Caddy Coach data file.'})}
 if(!j||j.app!=='Caddy Coach'||!Array.isArray(j.rounds))throw Object.assign(new Error('bad'),{why:'That file isn\'t a Caddy Coach data file.'});
 const who=j.profile&&j.profile.username;if(who&&PROF.me&&who!==PROF.me.username)throw Object.assign(new Error('other'),{why:`That file belongs to ${who}. Log in as ${who} to bring it in.`});
 let nr=0,ns=0;
 const haveR=new Set((await RStore.list().catch(()=>[])).map(r=>r.id));
 for(const r of j.rounds){if(!r||!r.id||haveR.has(r.id))continue;try{await RStore.save(r);nr++}catch(e){console.error(e)}}
 const haveS=await Store.list().catch(()=>[]),seen=new Set(haveS.map(x=>x.createdAt));
 const det=new Map((j.swingDetails||[]).map(d=>[d.createdAt,d]));
 for(const sw of j.swings||[]){if(!sw||!sw.createdAt||seen.has(sw.createdAt))continue;
  const sum=Object.assign({},sw);delete sum.thumb;delete sum.id;sum.hasClip=false;
  const d=Object.assign({keys:[]},det.get(sw.createdAt)||{});delete d.clip;
  try{await Store.save(sw.id||('i'+sw.createdAt),sum,d);ns++}catch(e){console.error(e)}}
 if(j.handicap){try{const cur=HcpStore.rec||await HcpStore.load(),m=hcpMerge(cur,hcpClean(j.handicap));if(m&&hcpSig(m)!==hcpSig(cur)){HcpStore.rec=m;await HcpStore.save()}}catch(e){console.error(e)}}
 if(j.bag){try{const b=BG.bag||await BagStore.load();const has=b&&Object.values(b.yards||{}).some(y=>y&&y.carry);if(!has){BG.bag=bagClean(Object.assign({},j.bag,{updatedAt:Date.now()}));await BagStore.save(BG.bag)}}catch(e){console.error(e)}}
 if(j.practicePlan&&!lsGet(planKey(),null))lsSet(planKey(),j.practicePlan);
 if(Array.isArray(j.playingPartners)&&j.playingPartners.length){const cur=RT.pals||[],names=new Set(cur.map(x=>x.name));RT.pals=cur.concat(j.playingPartners.filter(x=>x&&x.name&&!names.has(x.name)));palKeep()}
 if(Array.isArray(j.leaderboardPosts)){const m=lsGet('cc_lbp',{});j.leaderboardPosts.forEach(k=>{m[k]=m[k]||1});lsSet('cc_lbp',m)}
 return {nr,ns}}
async function deleteMyEverything(){const u=PROF.me.username;
 // online first: if that fails, nothing on the phone is touched
 if(HOSTED_IN_CLAUDE){const db=await PDir.db();if(db)await db.doc('profiles/'+u).delete()}else await sbRpc('delete_my_account');
 try{for(const s of await Store.list())await deleteRound(s.id).catch(()=>{})}catch(_){}
 try{for(const r of await RStore.list())await RStore.remove(r.id).catch(()=>{})}catch(_){}
 try{await RStore.setLive(null)}catch(_){}
 for(const k of ['cc_bag','cc_hcp','cc_where','cc_rounds','cc_rlive','cc_index'])try{localStorage.removeItem(Store.k(k))}catch(_){}
 for(const k of [planKey(),'cc_hand_'+u,'cc_lbp','cc_welcome'])try{localStorage.removeItem(k)}catch(_){}
 const all=lsGet('cc_profiles',{});delete all[u];lsSet('cc_profiles',all);
 if(lsGet('cc_legacy_owner',null)===u)try{localStorage.removeItem('cc_legacy_owner')}catch(_){}
 await Auth.signOut().catch(()=>{});await Sess.clear()}
async function profLogout(){await Auth.signOut();await Sess.clear();location.reload()}
async function sbRpc(fn,args){if(Auth.s)await Auth.fresh();const r=await fetch(`${SB.url}/rest/v1/rpc/${fn}`,{method:'POST',headers:Object.assign(SB.h(),{'Content-Type':'application/json'}),body:JSON.stringify(args||{})});if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text().catch(()=>'')).slice(0,120));return r.status===204?null:r.json().catch(()=>null)}
// logging in: your own password; a profile from the 1234 days uses 1234 one last time, then chooses its own
async function profLogin(){const u=unorm(PROF.f.pfU||(PROF.pend&&PROF.pend.username)),pw=String(PROF.f.pfPw||'');PROF.err={};
 if(!u)PROF.err.pfU='Enter your username.';if(!pw)PROF.err.pfPw='Enter your password.';if(Object.keys(PROF.err).length)return profRender();
 PROF.busy=true;profRender();let p=null,reach=true;try{p=await PDir.get(u)}catch(_){reach=false}
 const done=()=>{PROF.busy=false;profRender()};
 if(!p){PROF.err.pfU=reach?`There's no profile called @${u}. Check the spelling, or create a profile.`:'Logging in needs a connection. Check your signal and try again.';return done()}
 const legacy=HOSTED_IN_CLAUDE?!p.pw:!p.authId;
 if(legacy){if(pw===PW_LEGACY){PROF.busy=false;PROF.pend=p;PROF.f={};return profShow('setpw')}
  // a new password chosen on an earlier try whose last step didn't finish: log in with it and finish linking now
  if(!HOSTED_IN_CLAUDE){let ss=null;try{ss=await Auth.signIn(u,pw)}catch(_){}
   if(ss){try{await PDir.claim(u,ss.user.id)}catch(err){console.error('claim',err);await Auth.signOut();PROF.err._form=pwServerWhy(err,'claim')||'Couldn\'t finish setting up your password. Try again.';return done()}
    p=Object.assign({},p,{authId:ss.user.id});PDir.cache(p);lsSet('cc_cloud_repush_'+u,1);PROF.busy=false;return profEnter(p)}}
  PROF.err.pfPw='That password isn\'t right.';return done()}
 if(HOSTED_IN_CLAUDE){if(!await pwMatches(pw,p.pw)){PROF.err.pfPw='That password isn\'t right.';return done()}}
 else{try{const ss=await Auth.signIn(u,pw);if(ss.user.id!==p.authId){await Auth.signOut();PROF.err._form='That account doesn\'t match this profile.';return done()}}
  catch(err){PROF.err[err.status===400||err.status===401?'pfPw':'_form']=err.status===400||err.status===401?'That password isn\'t right.':err.status===429?'Too many tries. Wait a minute and try again.':'Couldn\'t log in just now. Check your signal and try again.';return done()}}
 PROF.busy=false;PDir.cache(p);await profEnter(p)}
// choosing a password: the first time after the 1234 days, or changing it later
// forgotten password: email a reset link (to the email on the account)
async function profForgot(){const who=String(PROF.f.pfWho||'').trim().toLowerCase();PROF.err={};if(!who){PROF.err.pfWho='Enter your username or email.';return profRender()}
 PROF.busy=true;profRender();try{await Auth.reset(who);PROF.note=`If ${who.includes('@')?'that email':'@'+who} has an email address on its account, a link to choose a new password is on its way. It can take a few minutes, so check your junk folder too.`}
 catch(err){PROF.err._form=err.status===429?'Too many reset emails have been sent. Try again in an hour.':err.code==='email_unavailable'?'Password reset emails aren\'t working yet. Ask the person who runs Caddy Coach to set up email sending in Supabase.':!err.status?'Couldn\'t reach the server. Check your signal and try again.':'That didn\'t work just now. Try again.'}
 PROF.busy=false;profRender()}
// arriving from a reset email: choose a new password, then straight into the app
async function profResetPw(){const f=PROF.f,u=PROF.resetU||'';const e=pwProblems(f.pfNewPw,f.pfNewPw2,u,'pfNewPw','pfNewPw2');if(Object.keys(e).length){PROF.err=e;return profRender()}
 PROF.busy=true;profRender();
 try{await Auth.setPassword(f.pfNewPw)}catch(err){PROF.busy=false;PROF.err._form=err.status===401||err.status===403?'That reset link has expired. Go to Log in, then Forgotten your password, to get a new one.':/weak|password/i.test(err.message)?'The server says this password isn\'t allowed. Choose a different one.':'Your new password couldn\'t be saved. Try again.';return profRender()}
 let p=null;try{p=await PDir.byAuth(Auth.s.user.id)}catch(_){}
 PROF.busy=false;PROF.resetU=null;if(!p){PROF.note='';PROF.f={pfU:u};PROF.err={_form:'Password saved. Log in with your username and new password.'};return profShow('login')}
 PDir.cache(p);return profEnter(p)}
async function profSaveEmail(){const f=PROF.f;PROF.err={};if(!emailOk(f.pfEmail)){PROF.err.pfEmail=f.pfEmail?'That doesn\'t look like an email address. Check it, like name@example.com.':'Enter your email address.';return profRender()}
 PROF.busy=true;profRender();try{await Auth.setEmail(String(f.pfEmail).trim())}catch(err){PROF.busy=false;
  if(err.code==='email_exists')PROF.err.pfEmail='That email is already used by another Caddy Coach account.';else if(err.code==='bad_email')PROF.err.pfEmail='That email address was refused. Check it and try again.';
  else PROF.err._form=err.status===401?'Log out and back in, then try again.':!err.status?'Couldn\'t reach the server. Check your signal and try again.':'Your email couldn\'t be saved just now. Try again.';return profRender()}
 PROF.busy=false;if(PROF.mode==='addemail'){PROF.pend=null;return profBoot()}PROF.note='Email saved.';return profShow('me')}
// turn a server refusal into something the golfer (or the app owner) can act on
function pwServerWhy(err,stage){const m=String((err&&(err.message||''))+' '+(err&&err.code||'')+' '+(err&&err.body||'')),low=m.toLowerCase();
 if(stage==='claim'){
  if(/auth_id|pgrst204|42703|column/.test(low))return 'The app\'s server hasn\'t been set up for passwords yet. The app owner needs to run the Caddy Coach setup SQL in Supabase (SQL Editor), then you can try again.';
  if(err&&err.code==='no_row'||/42501|row-level|permission/.test(low))return 'The app\'s server wouldn\'t let this profile take its new password. The app owner needs to run the Caddy Coach setup SQL in Supabase (SQL Editor), then try again with the same password.';
  return null}
 if(/weak_password|weak password|password should|password is known|pwned/.test(low))return 'The server says this password isn\'t allowed (it may be on a list of leaked passwords). Choose a different one.';
 if(/signup_disabled|signups not allowed|signup is disabled/.test(low))return 'New logins are switched off on the app\'s server. The app owner needs to turn on "Allow new users to sign up" in Supabase (Authentication, Sign In / Providers).';
 if(/email_provider_disabled|email logins are disabled|email signups are disabled/.test(low))return 'Email-and-password logins are switched off on the app\'s server. The app owner needs to turn on the Email provider in Supabase (Authentication, Sign In / Providers).';
 if(/email_address_invalid|invalid format|is invalid|email_address_not_authorized|not authorized|over_email_send_rate_limit|email rate limit|confirm/.test(low))return 'The app\'s server is trying to send a confirmation email. The app owner needs to turn off "Confirm email" in Supabase (Authentication, Sign In / Providers, Email).';
 return null}
async function profSetPw(kind){const f=PROF.f,base=kind==='chpw'?PROF.me:(PROF.pend||PROF.me),u=base&&base.username;if(!u)return profShow('login');
 const e=pwProblems(f.pfNewPw,f.pfNewPw2,u,'pfNewPw','pfNewPw2');if(kind==='chpw'&&!f.pfCurPw)e.pfCurPw='Enter your current password.';
 if(kind==='setpw'&&!HOSTED_IN_CLAUDE&&!emailOk(f.pfEmail))e.pfEmail=f.pfEmail?'That doesn\'t look like an email address. Check it, like name@example.com.':'Enter your email address.';
 if(Object.keys(e).length){PROF.err=e;profRender();const el=$(Object.keys(e)[0]);if(el)el.focus();return}
 PROF.busy=true;profRender();const fail=t=>{PROF.busy=false;PROF.err._form=t;profRender()};
 try{
  if(HOSTED_IN_CLAUDE){const cur=await PDir.get(u)||base;if(kind==='chpw'&&!await pwMatches(f.pfCurPw,cur.pw)){PROF.busy=false;PROF.err.pfCurPw='That isn\'t your current password.';return profRender()}
   const p=Object.assign({},cur,{pw:await pwHash(f.pfNewPw),updatedAt:Date.now()});await PDir.update(p);PDir.cache(p);
   if(kind==='chpw'){PROF.me=p;PROF.busy=false;PROF.note='Password changed.';return profShow('me')}PROF.pend=null;return profEnter(p)}
  if(kind==='chpw'){try{await Auth.signIn(u,f.pfCurPw)}catch(err){PROF.busy=false;PROF.err.pfCurPw=err.status===400?'That isn\'t your current password.':'Couldn\'t check it just now. Try again.';return profRender()}
   await Auth.setPassword(f.pfNewPw);PROF.busy=false;PROF.note='Password changed.';return profShow('me')}
  // the first password: make the account, then link the profile to it
  let ss;try{ss=await Auth.signUp(u,f.pfNewPw,String(f.pfEmail||'').trim())}catch(err){
   if(err.code==='email_exists'||err.code==='bad_email'){PROF.busy=false;PROF.err.pfEmail=err.code==='email_exists'?'That email is already used by another Caddy Coach account. Use a different one.':'That email address was refused. Check it and try again.';return profRender()}
   if(err.status===422&&/already|registered|exists/i.test(err.message+err.code)){try{ss=await Auth.signIn(u,f.pfNewPw)}catch(_){return fail(`You already chose a password for @${u} on an earlier try. Type that same password here, or go back and log in with it.`)}}
   else if(err.code==='needs_confirm')return fail('The app\'s server is asking for email confirmation. The app owner needs to turn off "Confirm email" in Supabase.');
   else{console.error('sign up',err);return fail(pwServerWhy(err,'signup')||(err.status===429?'Too many tries. Wait a minute and try again.':!navigator.onLine||!err.status?'Couldn\'t reach the server. Check your signal and try again.':`The server refused it (${err.status}: ${String(err.message).slice(0,120)}).`))}}
  try{await PDir.claim(u,ss.user.id)}catch(err){console.error('claim',err);await Auth.signOut();return fail(pwServerWhy(err,'claim')||`Couldn't link @${u} to your new password (${String(err.message).slice(0,120)}). Try again.`)}
  const p=Object.assign({},base,{authId:ss.user.id});PDir.cache(p);PROF.pend=null;PROF.busy=false;
  // push this phone's bag and handicap again so they're saved under the new login
  lsSet('cc_cloud_repush_'+u,1);return profEnter(p)}
 catch(err){console.error(err);fail(`Your password couldn't be saved (${String(err&&err.message||err).slice(0,120)}). Try again, and if it keeps happening use Send feedback.`)}}
// avatar in the top bar
function profTopbar(){const b=$('pfBtn');if(!b)return;const me=PROF.me;b.hidden=!me;if(me){b.innerHTML=profAv(me,34);b.setAttribute('aria-label',`Your profile, ${me.first} ${me.last}`)}}
document.addEventListener('click',e=>{const t=e.target.closest('[data-pf],[data-pf-pick]');if(!t)return;
 if(t.dataset.pfPick!=null){PROF.course=PROF.cl[+t.dataset.pfPick];PROF.err.course='';profCollect();return profRender()}
 const a=t.dataset.pf;profCollect();
 if(a==='to-signup'){PROF.err={};PROF.f={};PROF.photo=null;PROF.course=null;PROF.cl=null;PROF.clMsg='';return profShow('signup')}
 if(a==='to-login'){PROF.err={};PROF.f={pfU:PROF.f.pfUser||''};return profShow('login')}
 if(a==='to-edit'){const me=PROF.me;PROF.err={};PROF.f={pfFirst:me.first,pfLast:me.last,hand:Hand.get()};PROF.photo=me.photo||null;PROF.course=me.course||null;PROF.cl=null;PROF.clMsg='';PROF.note='';return profShow('edit')}
 if(a==='to-privacy'){PROF.err={};PROF.note='';PROF.privBack=PROF.mode==='signup'?'to-signup-keep':null;return profShow('privacy')}
 if(a==='to-signup-keep'){return profShow('signup')}
 if(a==='to-delacct'){PROF.err={};PROF.f={};return profShow('delacct')}
 if(a==='data-import'){const inp=$('pfImport');if(!inp)return;inp.value='';inp.onchange=async()=>{const f=inp.files&&inp.files[0];if(!f)return;t.disabled=true;PROF.note='Bringing in your data…';profRender();
  try{const r=await importMyData(f);PROF.note=r.nr||r.ns?`Brought in ${r.nr} round${r.nr===1?'':'s'} and ${r.ns} swing${r.ns===1?'':'s'}. Your handicap record has been merged too.`:'Everything in that file was already here.';if(typeof loadHistory==='function')loadHistory()}
  catch(e){console.error(e);PROF.note=e.why||'Couldn\'t bring that file in.'}finally{t.disabled=false;profRender()}};inp.click();return}
 if(a==='data-download'){t.disabled=true;myDataBlob().then(b=>saveFile(`caddy-coach-${PROF.me.username}-data.json`,b)).then(r=>{if(r==='saved'){PROF.note='Your data is saved as a file.';profRender()}}).catch(e=>{console.error(e);PROF.note='Couldn\'t gather your data just now.';profRender()}).finally(()=>{t.disabled=false});return}
 if(a==='to-settings'){PROF.err={};return profShow('settings')}
 if(a==='to-feedback'){PROF.err={};PROF.f={fbk:'bug'};return profShow('feedback')}
 if(a==='invite'){const url=location.origin+location.pathname,text='Try Caddy Coach: swing analysis, a shot tracer, course GPS and your handicap, all in one app.';
  (navigator.share?navigator.share({title:'Caddy Coach',text,url}).catch(()=>{}):navigator.clipboard.writeText(text+' '+url).then(()=>toast('Link copied. Paste it to a friend.')).catch(()=>{}));return}
 if(a==='to-chpw'){PROF.err={};PROF.f={};return profShow('chpw')}
 if(a==='to-email'){PROF.err={};PROF.f={};return profShow('email')}
 if(a==='to-forgot'){PROF.err={};PROF.note='';PROF.f={pfWho:PROF.f.pfU||''};return profShow('forgot')}
 if(a==='switch-user'){PROF.pend=null;Auth.save(null);Sess.clear().then(()=>{PROF.f={};profShow('login')});return}
 if(a==='to-me'){PROF.note='';PROF.hcArm=null;PROF.hcDel=null;return profShow('me')}
 if(a==='hcp'){PROF.err={};PROF.hcDel=null;if(PROF.mode!=='hcp-add')PROF.note='';return profShow('hcp')}
 if(a==='hcp-start'){PROF.err={};PROF.hcArm=null;PROF.f={hcNone:false};return profShow('hcp-start')}
 if(a==='hcp-unarm'){PROF.hcArm=null;return profRender()}
 if(a==='hcp-add'){PROF.err={};PROF.note='';const L=HcpStore.rec&&HcpStore.rec.scores.slice().sort((x,y)=>(y.t||0)-(x.t||0))[0];PROF.f={hcN:'18',hcD:hcpToday(),hcC:L?L.c:(PROF.me.course?PROF.me.course.name:''),hcCR:L&&L.n===18?String(L.cr):'',hcSl:L?String(L.sl):'',hcP:L&&L.n===18?String(L.par):'72'};return profShow('hcp-add')}
 if(a==='hcp-del'){const id=t.dataset.id;if(PROF.hcDel!==id){PROF.hcDel=id;return profRender()}PROF.hcDel=null;hcpRemove(id).then(()=>{PROF.note='Score removed.';profRender()});return}
 if(a==='close')return profHide();
 if(a==='logout')return profLogout();
 if(a==='photo-remove'){PROF.photo=null;return profRender()}
 if(a==='course-change'){PROF.course=null;PROF.cl=null;return profRender()}
 if(a==='course-find')return profCourseSearch();
 if(a==='course-near')return profCourseNear();
 if(a==='course-own'){const q=String(PROF.f.cq||'').trim();if(q.length>=2){PROF.course={key:slug(q),name:q,lat:null,lon:null};PROF.err.course=''}return profRender()}
 if(a==='play'){const c=PROF.me.course;profHide();tab(8);if(c.lat!=null)rtOpenCourse({key:c.key,name:c.name,lat:c.lat,lon:c.lon,town:c.town||''});return}});
document.addEventListener('submit',e=>{const fm=e.target.closest('[data-pf-form]');if(!fm)return;e.preventDefault();profSubmit(fm.dataset.pfForm)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-pf-hand]');if(!b)return;profCollect();PROF.f.hand=b.dataset.pfHand;profRender()});
document.addEventListener('keydown',e=>{if(e.target&&e.target.id==='pfCq'&&e.key==='Enter'){e.preventDefault();profCourseSearch()}if(e.key==='Escape'&&PROF.mode==='me'&&!$('prof').hidden)profHide()});
let pfT=null;document.addEventListener('input',e=>{if(e.target.id==='pfUser'){PROF.f.pfUser=e.target.value;const un=unorm(e.target.value);profAvailText();clearTimeout(pfT);pfT=setTimeout(()=>profCheckName(un),350)}});
document.addEventListener('click',e=>{if(e.target.closest('#pfBtn')&&PROF.me){PROF.note='';profShow('me')}});
// a password-reset link from the email lands here with a one-time login in the address
async function profFromResetLink(){const h=new URLSearchParams(location.hash.slice(1));if(!h.get('access_token')&&!h.get('error_description'))return false;
 history.replaceState(null,'',location.pathname+location.search);
 if(h.get('error_description')||h.get('type')!=='recovery'){PROF.f={};PROF.err={_form:h.get('error_code')==='otp_expired'||/expired|invalid/i.test(h.get('error_description')||'')?'That reset link has expired or was already used. Ask for a new one below.':'That link didn\'t work. Ask for a new one below.'};PROF.note='';profShow('forgot');return true}
 try{const r=await fetch(`${SB.url}/auth/v1/user`,{headers:{apikey:SB.key,Authorization:'Bearer '+h.get('access_token')}});if(!r.ok)throw new Error('HTTP '+r.status);const user=await r.json();
  Auth.keep({access_token:h.get('access_token'),refresh_token:h.get('refresh_token'),expires_in:+h.get('expires_in')||3600,user});PROF.resetU=(user.user_metadata||{}).username||'';PROF.f={};PROF.err={};profShow('resetpw')}
 catch(_){PROF.f={};PROF.err={_form:'That reset link has expired. Ask for a new one below.'};PROF.note='';profShow('forgot')}return true}
async function profBoot(){profShow('boot');await Store.init();if(!HOSTED_IN_CLAUDE&&await profFromResetLink())return;const s=await Sess.get();
 if(s){let p=PDir.cached(s.u),fresh=null;try{fresh=await PDir.get(s.u)}catch(_){}if(fresh){p=Object.assign({},p||{},fresh);PDir.cache(p)}
  if(p){
   // the next time a 1234-era profile opens the app, it chooses its own password; any other profile needs its login
   const legacy=fresh?(HOSTED_IN_CLAUDE?!fresh.pw:!fresh.authId):false;
   if(legacy){PROF.pend=p;PROF.f={};return profShow('setpw')}
   if(!HOSTED_IN_CLAUDE&&fresh&&Auth.userOf()!==s.u){PROF.pend=p;PROF.f={};return profShow('relogin')}
   if(!HOSTED_IN_CLAUDE&&Auth.s&&Date.now()>Auth.s.expires_at)Auth.refresh().catch(()=>{});
   // everyone now has an email on their account, for password resets
   if(!HOSTED_IN_CLAUDE&&fresh&&Auth.s&&!Auth.realEmail()){PROF.pend=p;PROF.me=null;PROF.f={};PROF.err={};return profShow('addemail')}
   if(lsGet('cc_cloud_repush_'+s.u,0)){try{localStorage.removeItem('cc_cloud_repush_'+s.u)}catch(_){}setTimeout(()=>{try{BagStore.load().then(b=>BagStore.save(b));HcpStore.load().then(()=>HcpStore.rec&&(HcpStore.rec.start||HcpStore.rec.scores.length)&&HcpStore.save())}catch(_){}},1500)}
   PROF.me=p;PDir.cache(p);profHide();profTopbar();v2AfterLogin();
   if(lsGet('cc_welcome',null)===p.username){try{localStorage.removeItem('cc_welcome')}catch(_){}toast(`Welcome to Caddy Coach, ${p.first}.`)}
   applyHand();HcpStore.load().then(hcpRefresh).catch(e=>console.error(e));BagStore.load().then(b=>{if(!BG.bag)BG.bag=b;if(lsGet('cc_hand_push_'+p.username,0)){try{localStorage.removeItem('cc_hand_push_'+p.username)}catch(_){}b.hand=Hand.get();return BagStore.save(b)}}).catch(()=>{});
   profFlush();PDir.get(p.username).then(q=>{if(q&&q.updatedAt!==p.updatedAt&&!lsGet('cc_prof_out',[]).length){PROF.me=q;PDir.cache(q);profTopbar()}}).catch(()=>{});return}}
 if(lsGet('cc_deleted',0)){try{localStorage.removeItem('cc_deleted')}catch(_){}setTimeout(()=>toast('Your account and all its data have been deleted.'),300)}
 profShow('welcome')}

// ===================== live pins, club pin sheets, club pages, usage counts, Caddy Coach Plus, coaching =====================
const v2On=()=>!HOSTED_IN_CLAUDE&&typeof SB!=='undefined'&&SB.on();
const v2Me=()=>PROF&&PROF.me&&PROF.me.username||'';
const v2Authed=()=>v2On()&&typeof Auth!=='undefined'&&!!Auth.tok();
const londonDay=()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date())}catch(_){return hcpToday()}};
async function sbRpcJ(fn,args){if(typeof Auth!=='undefined'&&Auth.s)await Auth.fresh();const r=await fetch(`${SB.url}/rest/v1/rpc/${fn}`,{method:'POST',headers:Object.assign(SB.h(),{'Content-Type':'application/json'}),body:JSON.stringify(args||{})});
 const t=await r.text();if(!r.ok){const e=new Error(t.slice(0,160)||('HTTP '+r.status));e.status=r.status;throw e}try{return JSON.parse(t)}catch(_){return null}}
// insert-or-update one row (needs the table's insert and update rules)
async function sbUpsert(table,row,conflict){if(typeof Auth!=='undefined'&&Auth.s)await Auth.fresh();const r=await fetch(`${SB.url}/rest/v1/${table}?on_conflict=${conflict}`,{method:'POST',headers:Object.assign(SB.h(),{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify([row])});
 if(!r.ok){const e=new Error((await r.text().catch(()=>'')).slice(0,160));e.status=r.status;throw e}return true}
async function sbDel(table,qs){if(typeof Auth!=='undefined'&&Auth.s)await Auth.fresh();const r=await fetch(`${SB.url}/rest/v1/${table}?${qs}`,{method:'DELETE',headers:SB.h()});if(!r.ok)throw new Error('HTTP '+r.status);return true}

// ---------- usage counts: anonymous, a one-way code per golfer (never the username) ----------
async function usageCode(){const u=v2Me();if(!u)return null;const k='cc_uh_'+u,c=lsGet(k,null);if(c)return c;
 try{const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(u+':caddy-coach-usage'));const h=Array.from(new Uint8Array(d).slice(0,10),b=>b.toString(16).padStart(2,'0')).join('');lsSet(k,h);return h}catch(_){return null}}
async function track(kind){if(!v2On()||!v2Me())return;try{if(kind==='open'){const k='cc_uo_'+v2Me();if(lsGet(k,'')===hcpToday())return;lsSet(k,hcpToday())}
 const uh=await usageCode();if(uh)sbSend('usage_events',[{kind,uhash:uh,day:hcpToday()}])}catch(_){}}
window.ccTrack=track;

// ---------- live pin positions ----------
const PINS={key:'',day:'',rows:[],at:0,busy:false,mark:false,pend:null,err:'',m:null,pm:null};
async function pinsLoad(c,force){if(!v2On()||!c)return false;const k=sbKey(c),d=londonDay();if(!force&&PINS.key===k&&PINS.day===d&&Date.now()-PINS.at<120e3)return false;
 try{const rows=await sbGet('pins',`course_key=eq.${encodeURIComponent(k)}&day=eq.${d}&select=hole,lat,lon,source,username,created_at&order=created_at.desc&limit=500`);PINS.rows=rows||[];PINS.key=k;PINS.day=d;PINS.at=Date.now();return true}catch(_){return false}}
// today's pin for a hole: the club's pin sheet wins; otherwise the spot most golfers agree on (within 4 m)
function pinFor(n){if(PINS.day!==londonDay())return null;const rs=PINS.rows.filter(r=>+r.hole===+n);if(!rs.length)return null;
 const club=rs.find(r=>r.source==='club');if(club)return{lat:club.lat,lon:club.lon,src:'club',n:1};
 const seen=new Set(),pl=rs.filter(r=>!seen.has(r.username)&&seen.add(r.username)),me=v2Me();
 let best=[];for(const r of pl){const g=pl.filter(q=>mBetween({lat:r.lat,lon:r.lon},{lat:q.lat,lon:q.lon})<4);if(g.length>best.length)best=g}
 if(best.length>=2)return{lat:best.reduce((a,r)=>a+r.lat,0)/best.length,lon:best.reduce((a,r)=>a+r.lon,0)/best.length,src:'confirmed',n:best.length,mine:best.some(r=>r.username===me)};
 const mine=pl.find(r=>r.username===me);if(mine)return{lat:mine.lat,lon:mine.lon,src:'mine',n:1,mine:true};
 return{lat:pl[0].lat,lon:pl[0].lon,src:'one',n:1}}
async function pinSave(c,n,p,src){const row={course_key:sbKey(c),hole:+n,day:londonDay(),lat:+(+p.lat).toFixed(6),lon:+(+(p.lon??p.lng)).toFixed(6),source:src||'player',username:v2Me()};
 if(!await sbPost('pins',[row]))throw new Error('not saved');PINS.rows.unshift(Object.assign({created_at:new Date().toISOString()},row));track('pin')}
const PIN_SVG=(fill)=>`<svg viewBox="0 0 24 34" width="28" height="40"><path d="M5 2v30" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3l15 5.5L6 14z" fill="${fill}"/><ellipse cx="5" cy="32" rx="4" ry="1.6" fill="rgba(0,0,0,.45)"/></svg>`;
function pinDraw(){const L=window.L;if(!GPS.map||!L||typeof RT==='undefined'||!RT.live)return;const h=gpsHole();
 if(PINS.m){GPS.map.removeLayer(PINS.m);PINS.m=null}if(PINS.pm){GPS.map.removeLayer(PINS.pm);PINS.pm=null}
 const p=pinFor(h.n);if(p)PINS.m=L.marker([p.lat,p.lon],{icon:L.divIcon({className:'gpsFlag pinFlag'+(p.src==='club'||p.src==='confirmed'?'':' unconf'),html:PIN_SVG(p.src==='club'||p.src==='confirmed'?'#f5c518':'#f5e6a8'),iconSize:[28,40],iconAnchor:[6,38]}),interactive:false,keyboard:false}).addTo(GPS.map);
 if(PINS.mark&&PINS.pend)PINS.pm=L.circleMarker([PINS.pend.lat,PINS.pend.lng],{radius:8,color:'#f5c518',weight:3,fillColor:'#fff',fillOpacity:.9,interactive:false}).addTo(GPS.map)}
function pinsMaybe(){if(!v2On()||!GPS.course||PINS.busy)return;PINS.busy=true;pinsLoad(GPS.course).then(ch=>{PINS.busy=false;if(ch&&!$('gpsOv').hidden){pinDraw();gpsPanel()}}).catch(()=>{PINS.busy=false})}
// the pin box at the top of the hole map
function pinPanelHTML(h,g){if(!v2On()||!GPS.course)return '';const p=pinFor(h.n),pos=GPS.pos;
 if(PINS.mark)return `<div class="pinBox mark"><b>Mark where the hole is on ${h.n}</b><p class="gpsP">Tap the hole on the map${pos?', or stand at the hole and use your position':''}. It helps every golfer playing ${esc(GPS.course.name||'here')} today.</p>${PINS.err?`<p class="gpsP bad" role="alert">${esc(PINS.err)}</p>`:''}
  <div class="gpsActs">${PINS.pend?'<button type="button" class="hrBtn" data-pin="save-tap">Save the pin here</button>':''}${pos?`<button type="button" class="hrBtn${PINS.pend?' ghost':''}" data-pin="save-here">I'm standing at the hole</button>`:''}<button type="button" class="hrBtn ghost" data-pin="cancel">Cancel</button></div></div>`;
 const dg=g&&pos?ydsBetween(pos,{lat:g.lat,lon:g.lon}):null,near=dg!=null&&dg<=35;
 if(p){const d=pos?ydsBetween(pos,{lat:p.lat,lon:p.lon}):null,lab=p.src==='club'?'from the club\'s pin sheet':p.src==='confirmed'?`confirmed by ${p.n} golfers today`:p.src==='mine'?'your mark, not confirmed yet':'marked by 1 golfer, not confirmed';
  const pl=d!=null&&d>15&&d<=400?playsLike(d,pos,{lat:p.lat,lon:p.lon}):null;
  return `<div class="pinBox"><span class="gpsK">To the pin (${lab})</span>${d!=null&&d<=2000?`<div class="gpsBig pin"><b>${d}</b><span>yds</span></div>${pl&&pl.yds!==d?`<p class="plays"><b>Plays like ${pl.yds}</b></p>`:''}`:''}
   ${p.src==='one'&&!p.mine&&near?'<p class="gpsP">Is the hole where the yellow flag is?</p><div class="gpsActs"><button type="button" class="hrBtn sm" data-pin="confirm">Yes, that\'s right</button><button type="button" class="hrBtn ghost sm" data-pin="mark">No, mark it</button></div>':p.src!=='club'&&near&&!p.mine?'<button type="button" class="cmLink" data-pin="mark">Pin in a different place? Mark it</button>':''}</div>`}
 if(near)return `<div class="pinBox"><b>Where's the hole today?</b><p class="gpsP">Mark it and everyone playing here today gets yards to the pin, not just the middle.</p><button type="button" class="hrBtn sm" data-pin="mark">Mark where the hole is</button></div>`;
 return ''}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-pin]');if(!b)return;const a=b.dataset.pin,h=gpsHole(),c=GPS.course;PINS.err='';
 if(a==='mark'){PINS.mark=true;PINS.pend=null;GPS.tap=null;gpsDrawLines();pinDraw();return gpsPanel()}
 if(a==='cancel'){PINS.mark=false;PINS.pend=null;pinDraw();return gpsPanel()}
 const p=a==='confirm'?pinFor(h.n):a==='save-tap'?PINS.pend&&{lat:PINS.pend.lat,lon:PINS.pend.lng}:a==='save-here'&&GPS.pos?{lat:GPS.pos.lat,lon:GPS.pos.lng}:null;if(!p)return;
 b.disabled=true;try{await pinSave(c,h.n,p,'player');PINS.mark=false;PINS.pend=null;toast(a==='confirm'?'Thanks: pin confirmed for today.':'Thanks: pin saved for today.')}catch(_){PINS.err='The pin couldn\'t be saved. Check your signal and try again.'}
 pinDraw();gpsPanel()});

// ---------- club page, club admins, today's pin sheet ----------
const CLUB={key:'',data:null,admins:[],busy:false,err:'',edit:false,logo:undefined};
const clubKey=()=>{const c=lbClub();return c?keyBase(c.key):''};
const amClubAdmin=()=>!!CLUB.admins.find(a=>a.username===v2Me())&&CLUB.key===clubKey();
async function clubLoad(force){const k=clubKey();if(!k||!v2On()||CLUB.busy)return;if(!force&&CLUB.key===k&&CLUB.at&&Date.now()-CLUB.at<300e3)return;CLUB.busy=true;
 try{const [d,a]=await Promise.all([sbGet('clubs',`club_key=eq.${encodeURIComponent(k)}&select=*`),sbGet('club_admins',`club_key=eq.${encodeURIComponent(k)}&select=username`)]);CLUB.data=d&&d[0]||null;CLUB.admins=a||[];CLUB.key=k;CLUB.at=Date.now()}catch(_){}
 CLUB.busy=false;if(typeof RT!=='undefined'&&RT.tab==='club')rtRender()}
function clubPageHTML(){const c=lbClub();if(!c||!v2On())return '';if(CLUB.key!==clubKey()&&!CLUB.busy)clubLoad();const D=CLUB.key===clubKey()?CLUB.data:null,adm=amClubAdmin();
 const col=D&&D.colour||'';
 const page=D&&(D.welcome||D.logo)?`<div class="card clubPage"${col?` style="border-top:5px solid ${esc(col)}"`:''}>${D.logo?`<img class="clubLogo" alt="${esc(D.name||c.name)} logo" src="${esc(D.logo)}">`:''}<h2 style="margin:0">${esc(D.name||c.name)}</h2>${D.welcome?`<p style="margin:8px 0 0;white-space:pre-line">${esc(D.welcome)}</p>`:''}</div>`:'';
 if(!adm)return page;
 return page+`<div class="card clubAdm"><h2 style="margin:0 0 4px">Club admin</h2><p class="mut" style="margin:0 0 12px">You run ${esc(c.name)} in Caddy Coach.</p>
  <div class="rtTwo"><button type="button" class="pri" data-club="pins">Set today's pins</button><button type="button" data-club="sheet">Today's pin sheet</button></div>
  ${CLUB.edit?clubEditHTML(D,c):'<button type="button" class="rtLink" data-club="edit" style="margin-top:10px">Edit the club page</button>'}
  <p class="mut" style="font-size:12.5px;margin:10px 0 0">Competitions you set up show as official.</p></div>`}
function clubEditHTML(D,c){const logo=CLUB.logo!==undefined?CLUB.logo:D&&D.logo;return `<form class="goForm" data-club-form novalidate>
 <div class="pfF"><label for="clWelcome">Welcome message for members</label><textarea id="clWelcome" rows="4" maxlength="400">${esc(D&&D.welcome||'')}</textarea></div>
 <div class="hcIn"><label>Club colour<input id="clColour" type="color" value="${esc(D&&D.colour||'#1d6b42')}"></label><label>Logo<input id="clLogo" type="file" accept="image/*"></label></div>
 ${logo?`<img class="clubLogo" alt="Logo preview" src="${esc(logo)}">`:''}${CLUB.err?`<p class="rtMsg bad" role="alert">${esc(CLUB.err)}</p>`:''}
 <div class="rtTwo"><button type="button" data-club="edit-cancel">Cancel</button><button type="submit" class="pri">Save club page</button></div></form>`}
document.addEventListener('change',async e=>{if(e.target.id!=='clLogo')return;const f=e.target.files&&e.target.files[0];if(!f)return;try{CLUB.logo=await profShrink(f)}catch(_){CLUB.err='That picture couldn\'t be opened. Try a JPEG or PNG.'}rtRender()});
document.addEventListener('submit',async e=>{if(!e.target.matches('[data-club-form]'))return;e.preventDefault();const c=lbClub(),k=clubKey();CLUB.err='';
 const row={club_key:k,name:String(c.name||'').slice(0,120),welcome:String($('clWelcome').value||'').trim().slice(0,400),colour:$('clColour').value,logo:CLUB.logo!==undefined?CLUB.logo:(CLUB.data&&CLUB.data.logo)||null,updated_by:v2Me(),updated_at:new Date().toISOString()};
 try{await sbUpsert('clubs',row,'club_key');CLUB.data=row;CLUB.edit=false;CLUB.logo=undefined;toast('Club page saved.')}catch(_){CLUB.err='It couldn\'t be saved. Check your signal and try again.'}rtRender()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-club]');if(!b)return;const a=b.dataset.club;
 if(a==='edit'){CLUB.edit=true;CLUB.err='';CLUB.logo=undefined;return rtRender()}if(a==='edit-cancel'){CLUB.edit=false;return rtRender()}
 if(a==='pins')return psOpen();if(a==='sheet')return psSheet()});

// today's pin sheet: the greenkeeper or pro taps each pin on the map; golfers then get yards to the real pin
const PS={open:false,c:null,i:0,holes:[],picks:{},map:null,mk:null,gm:null,me:null,watch:null,pos:null,busy:false,err:'',sheet:false};
async function psCourse(){const lc=lbClub();let c=null;try{c=await RStore.getCourse(lc.key)}catch(_){}
 if(!c){const kn=typeof KNOWN_COURSES!=='undefined'&&KNOWN_COURSES.find(x=>keyBase(x.key)===keyBase(lc.key));if(kn)c=JSON.parse(JSON.stringify(kn))}
 if(!c)c={key:lc.key,name:lc.name,lat:lc.lat,lon:lc.lon,greens:{},tees:[{name:'Tees',holes:Array.from({length:18},(_,i)=>({n:i+1,par:4}))}]};
 c.greens=c.greens||{};try{await sbApply(c)}catch(_){}return c}
function psEl(){let o=$('psOv');if(!o){o=document.createElement('div');o.id='psOv';o.className='psOv';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label','Today\'s pins');o.innerHTML='<div id="psTop"></div><div id="psMap"></div><div id="psPanel"></div><div id="psSheet" hidden></div>';document.body.appendChild(o)}return o}
async function psOpen(){const o=psEl();o.hidden=false;PS.open=true;PS.sheet=false;$('psSheet').hidden=true;$('psMap').hidden=false;document.documentElement.style.overflow='hidden';$('psPanel').innerHTML='<p class="gpsP">Loading the course…</p>';
 try{await loadLeaflet()}catch(_){$('psPanel').innerHTML='<p class="gpsP">The map couldn\'t load. Check your signal.</p><button type="button" class="hrBtn" data-ps="close">Close</button>';return}
 PS.c=await psCourse();PS.holes=(PS.c.tees&&PS.c.tees[0]&&PS.c.tees[0].holes||[]).map(h=>h.n);if(!PS.holes.length)PS.holes=Array.from({length:18},(_,i)=>i+1);
 await pinsLoad(PS.c,true);PS.picks={};PINS.rows.filter(r=>r.source==='club').forEach(r=>{if(!PS.picks[r.hole])PS.picks[r.hole]={lat:r.lat,lon:r.lon,saved:true}});PS.i=0;PS.err='';
 const L=window.L;if(!PS.map){PS.map=L.map('psMap',{zoomControl:false,maxZoom:20}).setView([PS.c.lat||54,PS.c.lon||-2],17);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,maxNativeZoom:19,attribution:'Imagery &copy; Esri, Maxar, Earthstar Geographics'}).addTo(PS.map);
  PS.map.on('click',ev=>{PS.picks[PS.holes[PS.i]]={lat:ev.latlng.lat,lon:ev.latlng.lng};psDraw()})}
 setTimeout(()=>PS.map.invalidateSize(),60);
 if(navigator.geolocation&&PS.watch==null)PS.watch=navigator.geolocation.watchPosition(p=>{PS.pos={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy};psPanel()},()=>{},{enableHighAccuracy:true,maximumAge:3000});
 psDraw(true)}
function psClose(){const o=$('psOv');if(o)o.hidden=true;PS.open=false;document.documentElement.style.overflow='';if(PS.watch!=null){navigator.geolocation.clearWatch(PS.watch);PS.watch=null}}
function psDraw(frame){const L=window.L,n=PS.holes[PS.i],g=PS.c.greens[n],p=PS.picks[n];
 if(PS.mk){PS.map.removeLayer(PS.mk);PS.mk=null}if(PS.gm){PS.map.removeLayer(PS.gm);PS.gm=null}
 if(g)PS.gm=L.circleMarker([g.lat,g.lon],{radius:5,color:'#fff',weight:2,fillColor:'#2f7d4f',fillOpacity:1,interactive:false}).addTo(PS.map);
 if(p)PS.mk=L.marker([p.lat,p.lon],{icon:L.divIcon({className:'gpsFlag pinFlag',html:PIN_SVG('#f5c518'),iconSize:[28,40],iconAnchor:[6,38]}),interactive:false}).addTo(PS.map);
 if(frame){if(g)PS.map.setView([g.lat,g.lon],19);else if(p)PS.map.setView([p.lat,p.lon],19)}
 $('psTop').innerHTML=`<button type="button" class="gpsIc" data-ps="prev" aria-label="Previous hole" ${PS.i===0?'disabled':''}>‹</button><div class="psT"><b>Hole ${n}</b><small>${Object.keys(PS.picks).length} of ${PS.holes.length} pins set</small></div><button type="button" class="gpsIc" data-ps="next" aria-label="Next hole" ${PS.i===PS.holes.length-1?'disabled':''}>›</button><button type="button" class="gpsIc" data-ps="close" aria-label="Close">✕</button>`;
 psPanel()}
function psPanel(){if(!PS.open||PS.sheet)return;const n=PS.holes[PS.i],g=PS.c.greens[n],p=PS.picks[n],all=Object.keys(PS.picks).length,news=Object.values(PS.picks).filter(x=>!x.saved).length;
 $('psPanel').innerHTML=`<div class="gpsDist"><span class="gpsK">${p?`Pin set for hole ${n}${p.saved?' (published)':''}`:`Tap where the hole is on ${n}`}</span>
  <p class="gpsP">${g?'The green dot is the middle of the green. ':'This green isn\'t mapped yet: zoom in on the satellite picture to find it. '}${p&&g?esc(pinDesc(PS.c,n,p)):''}</p>
  ${PS.err?`<p class="gpsP bad" role="alert">${esc(PS.err)}</p>`:''}
  <div class="gpsActs">${PS.pos?`<button type="button" class="hrBtn ghost sm" data-ps="here">I'm standing at the hole${PS.pos.acc>8?` (±${Math.round(PS.pos.acc*1.094)} yds)`:''}</button>`:''}${p?'<button type="button" class="hrBtn ghost sm" data-ps="clear">Clear</button>':''}${PS.i<PS.holes.length-1?'<button type="button" class="hrBtn sm" data-ps="next">Next hole</button>':''}</div>
  <button type="button" class="hrBtn" data-ps="publish" ${!news||PS.busy?'disabled':''} style="margin-top:10px;width:100%">${PS.busy?'Publishing…':`Publish ${news||''} pin${news===1?'':'s'} for today`}</button>
  ${all?'<button type="button" class="cmLink" data-ps="sheet">See and print the pin sheet</button>':''}</div>`}
// where the pin is on the green, as a pin sheet says it: yards on from the front (or from the middle) and left or right
function pinDesc(c,n,p){const g=c.greens[n];if(!g)return '';const t=g.tee||null,P={lat:p.lat,lon:p.lon};
 const ref=g.front?{lat:g.front.lat,lon:g.front.lon}:t?{lat:t.lat,lon:t.lon}:null;if(!ref){const d=ydsBetween(P,{lat:g.lat,lon:g.lon});return d<2?'In the middle of the green.':`${d} yds from the middle.`}
 const brg=bearingTo(ref,{lat:g.lat,lon:g.lon}),toP=bearingTo({lat:g.lat,lon:g.lon},P),dm=ydsBetween({lat:g.lat,lon:g.lon},P),ang=(toP-brg)*Math.PI/180;
 const along=Math.round(dm*Math.cos(ang)),side=Math.round(dm*Math.sin(ang));
 const depth=g.front?Math.max(0,ydsBetween({lat:g.front.lat,lon:g.front.lon},{lat:g.lat,lon:g.lon})+along):null;
 const lr=Math.abs(side)<2?'centre':`${Math.abs(side)} ${side>0?'right':'left'}`;
 return depth!=null?`${depth} on, ${lr}.`:`${Math.abs(along)<2?'Level with the middle':`${Math.abs(along)} yds ${along>0?'past':'short of'} the middle`}, ${lr}.`}
function psSheetHTML(){const c=PS.c,club=lbClub(),day=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}),logo=CLUB.data&&CLUB.data.logo;
 return `<div class="psSheet" id="psPrint">${logo?`<img class="clubLogo" alt="" src="${esc(logo)}">`:''}<h2 style="margin:0">${esc(club.name)}</h2><p class="mut" style="margin:2px 0 12px">Pin positions for ${day}</p>
  <div class="psGrid">${PS.holes.map(n=>{const p=PS.picks[n],g=c.greens[n];let dot='';if(p&&g){const brg=g.front?bearingTo({lat:g.front.lat,lon:g.front.lon},{lat:g.lat,lon:g.lon}):g.tee?bearingTo({lat:g.tee.lat,lon:g.tee.lon},{lat:g.lat,lon:g.lon}):0,a=(bearingTo({lat:g.lat,lon:g.lon},{lat:p.lat,lon:p.lon})-brg)*Math.PI/180,dm=Math.min(16,ydsBetween({lat:g.lat,lon:g.lon},{lat:p.lat,lon:p.lon}));dot=`<circle cx="${(30+dm*Math.sin(a)*1.6).toFixed(1)}" cy="${(30-dm*Math.cos(a)*1.6).toFixed(1)}" r="3.5" fill="#d23a2f"/>`}
   return `<div class="psH"><b>${n}</b><svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true"><ellipse cx="30" cy="30" rx="24" ry="27" fill="#cfe6cf" stroke="#2f7d4f" stroke-width="2"/>${dot}</svg><small>${p?esc(g?pinDesc(c,n,p):'Pin set (green not mapped yet)'):'Not set'}</small></div>`}).join('')}</div>
  <p class="mut" style="font-size:11px;margin:10px 0 0">Front of each green is at the bottom. Made with Caddy Coach.</p></div>
  <div class="gpsActs noPrint" style="margin-top:12px"><button type="button" class="hrBtn" data-ps="print">Print or save as PDF</button><button type="button" class="hrBtn ghost" data-ps="back">Back</button></div>`}
async function psSheet(){if(!PS.c){const o=psEl();o.hidden=false;PS.open=true;PS.c=await psCourse();PS.holes=(PS.c.tees&&PS.c.tees[0]&&PS.c.tees[0].holes||[]).map(h=>h.n);await pinsLoad(PS.c,true);PS.picks={};PINS.rows.filter(r=>r.source==='club').forEach(r=>{if(!PS.picks[r.hole])PS.picks[r.hole]={lat:r.lat,lon:r.lon,saved:true}})}
 psEl().hidden=false;PS.open=true;PS.sheet=true;document.documentElement.style.overflow='hidden';$('psMap').hidden=true;$('psPanel').innerHTML='';$('psTop').innerHTML='<div class="psT"><b>Today\'s pin sheet</b></div><button type="button" class="gpsIc" data-ps="close" aria-label="Close">✕</button>';const s=$('psSheet');s.hidden=false;s.innerHTML=psSheetHTML()}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-ps]');if(!b)return;const a=b.dataset.ps,n=PS.holes[PS.i];PS.err='';
 if(a==='close')return psClose();if(a==='prev'||a==='next'){PS.i=Math.max(0,Math.min(PS.holes.length-1,PS.i+(a==='next'?1:-1)));return psDraw(true)}
 if(a==='here'&&PS.pos){PS.picks[n]={lat:PS.pos.lat,lon:PS.pos.lng};return psDraw()}if(a==='clear'){delete PS.picks[n];return psDraw()}
 if(a==='sheet')return psSheet();if(a==='back'){PS.sheet=false;$('psSheet').hidden=true;$('psMap').hidden=false;setTimeout(()=>PS.map&&PS.map.invalidateSize(),60);return psDraw()}
 if(a==='print'){document.documentElement.classList.add('psPrinting');setTimeout(()=>{try{window.print()}catch(_){}document.documentElement.classList.remove('psPrinting')},50);return}
 if(a==='publish'){const rows=Object.entries(PS.picks).filter(([k,v])=>!v.saved).map(([k,v])=>({course_key:sbKey(PS.c),hole:+k,day:londonDay(),lat:+(+v.lat).toFixed(6),lon:+(+v.lon).toFixed(6),source:'club',username:v2Me()}));if(!rows.length)return;
  PS.busy=true;psPanel();try{if(!await sbPost('pins',rows))throw new Error('x');rows.forEach(r=>{PS.picks[r.hole].saved=true;PINS.rows.unshift(Object.assign({created_at:new Date().toISOString()},r))});toast(`Published ${rows.length} pin${rows.length===1?'':'s'}. Golfers see them now.`)}catch(_){PS.err='The pins couldn\'t be published. Check your signal and try again.'}PS.busy=false;psPanel()}});

// ---------- Caddy Coach Plus: switched off until there's a business and a Stripe account ----------
// To switch on: set on:true and paste the two Stripe payment links (and the customer portal link). See HOW-TO-PUT-IT-ONLINE.txt.
const PLUS={on:false,monthly:'£4.99 a month',yearly:'£34.99 a year',trialDays:14,linkMonthly:'',linkYearly:'',portal:'',freeSwings:3};
const ENT={s:null,at:0};
async function entLoad(){if(!PLUS.on||!v2Authed())return;try{const r=await sbGet('entitlements','select=plan,status,current_period_end&limit=1');ENT.s=r&&r[0]||null;ENT.at=Date.now();lsSet('cc_ent_'+v2Me(),ENT.s)}catch(_){ENT.s=lsGet('cc_ent_'+v2Me(),null)}}
const plusActive=()=>{if(!PLUS.on||HOSTED_IN_CLAUDE)return true;const e=ENT.s||lsGet('cc_ent_'+v2Me(),null);return !!e&&['active','trialing'].includes(e.status)&&(!e.current_period_end||Date.parse(e.current_period_end)>Date.now()-3*864e5)};
async function swingsThisMonth(){try{const m=new Date();m.setDate(1);m.setHours(0,0,0,0);return (await Store.list()).filter(s=>(s.createdAt||0)>=m.getTime()).length}catch(_){return 0}}
const PLUS_WHY={swing:`You've used your ${PLUS.freeSwings} free swing analyses this month.`,trace:'The shot tracer is part of Caddy Coach Plus.',grip:'Live grip coaching is part of Caddy Coach Plus.',compare:'Comparing swings is part of Caddy Coach Plus.'};
async function plusGate(f){if(plusActive())return true;if(f==='swing'&&await swingsThisMonth()<PLUS.freeSwings)return true;PROF.plusWhy=f;profShow('plus');return false}
const plusLink=u=>{if(!u)return '';try{const x=new URL(u);if(Auth.s&&Auth.s.user)x.searchParams.set('client_reference_id',Auth.s.user.id);const em=Auth.realEmail&&Auth.realEmail();if(em)x.searchParams.set('prefilled_email',em);return x.toString()}catch(_){return u}};
function plusHTML(){const why=PROF.plusWhy&&PLUS_WHY[PROF.plusWhy];return `<div class="pfCard"><button type="button" class="link pfBack" data-pf="${PROF.me&&PROF.plusFromMe?'to-me':'close'}">Back</button><h2>Caddy Coach Plus</h2>
 ${why?`<p class="pfOk" style="margin:0 0 10px">${esc(why)}</p>`:''}
 <ul class="plusList"><li>Unlimited AI swing analysis, with a score for every position</li><li>The shot tracer, with what your ball flight says about your clubface and path</li><li>Live grip coaching</li><li>Before-and-after swing comparison</li></ul>
 <p class="mut" style="margin:0 0 12px">GPS yardages, scoring, stats, your handicap and leaderboards stay free.</p>
 ${PLUS.linkMonthly||PLUS.linkYearly?`${PLUS.trialDays?`<p style="margin:0 0 10px"><b>Free for ${PLUS.trialDays} days</b>, then:</p>`:''}<div class="rtTwo">${PLUS.linkYearly?`<a class="btn pri" href="${esc(plusLink(PLUS.linkYearly))}" target="_blank" rel="noopener">${esc(PLUS.yearly)}</a>`:''}${PLUS.linkMonthly?`<a class="btn" href="${esc(plusLink(PLUS.linkMonthly))}" target="_blank" rel="noopener">${esc(PLUS.monthly)}</a>`:''}</div>
  <p class="pfHint">Payments are handled by Stripe. Come back to Caddy Coach afterwards and Plus switches on within a minute.</p><button type="button" class="link" data-plus="refresh">I've paid: check again</button>`:'<p class="pfHint">Payments aren\'t switched on yet.</p>'}</div>`}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-plus]');if(!b)return;if(b.dataset.plus==='refresh'){b.disabled=true;await entLoad();b.disabled=false;if(plusActive()){toast('Caddy Coach Plus is on. Enjoy.');profHide()}else toast('Not through yet. Give it a minute and check again.')}});

// ---------- coaching: golfers share scored swings with their coach; coaches send notes back ----------
const COACH={me:null,mine:null,pupils:[],coachOf:null,swings:[],notes:{},sel:null,pupil:null,err:'',busy:false,at:0};
async function coachLoad(force){if(!v2Authed()||!v2Me())return;if(!force&&Date.now()-COACH.at<60e3)return;const u=v2Me();
 try{const [cp,links]=await Promise.all([sbGet('coach_profiles',`username=eq.${encodeURIComponent(u)}&select=username,code`),sbGet('coach_links','select=coach,student,created_at')]);
  COACH.me=cp&&cp[0]||null;COACH.pupils=(links||[]).filter(l=>l.coach===u);const my=(links||[]).find(l=>l.student===u);COACH.coachOf=my?my.coach:null;COACH.at=Date.now()}catch(_){}}
const coachCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
async function shrinkData(src,w){return new Promise(res=>{const im=new Image();im.onload=()=>{const s=Math.min(1,w/im.width),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);try{res(c.toDataURL('image/jpeg',.72))}catch(_){res(null)}};im.onerror=()=>res(null);im.src=src})}
async function coachPayload(d){const keys=[];for(const k of (d.keys||[]).slice(0,5)){const src=k.img||k.small;if(!src)continue;const s=await shrinkData(src,300);if(s)keys.push({lab:k.lab,t:k.t,img:s,notes:(k.notes||[]).map(n=>n.txt).slice(0,3)})}
 const sc=d.scores||{};return{v:1,at:d.createdAt||Date.now(),overall:sc.overall,areas:Object.fromEntries(Object.entries(sc).filter(([k,v])=>k!=='overall'&&typeof v==='number')),view:d.metrics&&d.metrics.view||null,summary:d.text&&d.text.summary||'',top:d.text&&d.text.top_priority||'',club:d.club||null,keys}}
async function coachSend(d,btn){if(!COACH.coachOf)return;btn.disabled=true;btn.textContent='Sending…';
 try{const sw=await coachPayload(d);if(!await sbPost('shared_swings',[{student:v2Me(),coach:COACH.coachOf,swing:sw}]))throw new Error('x');btn.textContent='Sent to your coach';track('coach')}catch(_){btn.disabled=false;btn.textContent='Couldn\'t send. Tap to try again'}}
const coachBtn=()=>COACH.coachOf?`<button type="button" data-coach-send>Send to my coach</button>`:'';
let HIST_CUR=null;
document.addEventListener('click',e=>{const b=e.target.closest('[data-coach-send]');if(!b)return;const inHist=!!b.closest('#histDetail');
 const d=inHist?HIST_CUR:RES&&RES.R?{createdAt:Date.now(),scores:RES.R.scores,metrics:RES.R.metrics,text:RES.text,keys:RES.keys,club:typeof CLUB_PICK!=='undefined'?CLUB_PICK:null}:null;if(d)coachSend(d,b)});
async function coachSwings(student){const u=v2Me();const q=student?`coach=eq.${encodeURIComponent(u)}&student=eq.${encodeURIComponent(student)}`:`student=eq.${encodeURIComponent(u)}`;
 return await sbGet('shared_swings',`${q}&select=id,student,coach,created_at,overall:swing->overall,top:swing->>top&order=created_at.desc&limit=50`)||[]}
async function coachNotes(ids){if(!ids.length)return [];return await sbGet('swing_notes',`swing_id=in.(${ids.join(',')})&select=id,swing_id,coach,note,drill,created_at&order=created_at.asc`)||[]}
function coachingHTML(){const u=v2Me(),C=COACH;
 return `<div class="pfCard"><button type="button" class="link pfBack" data-pf="to-me">Back</button><h2>Coaching</h2>${pErr('_form')}
 <h3 class="lbH">Your coach</h3>${C.coachOf?`<p style="margin:0">You're linked to <b>@${esc(C.coachOf)}</b>. Use <b>Send to my coach</b> under any swing to share it: they see your scores and key positions (never your video) and can send notes back.</p>
  ${C.myNotes&&C.myNotes.length?`<ul class="coachNotes">${C.myNotes.map(n=>`<li><b>${esc(fmtDate(Date.parse(n.created_at)))}</b><p>${esc(n.note)}</p>${n.drill?`<small>Drill: ${esc(n.drill)}</small>`:''}</li>`).join('')}</ul>`:'<p class="mut">No notes from your coach yet.</p>'}
  <button type="button" class="link" data-coach="unlink">Stop sharing with @${esc(C.coachOf)}</button>`
 :`<p class="mut" style="margin:0 0 8px">Have lessons? Ask your coach for their Caddy Coach code.</p><form class="grpJoin" data-coach-form="link" novalidate><input id="coCode" maxlength="6" placeholder="Coach code" aria-label="Coach code" autocapitalize="characters" autocomplete="off"><button type="submit">Link</button></form>`}
 <h3 class="lbH">If you coach</h3>${C.me?`<p style="margin:0">Your coach code is <span class="grpCode">${esc(C.me.code)}</span>. Pupils enter it in Coaching.</p>
  ${C.pupils.length?`<ul class="goList">${C.pupils.map(p=>`<li><div class="goTop"><b>@${esc(p.student)}</b><button type="button" class="link" data-coach-pupil="${esc(p.student)}">Their swings</button></div></li>`).join('')}</ul>`:'<p class="mut">No pupils linked yet.</p>'}`
 :`<p class="mut" style="margin:0 0 8px">PGA professional or coach? Get a code for your pupils, then see their scored swings and send notes back.</p><button type="button" data-coach="become">Get my coach code</button>`}</div>`}
function pupilHTML(){const C=COACH;return `<div class="pfCard"><button type="button" class="link pfBack" data-pf="to-coaching">Back</button><h2>@${esc(C.pupil)}'s swings</h2>
 ${C.swings.length?`<ul class="goList">${C.swings.map(s=>`<li><div class="goTop"><b>${esc(fmtDate(Date.parse(s.created_at)))}</b><span class="pill g-${grade(s.overall)}">${s.overall}/10</span><button type="button" class="link" data-coach-open="${s.id}">Open</button></div>${s.top?`<p class="mut">${esc(s.top)}</p>`:''}${(C.notes[s.id]||[]).length?`<small class="mut">${C.notes[s.id].length} note${C.notes[s.id].length===1?'':'s'} sent</small>`:''}</li>`).join('')}</ul>`:'<p class="mut">Nothing shared yet.</p>'}</div>`}
function coachSwingHTML(){const C=COACH,s=C.sel,w=s&&s.swing||{},ns=C.notes[s.id]||[];return `<div class="pfCard"><button type="button" class="link pfBack" data-coach-pupil="${esc(s.student)}">Back</button><h2>@${esc(s.student)}, ${esc(fmtDate(Date.parse(s.created_at)))}</h2>
 <p style="margin:0"><span class="pill g-${grade(w.overall)}">${w.overall}/10</span> ${w.view?`<span class="mut">${w.view==='face-on'?'Face-on':'Down the line'}</span>`:''}</p>
 ${w.top?`<p><b>Working on:</b> ${esc(w.top)}</p>`:''}${w.summary?`<p class="mut">${esc(w.summary)}</p>`:''}
 <div class="coachAreas">${Object.entries(w.areas||{}).map(([k,v])=>`<span>${esc(k)} <b>${v}</b></span>`).join('')}</div>
 <div class="keys">${(w.keys||[]).map(k=>`<div class="kp"><img alt="${esc(k.lab)} position" src="${esc(k.img)}"><div class="kb"><b>${esc(k.lab)}</b>${(k.notes||[]).map(t=>`<div>${esc(t)}</div>`).join('')}</div></div>`).join('')}</div>
 <h3 class="lbH">Your notes</h3>${ns.length?`<ul class="coachNotes">${ns.map(n=>`<li><b>${esc(fmtDate(Date.parse(n.created_at)))}</b><p>${esc(n.note)}</p>${n.drill?`<small>Drill: ${esc(n.drill)}</small>`:''}</li>`).join('')}</ul>`:''}
 <form class="goForm" data-coach-form="note" novalidate><div class="pfF"><label for="coNote">Note for @${esc(s.student)}</label><textarea id="coNote" rows="4" maxlength="2000">${esc(PROF.f.coNote||'')}</textarea>${pErr('coNote')}</div>
 <div class="pfF"><label for="coDrill">Drill to practise (optional)</label><input id="coDrill" maxlength="120" value="${esc(PROF.f.coDrill||'')}"></div>
 <button type="submit" class="pri pfBig" ${C.busy?'disabled':''}>${C.busy?'Sending…':'Send note'}</button></form></div>`}
async function coachOpenMine(){await coachLoad(true);COACH.myNotes=[];if(COACH.coachOf){try{const ss=await coachSwings(null);COACH.myNotes=(await coachNotes(ss.map(s=>s.id))).reverse()}catch(_){}}profShow('coaching')}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-coach],[data-coach-pupil],[data-coach-open]');if(!b)return;PROF.err={};
 if(b.dataset.coach==='become'){b.disabled=true;for(let i=0;i<3;i++){const code=coachCode();if(await sbPost('coach_profiles',[{username:v2Me(),code}])){await coachLoad(true);break}}return profRender()}
 if(b.dataset.coach==='unlink'){try{await sbDel('coach_links',`coach=eq.${encodeURIComponent(COACH.coachOf)}&student=eq.${encodeURIComponent(v2Me())}`)}catch(_){}await coachLoad(true);return profRender()}
 if(b.dataset.coachPupil){COACH.pupil=b.dataset.coachPupil;try{COACH.swings=await coachSwings(COACH.pupil);const ns=await coachNotes(COACH.swings.map(s=>s.id));COACH.notes={};ns.forEach(n=>(COACH.notes[n.swing_id]=COACH.notes[n.swing_id]||[]).push(n))}catch(_){COACH.swings=[]}return profShow('pupil')}
 if(b.dataset.coachOpen){try{const r=await sbGet('shared_swings',`id=eq.${b.dataset.coachOpen}&select=*`);COACH.sel=r&&r[0];PROF.f={}}catch(_){}if(COACH.sel)profShow('coachswing')}});
document.addEventListener('submit',async e=>{const f=e.target.closest('[data-coach-form]');if(!f)return;e.preventDefault();PROF.err={};
 if(f.dataset.coachForm==='link'){const code=String($('coCode').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!/^[A-Z0-9]{6}$/.test(code)){PROF.err._form='Coach codes are 6 letters and numbers.';return profRender()}
  let c=null;try{const r=await sbGet('coach_profiles',`code=eq.${code}&select=username`);c=r&&r[0]}catch(_){}
  if(!c){PROF.err._form='No coach has that code. Check it with your coach.';return profRender()}if(c.username===v2Me()){PROF.err._form='That\'s your own code.';return profRender()}
  if(!await sbPost('coach_links',[{coach:c.username,student:v2Me()}])){PROF.err._form='Couldn\'t link just now. Try again.';return profRender()}await coachLoad(true);toast(`Linked to @${c.username}.`);return profRender()}
 if(f.dataset.coachForm==='note'){const note=String($('coNote').value||'').trim(),drill=String($('coDrill').value||'').trim();PROF.f.coNote=note;PROF.f.coDrill=drill;if(!note){PROF.err.coNote='Write a note first.';return profRender()}
  COACH.busy=true;profRender();const ok=await sbPost('swing_notes',[{swing_id:COACH.sel.id,coach:v2Me(),note,drill:drill||null}]);COACH.busy=false;
  if(!ok){PROF.err._form='Couldn\'t send it just now. Try again.';return profRender()}(COACH.notes[COACH.sel.id]=COACH.notes[COACH.sel.id]||[]).push({note,drill,created_at:new Date().toISOString()});PROF.f={};toast('Note sent.');profRender()}});
// coaching news on Home: new notes for pupils, newly shared swings for coaches
async function coachNews(){if(!v2Authed()||!v2Me())return;await coachLoad();const u=v2Me(),seenK='cc_coachseen_'+u,seen=lsGet(seenK,null);
 try{if(COACH.coachOf){const ss=await coachSwings(null);const ns=await coachNotes(ss.map(s=>s.id));const last=ns.length?ns[ns.length-1].created_at:null;
   if(seen&&last&&last>seen)inboxAdd('cn-'+last,`New note from your coach @${COACH.coachOf}`,ns[ns.length-1].note.slice(0,120),'coach');if(last)lsSet(seenK,last)}
  if(COACH.me&&COACH.pupils.length){const r=await sbGet('shared_swings',`coach=eq.${encodeURIComponent(u)}&select=student,created_at&order=created_at.desc&limit=20`)||[];const k2='cc_coachsw_'+u,s2=lsGet(k2,null);
   const fresh=r.filter(x=>s2&&x.created_at>s2);if(fresh.length)inboxAdd('cs-'+r[0].created_at,`${fresh.length} new swing${fresh.length===1?'':'s'} from your pupils`,`From ${[...new Set(fresh.map(x=>'@'+x.student))].join(', ')}.`,'coach');if(r[0])lsSet(k2,r[0].created_at)}}catch(_){}}

// ---------- the app owner's numbers, and appointing club admins ----------
const OWN={is:null,sum:null,admins:[],err:''};
async function ownerCheck(){if(!v2Authed())return false;if(OWN.is!=null)return OWN.is;try{OWN.is=!!await sbRpcJ('is_app_owner')}catch(_){OWN.is=false}return OWN.is}
async function ownerOpen(){OWN.err='';try{OWN.sum=await sbRpcJ('cc_usage_summary');OWN.admins=await sbGet('club_admins','select=club_key,username&order=club_key')||[]}catch(e){OWN.err='Couldn\'t load the numbers just now.'}profShow('stats')}
function statsHTML(){const s=OWN.sum||{},k=s.kinds||{},W=s.weeks||[],ret=s.cohort?Math.round(100*(s.cohort_back||0)/s.cohort):null;
 const bar=W.length?`<div class="stBars">${W.map(w=>`<div title="Week of ${esc(w.wk)}: ${w.golfers}"><i style="height:${Math.max(4,Math.round(60*w.golfers/Math.max(...W.map(x=>x.golfers))))}px"></i><small>${w.golfers}</small></div>`).join('')}</div>`:'<p class="mut">No activity recorded yet.</p>';
 return `<div class="pfCard"><button type="button" class="link pfBack" data-pf="to-me">Back</button><h2>App usage</h2>${OWN.err?`<p class="rtMsg bad">${esc(OWN.err)}</p>`:''}
 <div class="rtNetRow"><div><b>${s.golfers_7d??'–'}</b><span>Golfers this week</span></div><div><b>${s.golfers_total??'–'}</b><span>Golfers ever</span></div><div><b>${ret==null?'–':ret+'%'}</b><span>Came back after 4 weeks${s.cohort?` (${s.cohort_back} of ${s.cohort})`:''}</span></div></div>
 <h3 class="lbH">Golfers each week</h3>${bar}
 <h3 class="lbH">Last 30 days</h3><p style="margin:0">${[['round','rounds'],['swing','swings analysed'],['trace','shots traced'],['pin','pins marked'],['practice','practice sessions'],['coach','swings sent to coaches']].map(([a,l])=>`<b>${k[a]||0}</b> ${l}`).join(' · ')}</p>
 <p class="mut" style="font-size:12.5px">${s.profiles??'–'} profiles, ${s.with_password??'–'} with their own password. Counts are anonymous: each golfer is a one-way code, not their name.</p>
 <h3 class="lbH">Club admins</h3>${OWN.admins.length?`<ul class="goList">${OWN.admins.map(a=>`<li><div class="goTop"><b>@${esc(a.username)}</b><small>${esc(a.club_key)}</small><button type="button" class="link" data-own-rm="${esc(a.club_key)}|${esc(a.username)}">Remove</button></div></li>`).join('')}</ul>`:'<p class="mut">None yet.</p>'}
 <form class="grpJoin" data-own-form novalidate><input id="ownU" placeholder="Username" aria-label="Username of the new club admin" autocapitalize="none" autocomplete="off"><button type="submit">Make club admin</button></form>
 <p class="pfHint">They become admin of the local course in their profile.</p>
 <h3 class="lbH">Error reports</h3><p class="mut" style="margin:0 0 8px">Problems on golfers' phones are reported to Sentry automatically (no names or locations).</p><button type="button" data-own-err>Send a test error report</button></div>`}
document.addEventListener('submit',async e=>{if(!e.target.matches('[data-own-form]'))return;e.preventDefault();const u=unorm($('ownU').value);OWN.err='';
 let p=null;try{p=await PDir.get(u)}catch(_){}if(!p){OWN.err=`There's no profile called @${u}.`;return profRender()}if(!p.course){OWN.err=`@${u} hasn't chosen a local course yet.`;return profRender()}
 try{await sbRpcJ('cc_set_club_admin',{k:keyBase(p.course.key),u,make:true});toast(`@${u} now runs ${p.course.name} in Caddy Coach.`)}catch(_){OWN.err='That didn\'t work. Try again.'}await ownerOpen()});
document.addEventListener('click',e=>{if(!e.target.closest('[data-own-err]'))return;window.ccReportError(new Error('Test report from the app owner ('+new Date().toLocaleString('en-GB')+')'),'manual');toast('Test report sent. It appears in Sentry within a minute.')});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-own-rm]');if(!b)return;const [k,u]=b.dataset.ownRm.split('|');try{await sbRpcJ('cc_set_club_admin',{k,u,make:false})}catch(_){}await ownerOpen()});

// ---------- the extra profile screens ----------
function v2Render(b,m){if(m==='plus'){b.innerHTML=plusHTML();return true}if(m==='coaching'){b.innerHTML=coachingHTML();return true}if(m==='pupil'){b.innerHTML=pupilHTML();return true}
 if(m==='coachswing'){b.innerHTML=coachSwingHTML();return true}if(m==='stats'){b.innerHTML=statsHTML();return true}return false}
function v2MeLinks(){const L=[];if(v2Authed())L.push('<button type="button" class="link" data-pf="to-coaching">Coaching</button>');
 if(PLUS.on)L.push(`<button type="button" class="link" data-pf="to-plus">${plusActive()?'Caddy Coach Plus: on':'Get Caddy Coach Plus'}</button>`);
 if(OWN.is)L.push('<button type="button" class="link" data-pf="to-stats">App usage and club admins</button>');return L.join('')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-pf="to-coaching"],[data-pf="to-plus"],[data-pf="to-stats"]');if(!b)return;e.stopImmediatePropagation();PROF.err={};PROF.f={};
 const a=b.dataset.pf;if(a==='to-coaching')return coachOpenMine();if(a==='to-stats')return ownerOpen();if(a==='to-plus'){PROF.plusWhy=null;PROF.plusFromMe=true;if(PLUS.portal&&plusActive()){window.open(PLUS.portal,'_blank','noopener');return}return profShow('plus')}},true);
// once logged in: today's usage, Plus status, coaching links, owner check
function v2AfterLogin(){track('open');entLoad();coachLoad().then(()=>{if(PROF.mode==='me')profRender()});ownerCheck().then(()=>{if(PROF.mode==='me')profRender()})}

profBoot();
