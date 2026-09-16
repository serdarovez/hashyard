// Daily update email, sent once per customer per published day.
//
// Triggered by cron at 09:00 UTC. It only sends for a day you have published
// in the admin panel, so customers never get an email with figures you have
// not checked. Running it twice sends nothing new (see email_log).
import { createClient } from 'npm:@supabase/supabase-js@2';

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  // not a public endpoint: only the scheduled job knows this secret
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return reply({ error: 'forbidden' }, 403);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  });
  const RESEND = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('EMAIL_FROM') ?? 'Hashyard <updates@example.com>';
  const SITE = Deno.env.get('SITE_URL') ?? '';
  if (!RESEND) return reply({ error: 'RESEND_API_KEY is not set' }, 500);

  const day = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); // yesterday, UTC
  const { data: published } = await db.from('published_days').select('day').eq('day', day).maybeSingle();
  if (!published) return reply({ skipped: `${day} has not been published yet` });

  const [{ data: holders }, { data: done }] = await Promise.all([
    db.from('holdings').select('user_id').eq('active', true),
    db.from('email_log').select('user_id').eq('day', day)
  ]);
  const already = new Set((done ?? []).map((d) => d.user_id));
  const ids = [...new Set((holders ?? []).map((h) => h.user_id))].filter((id) => !already.has(id));
  if (!ids.length) return reply({ day, sent: 0 });

  const [{ data: people }, { data: rows }] = await Promise.all([
    db.from('profiles').select('id, email, full_name').in('id', ids).eq('email_updates', true),
    db.from('ledger').select('user_id, amount').eq('day', day).in('user_id', ids)
  ]);

  const esc = (v: string) =>
    v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const pretty = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  let sent = 0;
  const failed: unknown[] = [];

  for (const p of people ?? []) {
    const earned = (rows ?? []).filter((r) => r.user_id === p.id).reduce((a, r) => a + Number(r.amount), 0);
    const { data: balance } = await db.rpc('balance_of', { p_user: p.id });
    const name = (p.full_name ?? '').split(' ')[0] || 'there';
    const e = earned.toFixed(2);
    const b = Number(balance ?? 0).toFixed(2);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: p.email,
        subject: `Your machines earned ${e} USDT on ${pretty}`,
        text:
          `Hi ${name},\n\nOn ${pretty} your machines earned ${e} USDT.\n` +
          `Your balance is now ${b} USDT.\n\n${SITE ? `See the details: ${SITE}/#/dashboard\n\n` : ''}` +
          `You can turn these emails off in your wallet settings.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#16181a">
            <p>Hi ${esc(name)},</p>
            <p>On <b>${pretty}</b> your machines earned</p>
            <p style="font-size:32px;margin:8px 0;color:#b4560b"><b>${e} USDT</b></p>
            <p>Your balance is now <b>${b} USDT</b>.</p>
            ${SITE ? `<p><a href="${SITE}/#/dashboard" style="color:#b4560b">See the details</a></p>` : ''}
            <p style="color:#868c93;font-size:12px">You can turn these emails off in your wallet settings.</p>
          </div>`
      })
    });

    if (res.ok) {
      await db.from('email_log').insert({ user_id: p.id, day });
      sent++;
    } else {
      failed.push({ user: p.id, status: res.status, body: await res.text() });
    }
  }

  return reply({ day, sent, failed });
});
