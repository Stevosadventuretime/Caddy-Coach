// Caddy Coach accounts: sign up, log in with your username, add or change your email, and reset a forgotten password.
// Golfers log in with their username; the email address behind each login is only used for password resets and is
// never shown to other golfers (it lives in Supabase Auth, not in the public profiles table).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const UN_RE = /^[a-z0-9._]{3,20}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const PLACEHOLDER = '@users.caddycoach.app';
const COMMON = ['password','passw0rd','qwerty','qwertyuiop','letmein','welcome','iloveyou','admin','abc123','monkey','dragon','football','baseball','sunshine','princess','master','shadow','trustno1','superman','starwars','liverpool','arsenal','chelsea','manchester','golf','golfer','golfing','caddy','caddycoach','birdie','eagle','tiger','fairway','password1','changeme','secret','summer','winter','autumn','spring','london','england','hello','freedom','whatever','qazwsx','zaq1','asdfgh','zxcvbn','1q2w3e','123qwe'];

function strong(pw: string, user: string): boolean {
  const low = pw.toLowerCase(), u = user.toLowerCase();
  const digits = (pw.match(/[0-9]/g) || []).length, special = /[^A-Za-z0-9]/.test(pw), upper = /[A-Z]/.test(pw), lower = /[a-z]/.test(pw);
  const bare = low.replace(/[^a-z]/g, '');
  const common = COMMON.some(w => bare === w || (w.length >= 6 && bare.includes(w))) || /^(.)\1+$/.test(pw);
  let seq = false;
  for (let i = 0; i + 3 < low.length; i++) {
    const a = low.charCodeAt(i), b = low.charCodeAt(i + 1), c = low.charCodeAt(i + 2), d = low.charCodeAt(i + 3);
    if ((b - a === 1 && c - b === 1 && d - c === 1) || (a - b === 1 && b - c === 1 && c - d === 1)) { seq = true; break; }
  }
  const pattern = /(.)\1\1/.test(pw) || seq, hasUser = u.length >= 3 && low.includes(u);
  const pool = (lower ? 26 : 0) + (upper ? 26 : 0) + (digits ? 10 : 0) + (special ? 33 : 0);
  const bits = pw.length * Math.log2(Math.max(pool, 1)) - (common ? 30 : 0) - (pattern ? 12 : 0) - (hasUser ? 20 : 0);
  return pw.length >= 10 && pw.length <= 72 && upper && lower && digits >= 2 && special && !hasUser && !common && !pattern && bits >= 55;
}

const URL_ = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function profileOf(username: string): Promise<{ auth_id: string | null } | null> {
  const r = await fetch(`${URL_}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=auth_id`, { headers: ADMIN });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}
// the email behind a username, or the username's login if an email was typed (via a private database function)
async function emailFor(who: string): Promise<string | null> {
  const r = await fetch(`${URL_}/rest/v1/rpc/cc_login_email`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ who }) });
  if (!r.ok) return null;
  const e = await r.json();
  return typeof e === 'string' && e ? e : null;
}
async function adminError(r: Response) {
  const j = await r.json().catch(() => ({}));
  return { status: r.status, msg: String(j.msg || j.message || j.error_description || j.error || ''), code: String(j.error_code || j.code || '') };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { code: 'method', msg: 'Use POST' });
  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json(400, { code: 'bad_request', msg: 'Bad request' }); }
  const action = String(b.action || '');

  // ---- sign up (new golfer, or a 1234-era profile choosing its own password) ----
  if (action === 'signup') {
    const username = String(b.username || '').trim().toLowerCase(), password = String(b.password || ''), email = String(b.email || '').trim().toLowerCase();
    if (!UN_RE.test(username)) return json(400, { code: 'bad_username', msg: 'Usernames are 3 to 20 letters, numbers, dots or underscores.' });
    if (!EMAIL_RE.test(email) || email.endsWith(PLACEHOLDER)) return json(400, { code: 'bad_email', msg: 'Enter a real email address.' });
    if (!strong(password, username)) return json(422, { code: 'weak_password', msg: 'That password is not strong enough.' });
    const p = await profileOf(username);
    if (p && p.auth_id) return json(422, { code: 'user_already_exists', msg: 'User already registered' });
    // a login for this username from an earlier try whose last step didn't finish: the app logs in with it instead
    if (await emailFor(username)) return json(422, { code: 'user_already_exists', msg: 'User already registered' });
    const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: ADMIN,
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username } }) });
    if (r.ok) { const j = await r.json(); return json(200, { ok: true, id: j.id }); }
    const e = await adminError(r);
    if (/email/i.test(e.msg + e.code) && /exist|registered|already/i.test(e.msg + e.code)) return json(422, { code: 'email_exists', msg: 'That email is already used by another Caddy Coach account.' });
    if (/email_address_invalid|invalid/i.test(e.msg + e.code)) return json(400, { code: 'bad_email', msg: 'That email address was refused. Check it and try again.' });
    return json(e.status >= 400 && e.status < 600 ? e.status : 500, { code: e.code || 'server', msg: e.msg || 'Could not create the login' });
  }

  // ---- log in with username and password ----
  if (action === 'login') {
    const username = String(b.username || '').trim().toLowerCase(), password = String(b.password || '');
    if (!UN_RE.test(username)) return json(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' });
    // the login behind this username; logins made before emails were collected use the placeholder address
    const email = (await emailFor(username)) || `${username}${PLACEHOLDER}`;
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json(r.status === 429 ? 429 : 400, { code: j.error_code || 'invalid_credentials', msg: j.error_description || j.msg || 'Invalid login credentials' });
    return json(200, j);
  }

  // ---- add or change your email (you must be logged in) ----
  if (action === 'set_email') {
    const email = String(b.email || '').trim().toLowerCase(), tok = String(b.token || '');
    if (!EMAIL_RE.test(email) || email.endsWith(PLACEHOLDER)) return json(400, { code: 'bad_email', msg: 'Enter a real email address.' });
    const me = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${tok}` } });
    if (!me.ok) return json(401, { code: 'not_logged_in', msg: 'Log in again first.' });
    const u = await me.json();
    const r = await fetch(`${URL_}/auth/v1/admin/users/${u.id}`, { method: 'PUT', headers: ADMIN, body: JSON.stringify({ email, email_confirm: true }) });
    if (r.ok) return json(200, { ok: true, email });
    const e = await adminError(r);
    if (/exist|registered|already/i.test(e.msg + e.code)) return json(422, { code: 'email_exists', msg: 'That email is already used by another Caddy Coach account.' });
    return json(e.status >= 400 && e.status < 600 ? e.status : 500, { code: e.code || 'server', msg: e.msg || 'Could not save the email' });
  }

  // ---- forgotten password: email a reset link. Always answers the same way, so nobody can find out who has an account ----
  if (action === 'reset') {
    const who = String(b.who || '').trim().toLowerCase(), redirect = String(b.redirect || '');
    const email = who ? await emailFor(who) : null;
    if (email && !email.endsWith(PLACEHOLDER)) {
      const qs = /^https:\/\//.test(redirect) ? `?redirect_to=${encodeURIComponent(redirect)}` : '';
      const r = await fetch(`${URL_}/auth/v1/recover${qs}`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ email }) });
      if (!r.ok) { const e = await adminError(r); console.error('recover failed', e.status, e.code, e.msg); if (r.status === 429) return json(429, { code: 'rate', msg: 'Too many reset emails. Try again in an hour.' });
        return json(503, { code: 'email_unavailable', msg: 'Password reset emails aren\'t working right now.' }); }
    }
    return json(200, { ok: true });
  }

  return json(400, { code: 'bad_action', msg: 'Unknown action' });
});
