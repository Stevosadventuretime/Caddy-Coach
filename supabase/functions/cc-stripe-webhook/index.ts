// Caddy Coach Plus: Stripe tells this function when someone subscribes, renews or cancels, and it records it in the
// entitlements table. It does nothing until a STRIPE_WEBHOOK_SECRET secret is set (from the Stripe dashboard's webhook page).
// Events to send: checkout.session.completed, customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted. Payment links must pass client_reference_id (the app adds it).
const URL_ = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const ADMIN = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const ok = (msg = 'ok', status = 200) => new Response(msg, { status });

async function hmacHex(secret: string, payload: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}
function safeEq(a: string, b: string) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
async function verified(req: Request, body: string) {
  const h = req.headers.get('stripe-signature') || '';
  const parts = Object.fromEntries(h.split(',').map(p => p.split('=') as [string, string]).filter(p => p.length === 2));
  const t = Number(parts.t); if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = await hmacHex(SECRET, `${t}.${body}`);
  return h.split(',').some(p => p.startsWith('v1=') && safeEq(p.slice(3), want));
}
async function upsert(row: Record<string, unknown>) {
  const r = await fetch(`${URL_}/rest/v1/entitlements?on_conflict=auth_id`, { method: 'POST', headers: { ...ADMIN, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([row]) });
  if (!r.ok) console.error('upsert', r.status, await r.text());
}
async function patchByCustomer(customer: string, row: Record<string, unknown>) {
  const r = await fetch(`${URL_}/rest/v1/entitlements?stripe_customer=eq.${encodeURIComponent(customer)}`, { method: 'PATCH', headers: { ...ADMIN, Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  if (!r.ok) console.error('patch', r.status, await r.text());
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return ok('Use POST', 405);
  if (!SECRET) return ok('Payments are not set up yet', 503);
  const body = await req.text();
  if (!await verified(req, body)) return ok('Bad signature', 400);
  let ev: { type: string; data: { object: Record<string, any> } };
  try { ev = JSON.parse(body); } catch { return ok('Bad JSON', 400); }
  const o = ev.data?.object || {}, now = new Date().toISOString();

  if (ev.type === 'checkout.session.completed') {
    const uid = o.client_reference_id;
    if (uid && /^[0-9a-f-]{36}$/.test(uid)) await upsert({ auth_id: uid, stripe_customer: o.customer || null, stripe_subscription: o.subscription || null, status: 'active', updated_at: now });
    return ok();
  }
  if (ev.type.startsWith('customer.subscription.')) {
    const item = o.items?.data?.[0] || {};
    const end = o.current_period_end || item.current_period_end;
    const row: Record<string, unknown> = { stripe_subscription: o.id, status: ev.type === 'customer.subscription.deleted' ? 'canceled' : o.status,
      current_period_end: end ? new Date(end * 1000).toISOString() : null, plan: item.price?.recurring?.interval || null, updated_at: now };
    if (o.customer) await patchByCustomer(o.customer, row);
    return ok();
  }
  return ok('ignored');
});
