// Caddy Coach: create a golfer's login (username + strong password) without any email step.
// Logins use made-up addresses like owen_s@users.caddycoach.app, so Supabase must never try to email them.
// This function creates the login already confirmed, after checking the same password rules as the app.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const UN_RE = /^[a-z0-9._]{3,20}$/;
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { code: 'method', msg: 'Use POST' });
  let body: { username?: string; password?: string };
  try { body = await req.json(); } catch { return json(400, { code: 'bad_request', msg: 'Bad request' }); }
  const username = String(body.username || '').trim().toLowerCase(), password = String(body.password || '');
  if (!UN_RE.test(username)) return json(400, { code: 'bad_username', msg: 'Usernames are 3 to 20 letters, numbers, dots or underscores.' });
  if (!strong(password, username)) return json(422, { code: 'weak_password', msg: 'That password is not strong enough.' });

  const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  // a username that already belongs to a login can't be taken again
  const pr = await fetch(`${url}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=auth_id`, { headers: admin });
  if (pr.ok) { const rows = await pr.json(); if (rows.length && rows[0].auth_id) return json(422, { code: 'user_already_exists', msg: 'User already registered' }); }

  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST', headers: admin,
    body: JSON.stringify({ email: `${username}@users.caddycoach.app`, password, email_confirm: true, user_metadata: { username } }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.ok) return json(200, { ok: true, id: j.id });
  const msg = String(j.msg || j.message || j.error_description || j.error || ''), code = String(j.error_code || j.code || '');
  if (r.status === 422 || /already|registered|exists/i.test(msg + code)) return json(422, { code: 'user_already_exists', msg: 'User already registered' });
  return json(r.status >= 400 && r.status < 600 ? r.status : 500, { code: code || 'server', msg: msg || 'Could not create the login' });
});
