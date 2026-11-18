// Caddy Coach AI swing coach: turns the app's own swing measurements into personal coaching, and answers follow-up
// questions about that swing. The video never leaves the phone: the app sends only the numbers it measured, the faults
// it found, the drills it has, and short notes from the golfer's earlier swings (so the coaching remembers them).
// The prompt is built here from those fields only, so this can't be used as a general chatbot on our bill.
//
// Needs the ANTHROPIC_API_KEY secret (Supabase dashboard > Edge Functions > Secrets). Without it the function answers
// 503 and the app keeps its built-in coaching. COACH_MODEL can override the model (default: Claude Haiku 5.5, about
// a tenth of a penny per analysis).
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cc-user',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const URL_ = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const MODEL = Deno.env.get('COACH_MODEL') || 'claude-haiku-5-5';

// free allowance per day. Signed-in golfers get more than guests; everyone shares a ceiling so a bad day can't cost much.
const LIMITS = { user: { analysis: 6, chat: 20 }, guest: { analysis: 2, chat: 5 }, allDay: 3000 };

// ---------- who is asking ----------
async function whoIs(req: Request): Promise<{ who: string; user: boolean }> {
  const tok = (req.headers.get('x-cc-user') || '').trim();
  if (tok && tok.length < 4000) {
    try {
      const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${tok}` } });
      if (r.ok) { const u = await r.json(); if (u && u.id) return { who: 'u:' + u.id, user: true }; }
    } catch (_) { /* fall through to guest */ }
  }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cc-coach|' + ip));
  return { who: 'g:' + Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('').slice(0, 32), user: false };
}

// ---------- daily allowance ----------
const today = () => new Date().toISOString().slice(0, 10);
async function used(who: string, kind: string): Promise<number> {
  const r = await fetch(`${URL_}/rest/v1/coach_usage?select=n&who=eq.${encodeURIComponent(who)}&day=eq.${today()}&kind=eq.${kind}`, { headers: ADMIN });
  if (!r.ok) return 0; const rows = await r.json(); return rows[0] ? rows[0].n : 0;
}
async function usedAll(): Promise<number> {
  const r = await fetch(`${URL_}/rest/v1/coach_usage?select=n&day=eq.${today()}`, { headers: ADMIN });
  if (!r.ok) return 0; const rows = await r.json(); return rows.reduce((a: number, x: { n: number }) => a + (x.n || 0), 0);
}
async function count(who: string, kind: string, n: number) {
  await fetch(`${URL_}/rest/v1/coach_usage?on_conflict=who,day,kind`, {
    method: 'POST', headers: { ...ADMIN, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ who, day: today(), kind, n: n + 1 }),
  });
}

// ---------- tidy what the phone sent ----------
const str = (x: unknown, max = 200) => typeof x === 'string' ? x.slice(0, max) : '';
const num = (x: unknown) => typeof x === 'number' && isFinite(x) ? Math.round(x * 100) / 100 : null;
function clean(b: any) {
  const view = b.view === 'down-the-line' ? 'down-the-line' : 'face-on';
  const checks = (Array.isArray(b.checks) ? b.checks : []).slice(0, 60).map((c: any) => ({
    id: str(c.id, 30), check: str(c.check, 90), plain: str(c.plain, 90), state: str(c.state, 90), phase: str(c.phase, 20),
    you: str(c.you, 60), tour: str(c.tour, 140), score: num(c.score), verdict: str(c.verdict, 12),
    measured: c.basis === 'estimated' ? 'estimate' : 'measured',
  }));
  const faults = (Array.isArray(b.faults) ? b.faults : []).slice(0, 8).map((f: any) => ({ id: str(f.id, 30), title: str(f.title, 120), why_miss: str(f.why_miss, 300) }));
  const drills = (Array.isArray(b.drills) ? b.drills : []).slice(0, 30).map((d: any) => ({ id: str(d.id, 30), name: str(d.name, 80), fixes: str(d.fixes, 30) }));
  const history = (Array.isArray(b.history) ? b.history : []).slice(0, 6).map((h: any) => ({ date: str(h.date, 10), view: str(h.view, 15), overall: num(h.overall), fixing: str(h.fixing, 200) }));
  const recurring = (Array.isArray(b.recurring) ? b.recurring : []).slice(0, 5).map((x: unknown) => str(x, 90));
  return {
    view, handed: b.handed === 'left' ? 'left' : 'right', club: str(b.club, 20), miss: str(b.miss, 60),
    overall: num(b.overall), checks, faults, drills, history, recurring,
    areas: (Array.isArray(b.areas) ? b.areas : []).slice(0, 10).map((a: unknown) => str(a, 50)),
  };
}

// ---------- the coach ----------
const SYSTEM = `You are Caddy Coach, a straight-talking UK golf coach. You coach average weekend club golfers, so you use plain everyday words, explain any golf term in a few words, and never pile on corrections: the golfer should leave knowing the one or two things that matter most.

You coach from a phone app's measurements of ONE video filmed from ONE camera angle. Rules you never break:
- Use only the measurements given. Never invent a number, a position, the clubface, the grip, the ball flight or anything the camera can't see.
- One camera sees a flat picture. Readings marked "estimate" (turns, planes, the club) are worked out, not seen: say "about" or "looks like" for those. Don't claim 3D detail.
- Don't hold a tour player up as the right shape for this golfer's body. Tour ranges are a guide, not a rule.
- Say plainly when something is a fault and what it usually does to the ball, without flattery and without being harsh.
- Drills: only use drill ids from the list given, and only for the fault they fix.
- If earlier swings are given, say whether the main fault is improving, the same, or new, using only those notes.`;

const ANALYSIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'strengths', 'top_priority', 'progress_note', 'fixes', 'categories'],
  properties: {
    summary: { type: 'string', description: 'Two short plain sentences: the honest overall verdict.' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short items, only checks that are spot on.' },
    top_priority: { type: 'string', description: 'One plain sentence: the first thing to fix and the feel that fixes it.' },
    progress_note: { type: 'string', description: 'One sentence comparing with earlier swings, or empty if none were given.' },
    fixes: {
      type: 'array', description: 'The most important fixes in order, at most 3. Fewer if fewer matter.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['check_id', 'title', 'what_you_do', 'cause', 'ball_effect', 'drill_ids', 'routine'],
        properties: {
          check_id: { type: 'string' }, title: { type: 'string' },
          what_you_do: { type: 'string', description: 'What the golfer is doing, in plain words.' },
          cause: { type: 'string', description: 'The most likely reason it happens.' },
          ball_effect: { type: 'string', description: 'What it usually does to the strike or ball flight.' },
          drill_ids: { type: 'array', items: { type: 'string' } },
          routine: { type: 'string', description: 'A 30-minute practice routine, e.g. 10 min drill, 10 min half swings, 10 min full swings.' },
        },
      },
    },
    categories: {
      type: 'array', description: 'One entry per area name given.',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'finding', 'fix'],
        properties: { name: { type: 'string' }, finding: { type: 'string' }, fix: { type: 'string' } },
      },
    },
  },
};
const CHAT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['answer'],
  properties: { answer: { type: 'string', description: 'A plain, friendly answer of at most about 120 words.' } },
};

async function ask(prompt: string, schema: object, maxTokens: number) {
  const client = new Anthropic({ apiKey: API_KEY });
  const msg = await client.messages.create({
    model: MODEL, max_tokens: maxTokens, system: SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }],
  } as any);
  if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') return null;
  const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  try { return JSON.parse(text); } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!API_KEY) return json(503, { error: 'coach_off' });
  const raw = await req.text();
  if (raw.length > 80000) return json(413, { error: 'too_big' });
  let b: any; try { b = JSON.parse(raw); } catch (_) { return json(400, { error: 'bad_json' }); }
  const mode = b.mode === 'chat' ? 'chat' : 'analysis';
  const s = clean(b.swing || {});
  if (!s.checks.length) return json(400, { error: 'no_checks' });

  const { who, user } = await whoIs(req);
  const lim = (user ? LIMITS.user : LIMITS.guest)[mode];
  const n = await used(who, mode);
  if (n >= lim) return json(429, { error: 'limit', limit: lim, signed_in: user });
  if (await usedAll() >= LIMITS.allDay) return json(429, { error: 'busy' });

  const facts = `The golfer: ${s.handed}-handed, filmed ${s.view}${s.club ? `, club: ${s.club}` : ''}${s.miss ? `, usual miss: ${s.miss}` : ''}. App's overall swing score: ${s.overall ?? 'n/a'}/10 (a guide from this app's checks, not a lab measurement).
Checks (score 0-10 against tour players filmed the same way; verdict tour/ok/borderline/fault/major/info): ${JSON.stringify(s.checks)}
Faults the app found, most important first: ${JSON.stringify(s.faults)}
Drills the app has: ${JSON.stringify(s.drills)}
Earlier swings (newest first): ${s.history.length ? JSON.stringify(s.history) : 'none'}
Faults that keep coming back: ${s.recurring.length ? JSON.stringify(s.recurring) : 'none recorded'}`;

  let out: unknown = null;
  try {
    if (mode === 'analysis') {
      out = await ask(`${facts}
Area names for "categories" (use exactly these, in this order): ${JSON.stringify(s.areas)}
Write this golfer's coaching. Start the fixes with the app's first fault unless the numbers clearly say otherwise. At most 3 fixes.`, ANALYSIS_SCHEMA, 6000);
    } else {
      const q = str(b.question, 400).trim();
      if (!q) return json(400, { error: 'no_question' });
      const said = (Array.isArray(b.thread) ? b.thread : []).slice(-6).map((t: any) => `${t.who === 'coach' ? 'Coach' : 'Golfer'}: ${str(t.text, 600)}`).join('\n');
      out = await ask(`${facts}
${said ? `Conversation so far:\n${said}\n` : ''}The golfer asks: ${JSON.stringify(q)}
Answer about this swing and golf practice only. If the question is about something else, say you can only help with their golf.`, CHAT_SCHEMA, 2000);
    }
  } catch (e) {
    console.error('coach', e instanceof Error ? e.message : e);
    return json(502, { error: 'coach_failed' });
  }
  if (!out) return json(502, { error: 'coach_failed' });
  await count(who, mode, n);
  return json(200, { ok: true, mode, coach: out, left: Math.max(0, lim - n - 1) });
});
