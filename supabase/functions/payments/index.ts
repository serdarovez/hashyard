// Payment scanner.
//
// Runs every minute (see the cron migration) and whenever a customer pastes a
// transaction ID. It reads your wallet's incoming USDT from TronGrid, matches
// transfers to open orders, and confirms them in the database.
//
// Safe to call as often as you like: it throttles itself to one scan per 10
// seconds, and confirming an order twice does nothing.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fromMicro, matchTransfers, parseTransfers, USDT_TRC20 } from '../_shared/payments.js';

const TRONGRID = 'https://api.trongrid.io';
const WINDOW_DAYS = 7;          // late payments on expired orders are honoured this long
const MIN_GAP_MS = 10_000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  });

  try {
    const { data: s, error: se } = await db.from('settings').select('receive_address, last_scan_at').single();
    if (se) throw se;
    if (!s.receive_address) return reply({ skipped: 'no receiving wallet set in admin settings' });
    if (s.last_scan_at && Date.now() - Date.parse(s.last_scan_at) < MIN_GAP_MS) {
      return reply({ skipped: 'scanned in the last 10 seconds' });
    }
    await db.from('settings').update({ last_scan_at: new Date().toISOString() }).eq('id', 1);

    const { data: expired } = await db.rpc('expire_orders');

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const { data: orders, error: oe } = await db
      .from('orders')
      .select('id, price, pay_amount, created_at, claimed_txid')
      .in('status', ['awaiting_payment', 'expired'])
      .gte('created_at', since);
    if (oe) throw oe;
    if (!orders.length) return reply({ expired, open: 0 });

    const oldest = Math.min(...orders.map((o) => Date.parse(o.created_at))) - 5 * 60_000;
    const transfers = await incomingTransfers(s.receive_address, oldest);

    const { data: used } = transfers.length
      ? await db.from('orders').select('tx_hash').in('tx_hash', transfers.map((t) => t.txid))
      : { data: [] };
    const { matches, skipped } = matchTransfers(transfers, orders, new Set((used ?? []).map((u) => u.tx_hash)));

    const confirmed = [];
    for (const m of matches) {
      const { data, error } = await db.rpc('confirm_order_payment', {
        p_order_id: m.orderId,
        p_txid: m.txid,
        p_amount: fromMicro(m.amount),
        p_from: m.from,
        p_paid_at: new Date(m.ts).toISOString()
      });
      confirmed.push({ order: m.orderId, how: m.how, status: error ? `error: ${error.message}` : data.status });
    }

    return reply({ expired, open: orders.length, transfers: transfers.length, confirmed, skipped });
  } catch (e) {
    console.error(e);
    return reply({ error: String((e as Error).message ?? e) }, 500);
  }
});

/** Confirmed incoming USDT to `address` since `minTs`, following TronGrid's paging. */
async function incomingTransfers(address: string, minTs: number) {
  const key = Deno.env.get('TRONGRID_API_KEY');
  const headers: Record<string, string> = key ? { 'TRON-PRO-API-KEY': key } : {};
  let url: string | null =
    `${TRONGRID}/v1/accounts/${address}/transactions/trc20` +
    `?only_confirmed=true&only_to=true&limit=200&contract_address=${USDT_TRC20}&min_timestamp=${minTs}`;

  const out = [];
  for (let page = 0; url && page < 10; page++) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`TronGrid returned ${r.status}`);
    const json = await r.json();
    out.push(...parseTransfers(json, address));
    url = json.meta?.links?.next ?? null;
  }
  return out;
}
