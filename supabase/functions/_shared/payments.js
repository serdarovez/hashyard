/**
 * Matching incoming USDT (TRC-20) transfers to orders.
 *
 * No imports on purpose: this exact file runs inside the Supabase edge
 * function (Deno) and in the Node test suite, so what is tested is what ships.
 *
 * All amounts are handled as BigInt micro-USDT (6 decimals). Floating point
 * is never used for money here: 0.1 + 0.2 must not decide whether an order
 * counts as paid.
 */

/** The real Tether contract on TRON. Anything else calling itself USDT is ignored. */
export const USDT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const DECIMALS = 6;
const UNIT = 1000000n;

/** "250.037" | 250.037 -> 250037000n. Throws on anything that is not a plain decimal. */
export function toMicro(v) {
  const s = typeof v === 'number' ? v.toFixed(DECIMALS) : String(v).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`not an amount: ${v}`);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > DECIMALS && /[1-9]/.test(frac.slice(DECIMALS))) {
    throw new Error(`more than ${DECIMALS} decimals: ${v}`);
  }
  return BigInt(whole) * UNIT + BigInt((frac + '000000').slice(0, DECIMALS));
}

/** 250037000n -> "250.037000" (what Postgres numeric accepts without loss). */
export function fromMicro(m) {
  const neg = m < 0n;
  const a = neg ? -m : m;
  return `${neg ? '-' : ''}${a / UNIT}.${(a % UNIT).toString().padStart(DECIMALS, '0')}`;
}

/**
 * Normalise a TronGrid `/v1/accounts/{address}/transactions/trc20` response
 * into incoming USDT transfers to `receiveAddress`.
 */
export function parseTransfers(json, receiveAddress) {
  if (!json || json.success === false || !Array.isArray(json.data)) {
    throw new Error('unexpected TronGrid response');
  }
  const out = [];
  for (const t of json.data) {
    const token = t.token_info || {};
    if (t.type !== 'Transfer') continue;
    if (t.to !== receiveAddress) continue;
    // a scam token can use the name and symbol "USDT"; only the contract is proof
    if (token.address !== USDT_TRC20) continue;
    if (Number(token.decimals) !== DECIMALS) continue;
    if (!/^\d+$/.test(String(t.value))) continue;
    out.push({
      txid: String(t.transaction_id).toLowerCase(),
      from: t.from,
      amount: BigInt(t.value),
      ts: Number(t.block_timestamp)
    });
  }
  return out;
}

/**
 * Decide which transfer pays which order.
 *
 * @param transfers  from parseTransfers
 * @param orders     orders that can still be paid: { id, price, pay_amount,
 *                   created_at, claimed_txid }
 * @param usedTxids  transaction hashes already attached to some order
 * @returns { matches: [{orderId, txid, amount, from, ts, how}], skipped: [...] }
 *
 * Two ways to match, strongest first:
 *   exact   - the transfer is exactly the order's fingerprinted amount
 *   claimed - the customer pasted this transaction ID into the order
 *             (needed when an exchange rounds the amount they send)
 */
export function matchTransfers(transfers, orders, usedTxids = new Set(), skewMs = 5 * 60 * 1000) {
  const matches = [];
  const skipped = [];
  const orderTaken = new Set();
  const txTaken = new Set([...usedTxids].map((t) => String(t).toLowerCase()));
  const created = new Map(orders.map((o) => [o.id, Date.parse(o.created_at)]));

  const byAmount = new Map();
  for (const o of orders) {
    const k = toMicro(o.pay_amount).toString();
    if (!byAmount.has(k)) byAmount.set(k, []);
    byAmount.get(k).push(o);
  }

  const take = (o, t, how) => {
    orderTaken.add(o.id);
    txTaken.add(t.txid);
    matches.push({ orderId: o.id, txid: t.txid, amount: t.amount, from: t.from, ts: t.ts, how });
  };

  // 1. exact amount, oldest transfer first
  for (const t of [...transfers].sort((a, b) => a.ts - b.ts)) {
    if (txTaken.has(t.txid)) continue;
    const candidates = (byAmount.get(t.amount.toString()) || []).filter(
      (o) => !orderTaken.has(o.id) && t.ts >= created.get(o.id) - skewMs
    );
    if (candidates.length === 1) take(candidates[0], t, 'exact');
    else if (candidates.length > 1) skipped.push({ txid: t.txid, reason: 'ambiguous amount' });
  }

  // 2. the customer told us which transaction is theirs
  for (const o of orders) {
    if (orderTaken.has(o.id) || !o.claimed_txid) continue;
    const t = transfers.find((x) => x.txid === String(o.claimed_txid).toLowerCase());
    if (!t) continue;                                   // not on-chain or not confirmed yet
    if (txTaken.has(t.txid)) {
      skipped.push({ txid: t.txid, orderId: o.id, reason: 'transaction already used' });
      continue;
    }
    if (t.ts < created.get(o.id) - skewMs) {
      skipped.push({ txid: t.txid, orderId: o.id, reason: 'sent before this order existed' });
      continue;
    }
    // never let a claim steal a transfer that exactly matches someone else's order
    const owner = byAmount.get(t.amount.toString()) || [];
    if (owner.some((x) => x.id !== o.id)) {
      skipped.push({ txid: t.txid, orderId: o.id, reason: "amount belongs to another order" });
      continue;
    }
    // an underpayment is still passed on: the database parks it for review
    take(o, t, 'claimed');
  }

  return { matches, skipped };
}
