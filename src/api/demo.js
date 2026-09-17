import { RIGS } from '../data/catalog.js';
import { fromRig, toConfig, toRig, TRON_ADDRESS, TXID } from './mappers.js';
import { grossPerDay } from '../lib/economics.js';
import { DEMO_CUSTOMERS, DEMO_WITHDRAWALS, VIEWER } from '../data/demoCustomers.js';

/**
 * In-browser stand-in for the Supabase backend, used when no Supabase keys are
 * configured. Same interface as live.js, and it applies the same rules as the
 * SQL functions (server-side pricing, fingerprinted amounts, stock
 * reservation, the settlement formula, withdrawal checks) so the demo behaves
 * like the real thing. State lives in memory and resets on reload.
 */
const DEFAULTS = {
  receive_address: 'TQrY8tryqsYVCYS3MFbtffiPp2ccyn4STm',
  split_standard: 0.8, split_pro: 0.9, pro_premium: 0.06, uptime_sla: 0.97,
  referral_share: 0.05, cashback_rate: 0.1, cashback_cap: 250,
  withdraw_min: 20, withdraw_fee: 1, order_ttl_minutes: 60,
  btc_hashprice: 45.2, ltc_hashprice: 0.95, kas_hashprice: 0.55, power_rate: 0.062
};

const id = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const todayUTC = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const fail = (msg) => { throw new Error(msg); };
const tick = () => Promise.resolve();
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* ignore */ } }
};
const fakeTx = (rand = Math.random) => Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rand() * 16)]).join('');
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const fakeAddress = (rand) => 'T' + Array.from({ length: 33 }, () => B58[Math.floor(rand() * 58)]).join('');
/** Repeatable random numbers (mulberry32), so every reload shows the same sample figures. */
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function createDemoApi() {
  const S = { ...DEFAULTS };
  const machines = RIGS.map((r, i) => fromRig({ ...r, active: true, sort: (i + 1) * 10 }));
  const people = [];
  const orders = [], holdings = [], ledger = [], withdrawals = [], results = [], published = [];
  const resultIndex = new Map(); // "day|machine" -> row
  const ledgerIndex = new Map(); // "kind|holding|day" -> row
  let ledgerSeq = 0;
  let me = null; // the signed-in demo customer, set once the sample customers exist
  let session = null;
  const authListeners = new Set();
  const accountListeners = new Set();
  const orderListeners = new Map();

  const cfg = () => toConfig(S);
  const machine = (mid) => machines.find((m) => m.id === mid);
  const balanceOf = (uid) => r6(ledger.filter((l) => l.user_id === uid).reduce((a, l) => a + l.amount, 0));
  const emit = () => accountListeners.forEach((f) => f());
  const emitOrder = (o) => (orderListeners.get(o.id) || []).forEach((f) => f({ ...o }));
  const requireMe = () => session || fail('sign in first');
  const requireAdmin = () => (session && me.role === 'admin') || fail('admin only');

  const addLedger = (row) => {
    const l = { id: ++ledgerSeq, created_at: new Date().toISOString(), ...row };
    ledger.push(l);
    if (l.holding_id && l.day) ledgerIndex.set(`${l.kind}|${l.holding_id}|${l.day}`, l);
    return l;
  };
  const upsertLedger = (kind, holding, day, amount, userId, at) => {
    const key = `${kind}|${holding.id}|${day}`;
    const found = ledgerIndex.get(key);
    if (amount > 0 || kind === 'earning') {
      const row = { user_id: userId, kind, amount: r6(amount), day, holding_id: holding.id, note: kind };
      if (found) Object.assign(found, row); else addLedger({ ...row, ...(at ? { created_at: at } : {}) });
    } else if (found) {
      ledger.splice(ledger.indexOf(found), 1);
      ledgerIndex.delete(key);
    }
  };
  const putResult = (row) => {
    const key = `${row.day}|${row.machine_id}`;
    const found = resultIndex.get(key);
    if (found) Object.assign(found, row);
    else { results.push(row); resultIndex.set(key, row); }
  };

  // mirror of public.settle_day
  const settle = (day, at) => {
    let count = 0, total = 0;
    for (const h of holdings.filter((x) => x.active && x.started_on <= day)) {
      const r = resultIndex.get(`${day}|${h.machine_id}`);
      if (!r) continue;
      const net = r.revenue - r.power_cost;
      const owner = Math.max(net, 0) * h.split;
      const fee = Math.max(net, 0) - owner;
      let credit = 0;
      if (r.uptime < S.uptime_sla) {
        if (r.uptime > 0 && net > 0) credit = h.split * net * (S.uptime_sla / r.uptime - 1);
        else if (r.uptime === 0) credit = Math.max(estFullNet(machine(h.machine_id)), 0) * h.split * S.uptime_sla;
      }
      const owner_ = people.find((p) => p.id === h.user_id);
      const ref = owner_?.referred_by ? fee * S.referral_share : 0;
      upsertLedger('earning', h, day, owner, h.user_id, at);
      upsertLedger('sla_credit', h, day, credit, h.user_id, at);
      if (owner_?.referred_by) upsertLedger('referral', h, day, ref, owner_.referred_by, at);
      count++; total += owner + credit;
    }
    const p = published.find((x) => x.day === day);
    const row = { day, published_at: at || new Date().toISOString(), holdings_paid: count, total_paid: r6(total) };
    if (p) Object.assign(p, row); else published.push(row);
    return { day, holdings: count, total: r6(total) };
  };

  const estFullNet = (m) => {
    const rig = toRig(m);
    return grossPerDay(rig, cfg()) - (rig.watts / 1000) * 24 * S.power_rate;
  };
  const estimate = (m, hp = 1, up = 1) => {
    const rig = toRig(m);
    return {
      revenue: r6(grossPerDay(rig, cfg()) * hp * up),
      power_cost: r6((rig.watts / 1000) * 24 * S.power_rate * up),
      uptime: up
    };
  };

  const confirm = (o, txid, amount, at = new Date().toISOString()) => {
    const first = !orders.some((x) => x.user_id === o.user_id && x.status === 'paid');
    Object.assign(o, { status: 'paid', tx_hash: txid, paid_amount: amount, paid_at: at });
    // mirror of confirm_order_payment: 1 USDT or more above the order is refunded, never kept as balance
    if (amount - o.pay_amount >= 1) Object.assign(o, { refund_due: r6(amount - o.pay_amount), refund_tx: null });
    holdings.push({ id: id(), user_id: o.user_id, machine_id: o.machine_id, order_id: o.id, split: o.split,
      started_on: addDays(at.slice(0, 10), 1), active: true, created_at: at });
    if (first && S.cashback_rate > 0) {
      addLedger({ user_id: o.user_id, kind: 'cashback', amount: r6(Math.min(o.price * S.cashback_rate, S.cashback_cap)),
        order_id: o.id, note: 'first-purchase cashback', created_at: at });
    }
    emitOrder(o); emit();
  };

  // --------------------------------------------------------------- seed --
  // The sample customers in data/demoCustomers.js: their orders, 60 days of
  // published daily profit and the payouts those days produced, all through
  // the same confirm/settle rules as above.
  (() => {
    const rand = seeded(20260917);
    const now = Date.now();
    const t = todayUTC();
    const midnight = Date.parse(`${t}T00:00:00Z`);
    const iso = (ms) => new Date(ms).toISOString();
    // a moment on a past day, or earlier today when daysAgo is 0
    const when = (daysAgo, frac = rand()) => (daysAgo === 0
      ? midnight + (now - midnight) * (0.35 + 0.5 * frac)
      : midnight - daysAgo * 864e5 + (8 + 12 * frac) * 3600e3);
    const warn = (msg) => console.warn(`[demo data] ${msg}`);

    // customers
    const byName = new Map();
    for (const c of DEMO_CUSTOMERS) {
      const first = Math.max(...c.purchases.map((x) => x[2]));
      const slug = c.name.toLowerCase().replace(/[^a-z]+/g, '-');
      const joined = first === 0 ? midnight + (now - midnight) * 0.3 : when(first + 1 + Math.floor(rand() * 3), 0);
      const person = {
        id: `demo-${slug}`, email: `${slug.split('-')[0]}@example.com`, full_name: c.name,
        role: c.name === VIEWER ? 'admin' : 'user', payout_address: fakeAddress(rand),
        referral_code: c.name.split(' ')[0].toUpperCase(), referred_by: null,
        email_updates: rand() > 0.2, leaderboard: c.visibility || 'anonymous', created_at: iso(joined)
      };
      people.push(person);
      byName.set(c.name, person);
    }
    for (const c of DEMO_CUSTOMERS) {
      if (!c.referredBy) continue;
      const person = byName.get(c.name);
      const referrer = byName.get(c.referredBy);
      if (!referrer) warn(`${c.name}: no customer called "${c.referredBy}"`);
      else if (referrer.created_at > person.created_at) warn(`${c.name} joined before ${c.referredBy}, who invited them`);
      else person.referred_by = referrer.id;
    }
    me = byName.get(VIEWER) || people[0];

    // orders, oldest first so "first purchase" is right
    const buys = DEMO_CUSTOMERS
      .flatMap((c) => c.purchases.map(([machineId, plan, daysAgo, how]) =>
        ({ person: byName.get(c.name), machineId, plan, daysAgo, how, at: when(daysAgo) })))
      .sort((a, b) => a.at - b.at);
    const amounts = new Set();
    for (const b of buys) {
      const m = machine(b.machineId);
      if (!m) { warn(`${b.person.full_name}: unknown machine "${b.machineId}"`); continue; }
      const price = b.plan === 'pro' ? Math.round(m.price * (1 + S.pro_premium)) : m.price;
      let amount;
      do { amount = r6(price + (1 + Math.floor(rand() * 999)) / 1000); } while (amounts.has(amount));
      amounts.add(amount);
      const waiting = b.how === 'waiting';
      const created = waiting
        ? now - 12 * 60e3
        : b.at - Math.min((4 + rand() * 20) * 60e3, (b.at - Date.parse(b.person.created_at)) / 2);
      const o = { id: id(), user_id: b.person.id, machine_id: m.id, plan: b.plan,
        split: b.plan === 'pro' ? S.split_pro : S.split_standard, price, pay_amount: amount, pay_address: S.receive_address,
        status: 'awaiting_payment', claimed_txid: null, tx_hash: null,
        created_at: iso(created), expires_at: iso(created + S.order_ttl_minutes * 60e3) };
      orders.push(o);
      if (waiting) { m.stock -= 1; continue; }
      if (b.how === 'expired') { o.status = 'expired'; continue; }
      const sent = typeof b.how?.sent === 'number' ? b.how.sent : amount;
      o.from_address = b.person.payout_address;
      if (sent < price) {
        Object.assign(o, { status: 'needs_review', tx_hash: fakeTx(rand), paid_amount: sent, review_note: 'underpaid' });
        continue;
      }
      confirm(o, fakeTx(rand), sent, iso(b.at));
    }

    // 60 days of daily profit: one figure per whole machine, shares worked out from it
    const units = machines.filter((m) => m.kind === 'unit');
    const shares = machines.filter((m) => m.kind === 'share');
    const outages = { 9: { s21pro: 0.712, s21xp: 0.74 }, 23: { m66sp: 0.93 }, 37: { l9: 0.9 } };
    let drift = 0;
    for (let ago = 60; ago >= 1; ago--) {
      const day = addDays(t, -ago);
      drift = Math.max(-0.08, Math.min(0.08, drift + (rand() - 0.5) * 0.03)); // the bitcoin price moving
      const byModel = {};
      for (const m of units) {
        const up = outages[ago]?.[m.id] ?? (rand() < 0.15 ? Math.round((0.985 + rand() * 0.015) * 1000) / 1000 : 1);
        const e = estimate(m, 1 + drift, up);
        const profit = e.revenue - e.power_cost;
        byModel[m.model] = { profit, up, model: m.model };
        putResult({ day, machine_id: m.id, revenue: r6(Math.max(profit, 0)), power_cost: r6(Math.max(-profit, 0)), uptime: up });
      }
      for (const sh of shares) {
        const parent = byModel[sh.parent_model];
        if (!parent) continue;
        const profit = parent.profit * (sh.hash / sh.parent_hash);
        putResult({ day, machine_id: sh.id, revenue: r6(Math.max(profit, 0)), power_cost: r6(Math.max(-profit, 0)),
          uptime: parent.up, note: `Part of ${parent.model}` });
      }
      const publishedAt = Math.min(Date.parse(`${addDays(day, 1)}T08:30:00Z`) + rand() * 40 * 60e3, now - 5 * 60e3);
      settle(day, iso(publishedAt));
    }

    // withdrawals
    for (const [name, amount, daysAgo, sent] of DEMO_WITHDRAWALS) {
      const person = byName.get(name);
      if (!person) { warn(`withdrawal: no customer called "${name}"`); continue; }
      if (amount > balanceOf(person.id)) { warn(`${name} has not earned ${amount} to withdraw`); continue; }
      const requested = now - daysAgo * 864e5;
      const w = { id: id(), user_id: person.id, amount, fee: S.withdraw_fee, address: person.payout_address,
        status: sent ? 'sent' : 'pending', tx_hash: sent ? fakeTx(rand) : null, requested_at: iso(requested),
        processed_at: sent ? iso(requested + (5 + rand() * 14) * 3600e3) : null };
      withdrawals.push(w);
      addLedger({ user_id: person.id, kind: 'withdrawal', amount: -amount, withdrawal_id: w.id, note: 'withdrawal request',
        created_at: w.requested_at });
    }

    // the demo opens signed in; "Sign out" sticks for this browser tab
    session = store.get('hy-demo-signed-out') ? null : { user: { id: me.id, email: me.email } };
  })();

  const mine = (rows, key = 'user_id') => rows.filter((r) => r[key] === me.id);
  const withPerson = (row) => {
    const p = people.find((x) => x.id === row.user_id);
    return { ...row, profiles: p ? { email: p.email, full_name: p.full_name } : null };
  };

  const api = {
    live: false,

    async getSession() { await tick(); return session; },
    onAuthChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb); },
    // demo login: no trip to Google, it signs straight in as the sample customer
    async signInWithGoogle() {
      await tick();
      session = { user: { id: me.id, email: me.email } };
      store.set('hy-demo-signed-out', null);
      authListeners.forEach((f) => f(session));
      return session;
    },
    async signOut() {
      session = null;
      store.set('hy-demo-signed-out', '1');
      authListeners.forEach((f) => f(null));
    },

    async getSettings() { await tick(); return cfg(); },
    async listMachines() { await tick(); return machines.filter((m) => m.active).sort((a, b) => a.sort - b.sort).map(toRig); },

    async getProfile() { requireMe(); return { ...me }; },

    // mirror of public.leaderboard: ranked by the price of PAID orders only
    async leaderboard(period = 'all', limit = 20) {
      if (!['all', '30d'].includes(period)) fail('period must be all or 30d');
      const EARNED = new Set(['earning', 'sla_credit', 'referral']);
      const since = Date.now() - 30 * 864e5;
      const rows = people
        .filter((p) => p.leaderboard !== 'hidden')
        .map((p) => {
          const paid = orders.filter((o) => o.user_id === p.id && o.status === 'paid');
          const inPeriod = period === '30d' ? paid.filter((o) => Date.parse(o.paid_at) >= since) : paid;
          return {
            id: p.id,
            alias: p.leaderboard === 'name' && p.full_name
              ? p.full_name.split(' ')[0] + (p.full_name.split(' ')[1] ? ' ' + p.full_name.split(' ')[1][0] + '.' : '')
              : 'Miner ' + [...p.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
                  .toString(16).slice(-4).toUpperCase().padStart(4, '0'),
            is_me: !!session && p.id === me.id,
            machines: holdings.filter((h) => h.user_id === p.id && h.active).length,
            deposited: r6(inPeriod.reduce((x, o) => x + o.price, 0)),
            deposited_total: r6(paid.reduce((x, o) => x + o.price, 0)),
            earned_total: r6(ledger.filter((l) => l.user_id === p.id && EARNED.has(l.kind)).reduce((x, l) => x + l.amount, 0)),
            joined: p.created_at.slice(0, 10)
          };
        })
        .filter((r) => r.deposited > 0)
        .sort((x, y) => y.deposited - x.deposited || y.deposited_total - x.deposited_total)
        .map((r, i) => ({ ...r, place: i + 1 }));
      return rows.filter((r) => r.place <= limit || r.is_me).map(({ id, ...r }) => r);
    },
    async platformStats() {
      const EARNED = new Set(['earning', 'sla_credit', 'referral']);
      const since = Date.now() - 30 * 864e5;
      const paidOrders = orders.filter((o) => o.status === 'paid');
      const payouts = ledger.filter((l) => EARNED.has(l.kind));
      return {
        deposited_total: r6(paidOrders.reduce((x, o) => x + o.price, 0)),
        deposited_30d: r6(paidOrders.filter((o) => Date.parse(o.paid_at) >= since).reduce((x, o) => x + o.price, 0)),
        buyers: new Set(paidOrders.map((o) => o.user_id)).size,
        miners: new Set(holdings.filter((h) => h.active).map((h) => h.user_id)).size,
        machines: holdings.filter((h) => h.active).length,
        paid_total: r6(payouts.reduce((x, l) => x + l.amount, 0)),
        days_paid: published.length
      };
    },
    async updateProfile(patch) {
      requireMe();
      if (patch.payout_address && !TRON_ADDRESS.test(patch.payout_address)) {
        fail('That is not a valid TRON address. It starts with T and is 34 characters long.');
      }
      for (const k of ['full_name', 'payout_address', 'email_updates', 'leaderboard']) if (k in patch) me[k] = patch[k];
      return { ...me };
    },
    async setReferrer() { return false; },

    async myOrders() { requireMe(); return mine(orders).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); },
    async getOrder(oid) { requireMe(); const o = orders.find((x) => x.id === oid && x.user_id === me.id); if (!o) fail('order not found'); return { ...o }; },
    async createOrder(machineId, plan) {
      requireMe();
      if (!['standard', 'pro'].includes(plan)) fail('unknown plan');
      if (mine(orders).filter((o) => o.status === 'awaiting_payment').length >= 3) {
        fail('you already have 3 unpaid orders - pay or wait for them to expire');
      }
      const m = machine(machineId);
      if (!m || !m.active) fail('this machine is not for sale');
      if (m.stock < 1) fail('sold out');
      const split = plan === 'pro' ? S.split_pro : S.split_standard;
      const price = plan === 'pro' ? Math.round(m.price * (1 + S.pro_premium)) : m.price;
      let amount;
      do { amount = r6(price + (1 + Math.floor(Math.random() * 999)) / 1000); }
      while (orders.some((o) => o.pay_amount === amount));
      m.stock -= 1;
      const o = { id: id(), user_id: me.id, machine_id: m.id, plan, split, price, pay_amount: amount,
        pay_address: S.receive_address, status: 'awaiting_payment', claimed_txid: null, tx_hash: null,
        created_at: new Date().toISOString(), expires_at: new Date(Date.now() + S.order_ttl_minutes * 60e3).toISOString() };
      orders.push(o);
      emit();
      return { ...o };
    },
    async cancelOrder(oid) {
      const o = orders.find((x) => x.id === oid && x.user_id === me.id);
      if (!o || o.status !== 'awaiting_payment') fail('only an unpaid order can be cancelled');
      o.status = 'cancelled';
      machine(o.machine_id).stock += 1;
      emitOrder(o); emit();
      return { ...o };
    },
    async claimPayment(oid, txid) {
      if (!TXID.test(txid.trim())) fail('that does not look like a TRON transaction ID (64 characters, 0-9 and a-f)');
      const o = orders.find((x) => x.id === oid && x.user_id === me.id);
      if (!o || !['awaiting_payment', 'expired'].includes(o.status)) fail('order not found or already paid');
      o.claimed_txid = txid.trim().toLowerCase();
      setTimeout(() => confirm(o, o.claimed_txid, o.pay_amount), 900); // the scanner "finds" it
      return { ...o };
    },
    async pokeScanner() {},
    /** Demo only: pretend the exact amount arrived on-chain. */
    async demoPay(oid) {
      const o = orders.find((x) => x.id === oid);
      if (o && o.status === 'awaiting_payment') setTimeout(() => confirm(o, fakeTx(), o.pay_amount), 1200);
    },
    watchOrder(oid, cb) {
      if (!orderListeners.has(oid)) orderListeners.set(oid, new Set());
      orderListeners.get(oid).add(cb);
      return () => orderListeners.get(oid)?.delete(cb);
    },

    async myHoldings() { requireMe(); return mine(holdings); },
    async myLedger() { requireMe(); return mine(ledger).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); },
    async myBalance() { requireMe(); return balanceOf(me.id); },
    async myWithdrawals() { requireMe(); return mine(withdrawals).sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1)); },
    async requestWithdrawal(amount) {
      requireMe();
      if (!me.payout_address) fail('add your TRON wallet address before withdrawing');
      if (!(amount >= S.withdraw_min)) fail(`the minimum withdrawal is ${S.withdraw_min} USDT`);
      if (amount > balanceOf(me.id)) fail('that is more than your balance');
      if (mine(withdrawals).some((w) => w.status === 'pending')) fail('you already have a withdrawal waiting to be sent');
      const w = { id: id(), user_id: me.id, amount: r6(amount), fee: S.withdraw_fee, address: me.payout_address,
        status: 'pending', tx_hash: null, requested_at: new Date().toISOString() };
      withdrawals.push(w);
      addLedger({ user_id: me.id, kind: 'withdrawal', amount: -r6(amount), withdrawal_id: w.id, note: 'withdrawal request' });
      emit();
      return { ...w };
    },
    // mirror of public.my_referrals
    async myReferrals() {
      requireMe();
      return people.filter((p) => p.referred_by === me.id)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((p) => {
          const theirs = holdings.filter((h) => h.user_id === p.id);
          const ids = new Set(theirs.map((h) => h.id));
          const active = theirs.filter((h) => h.active);
          return {
            name: p.full_name.split(' ')[0],
            joined: p.created_at,
            machines: active.length,
            bought: r6(orders.filter((o) => o.user_id === p.id && o.status === 'paid').reduce((a, o) => a + o.price, 0)),
            earned: r6(ledger.filter((l) => l.kind === 'referral' && l.user_id === me.id && ids.has(l.holding_id))
              .reduce((a, l) => a + l.amount, 0)),
            holdings: active.map((h) => ({ machine_id: h.machine_id, split: h.split }))
          };
        });
    },
    watchAccount(cb) { accountListeners.add(cb); return () => accountListeners.delete(cb); },

    admin: {
      async overview() {
        requireAdmin();
        return {
          users: people.length,
          active_holdings: holdings.filter((h) => h.active).length,
          sales_total: orders.filter((o) => o.status === 'paid').reduce((a, o) => a + o.price, 0),
          open_orders: orders.filter((o) => o.status === 'awaiting_payment').length,
          needs_review: orders.filter((o) => o.status === 'needs_review').length,
          refunds_due: orders.filter((o) => o.refund_due > 0 && !o.refund_tx).length,
          refunds_amount: orders.filter((o) => o.refund_due > 0 && !o.refund_tx).reduce((x, o) => x + o.refund_due, 0),
          pending_withdrawals: withdrawals.filter((w) => w.status === 'pending').length,
          pending_amount: withdrawals.filter((w) => w.status === 'pending').reduce((a, w) => a + w.amount, 0),
          owed_to_customers: r6(ledger.reduce((a, l) => a + l.amount, 0)),
          last_published: published.map((p) => p.day).sort().pop() || null
        };
      },
      async users() {
        requireAdmin();
        return people.map((p) => ({ id: p.id, email: p.email, full_name: p.full_name, role: p.role, created_at: p.created_at,
          referred_by_email: people.find((x) => x.id === p.referred_by)?.email || null,
          holdings: holdings.filter((h) => h.user_id === p.id && h.active).length,
          balance: balanceOf(p.id),
          paid_total: orders.filter((o) => o.user_id === p.id && o.status === 'paid').reduce((a, o) => a + o.price, 0) }));
      },
      async machines() { requireAdmin(); return machines.map((m) => ({ ...m })).sort((a, b) => a.sort - b.sort); },
      async saveMachine(row) {
        requireAdmin();
        if (!/^[a-z0-9-]{2,40}$/.test(row.id)) fail('ID must be 2-40 lowercase letters, numbers or dashes');
        if (!(row.price > 0) || !(row.hash > 0) || !(row.watts > 0)) fail('price, hashrate and power must be above zero');
        const i = machines.findIndex((m) => m.id === row.id);
        if (i >= 0) Object.assign(machines[i], row); else machines.push({ ...row });
        return { ...row };
      },
      async machineStats() {
        requireAdmin();
        return machines.map((m) => {
          const paid = orders.filter((o) => o.machine_id === m.id && o.status === 'paid');
          const hs = holdings.filter((h) => h.machine_id === m.id);
          const last = results.filter((r) => r.machine_id === m.id).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
          return {
            machine_id: m.id,
            sold: paid.length,
            sales: paid.reduce((x, o) => x + o.price, 0),
            owners: new Set(hs.filter((h) => h.active).map((h) => h.user_id)).size,
            paid_to_owners: r6(ledger.filter((l) => ['earning', 'sla_credit'].includes(l.kind) && hs.some((h) => h.id === l.holding_id))
              .reduce((x, l) => x + l.amount, 0)),
            last_day: last?.day || null,
            last_profit: last ? r6(last.revenue - last.power_cost) : null
          };
        });
      },
      async markRefundSent(oid, txid) {
        requireAdmin();
        if (!TXID.test(txid.trim())) fail('transaction ID must be 64 hex characters');
        const o = orders.find((x) => x.id === oid && x.refund_due > 0 && !x.refund_tx);
        if (!o) fail('no refund is owed on this order, or it was already sent');
        o.refund_tx = txid.trim().toLowerCase();
        return { ...o };
      },
      async removeMachine(mid) {
        requireAdmin();
        const m = machine(mid);
        if (orders.some((o) => o.machine_id === mid)) { m.active = false; return 'hidden'; }
        machines.splice(machines.indexOf(m), 1);
        return 'deleted';
      },
      async orders(status) {
        requireAdmin();
        return orders.filter((o) => (status === 'refund' ? o.refund_due > 0 && !o.refund_tx : !status || o.status === status))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .map((o) => ({ ...withPerson(o), machines: { model: machine(o.machine_id)?.model } }));
      },
      async confirmOrder(oid, txid, amount) {
        requireAdmin();
        const o = orders.find((x) => x.id === oid);
        if (!o) fail('order not found');
        if (amount < o.price) fail('amount is below the price');
        if (o.status !== 'paid') confirm(o, txid.trim().toLowerCase(), amount);
        return { ...o };
      },
      async results(day) {
        requireAdmin();
        return results.filter((r) => r.day === day).map((r) => ({ ...r }));
      },
      async saveResults(rows) {
        requireAdmin();
        for (const row of rows) {
          putResult({ ...row, revenue: +row.revenue, power_cost: +row.power_cost, uptime: +row.uptime });
        }
        return rows;
      },
      async publishDay(day) {
        requireAdmin();
        if (day >= todayUTC()) fail('you can only publish a day that has finished');
        const out = settle(day);
        emit();
        return out;
      },
      async publishedDays() { requireAdmin(); return [...published].sort((a, b) => (a.day < b.day ? 1 : -1)); },
      async withdrawals(status) {
        requireAdmin();
        return withdrawals.filter((w) => !status || w.status === status)
          .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1)).map(withPerson);
      },
      async markSent(wid, txid) {
        requireAdmin();
        if (!TXID.test(txid.trim())) fail('transaction ID must be 64 hex characters');
        const w = withdrawals.find((x) => x.id === wid && x.status === 'pending');
        if (!w) fail('withdrawal not found or already processed');
        Object.assign(w, { status: 'sent', tx_hash: txid.trim().toLowerCase(), processed_at: new Date().toISOString() });
        emit();
        return { ...w };
      },
      async reject(wid, reason) {
        requireAdmin();
        const w = withdrawals.find((x) => x.id === wid && x.status === 'pending');
        if (!w) fail('withdrawal not found or already processed');
        Object.assign(w, { status: 'rejected', admin_note: reason, processed_at: new Date().toISOString() });
        addLedger({ user_id: w.user_id, kind: 'withdrawal_reversal', amount: w.amount, withdrawal_id: w.id, note: reason || 'withdrawal rejected' });
        emit();
        return { ...w };
      },
      async settings() { requireAdmin(); return { ...S }; },
      async saveSettings(patch) {
        requireAdmin();
        if (patch.receive_address && !TRON_ADDRESS.test(patch.receive_address)) fail('the receiving wallet is not a valid TRON address');
        Object.assign(S, patch);
        return { ...S };
      },
      // mirror of public.admin_record_sale
      async recordSale({ userId, machineId, plan, price, quantity, paidOn, note, cashback }) {
        requireAdmin();
        if (!people.some((p) => p.id === userId)) fail('customer not found');
        const m = machine(machineId);
        if (!m) fail('machine not found');
        if (!['standard', 'pro'].includes(plan)) fail('plan must be standard or pro');
        const each = Number(price), n = Number(quantity);
        if (!(each > 0)) fail('enter the price that was paid for one machine');
        if (!Number.isInteger(n) || n < 1 || n > 100) fail('quantity must be 1 to 100');
        if (!paidOn || paidOn > todayUTC()) fail('the payment date cannot be in the future');
        if (String(note || '').trim().length < 3) fail('write down how it was paid (e.g. cash on 12 July, or the transaction ID)');
        if (m.stock < n) fail(`only ${m.stock} in stock - raise the stock in Machines first`);
        const at = paidOn === todayUTC() ? new Date().toISOString() : `${paidOn}T12:00:00.000Z`;
        const split = plan === 'pro' ? S.split_pro : S.split_standard;
        const first = !orders.some((o) => o.user_id === userId && o.status === 'paid');
        const ids = [];
        for (let i = 0; i < n; i++) {
          const o = { id: id(), user_id: userId, machine_id: m.id, plan, split, price: r6(each), pay_amount: r6(each),
            pay_address: S.receive_address, status: 'paid', tx_hash: null, paid_amount: r6(each), paid_at: at,
            created_at: at, expires_at: at, recorded_note: String(note).trim() };
          orders.push(o);
          holdings.push({ id: id(), user_id: userId, machine_id: m.id, order_id: o.id, split,
            started_on: addDays(at.slice(0, 10), 1), active: true, created_at: at });
          ids.push(o.id);
        }
        m.stock -= n;
        let cashbackPaid = 0;
        if (cashback && first && S.cashback_rate > 0 && !ledger.some((l) => l.user_id === userId && l.kind === 'cashback')) {
          cashbackPaid = r6(Math.min(each * S.cashback_rate, S.cashback_cap));
          addLedger({ user_id: userId, kind: 'cashback', amount: cashbackPaid, order_id: ids[0], note: 'first-purchase cashback', created_at: at });
        }
        emit();
        return { orders: n, total: r6(each * n), cashback: cashbackPaid, starts_on: addDays(at.slice(0, 10), 1) };
      },
      async adjust(userId, amount, note) {
        requireAdmin();
        if (!String(note || '').trim()) fail('say why - it is shown to the customer');
        addLedger({ user_id: userId, kind: 'adjustment', amount: r6(amount), note });
        emit();
      },
      /** Pre-fill for the results form: what the hashprice settings predict. */
      estimate: (m) => estimate(m)
    }
  };

  return api;
}
