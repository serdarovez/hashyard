import { toConfig, toRig } from './mappers.js';

/**
 * The real backend: Supabase.
 *
 * Row level security decides what each caller may see, so these queries could
 * in principle omit the user filter - but an ADMIN is allowed to see every
 * row, and without `.eq('user_id', uid)` an admin's own wallet would show the
 * whole platform's ledger. Every "my..." query therefore filters explicitly.
 */
export function createLiveApi(sb) {
  let uid = null;

  const must = ({ data, error }) => {
    if (error) throw new Error(error.message || 'Something went wrong');
    return data;
  };

  const api = {
    live: true,

    // ------------------------------------------------------------ session --
    async getSession() {
      const { data } = await sb.auth.getSession();
      uid = data.session?.user?.id ?? null;
      return data.session ? { user: data.session.user } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        uid = session?.user?.id ?? null;
        cb(session ? { user: session.user } : null);
      });
      return () => data.subscription.unsubscribe();
    },
    /** Step 1 of email login: send a 6-digit code. Creates the account on first use. */
    async sendLoginCode(email) {
      const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      if (error) throw new Error(error.message);
    },
    /** Step 2: exchange the code for a session. */
    async verifyLoginCode(email, code) {
      const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
      if (error) throw new Error(error.message);
      uid = data.session?.user?.id ?? null;
      return data.session ? { user: data.session.user } : null;
    },
    async signOut() {
      await sb.auth.signOut();
    },

    // ------------------------------------------------------------- public --
    async getSettings() {
      return toConfig(must(await sb.from('settings').select('*').single()));
    },
    async listMachines() {
      return must(await sb.from('machines').select('*').eq('active', true).order('sort')).map(toRig);
    },
    // anonymised and aggregated in the database - no ids or emails come back
    async leaderboard(period = 'all', limit = 20) {
      return must(await sb.rpc('leaderboard', { p_period: period, p_limit: limit }));
    },
    async platformStats() {
      return must(await sb.rpc('platform_stats'));
    },

    // ----------------------------------------------------------------- me --
    async getProfile() {
      return must(await sb.from('profiles').select('*').eq('id', uid).single());
    },
    async updateProfile(patch) {
      return must(await sb.from('profiles').update(patch).eq('id', uid).select().single());
    },
    async setReferrer(code) {
      return must(await sb.rpc('set_referrer', { p_code: code }));
    },

    async myOrders() {
      return must(await sb.from('orders').select('*').eq('user_id', uid)
        .order('created_at', { ascending: false }).limit(50));
    },
    async getOrder(id) {
      return must(await sb.from('orders').select('*').eq('id', id).eq('user_id', uid).single());
    },
    async createOrder(machineId, plan) {
      return must(await sb.rpc('create_order', { p_machine_id: machineId, p_plan: plan }));
    },
    async cancelOrder(id) {
      return must(await sb.rpc('cancel_order', { p_order_id: id }));
    },
    async claimPayment(id, txid) {
      const order = must(await sb.rpc('claim_payment', { p_order_id: id, p_txid: txid.trim() }));
      api.pokeScanner();
      return order;
    },
    /** Ask for an immediate scan instead of waiting for the minute tick. */
    async pokeScanner() {
      try { await sb.functions.invoke('payments', { body: {} }); } catch { /* cron will pick it up */ }
    },
    watchOrder(id, cb) {
      const ch = sb.channel(`order-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
          (p) => cb(p.new))
        .subscribe();
      return () => sb.removeChannel(ch);
    },

    async myHoldings() {
      return must(await sb.from('holdings').select('*').eq('user_id', uid).order('created_at'));
    },
    async myLedger() {
      return must(await sb.from('ledger').select('*').eq('user_id', uid)
        .order('created_at', { ascending: false }).limit(500));
    },
    async myBalance() {
      return Number(must(await sb.rpc('my_balance')));
    },
    async myWithdrawals() {
      return must(await sb.from('withdrawals').select('*').eq('user_id', uid)
        .order('requested_at', { ascending: false }).limit(50));
    },
    async requestWithdrawal(amount) {
      return must(await sb.rpc('request_withdrawal', { p_amount: amount }));
    },
    async myReferrals() {
      return must(await sb.rpc('my_referrals'));
    },
    /** Any change to my ledger, orders or withdrawals, pushed live. */
    watchAccount(cb) {
      if (!uid) return () => {};
      const ch = sb.channel(`account-${uid}`);
      for (const table of ['ledger', 'orders', 'withdrawals']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${uid}` }, () => cb(table));
      }
      ch.subscribe();
      return () => sb.removeChannel(ch);
    },

    // -------------------------------------------------------------- admin --
    admin: {
      overview: async () => must(await sb.rpc('admin_overview')),
      users: async () => must(await sb.rpc('admin_users')),
      machines: async () => must(await sb.from('machines').select('*').order('sort')),
      saveMachine: async (row) => must(await sb.from('machines').upsert({ ...row, updated_at: new Date().toISOString() }).select().single()),
      removeMachine: async (id) => must(await sb.rpc('admin_remove_machine', { p_id: id })),
      machineStats: async () => must(await sb.rpc('admin_machine_stats')),
      orders: async (status) => {
        let q = sb.from('orders').select('*, profiles(email, full_name), machines(model)')
          .order('created_at', { ascending: false }).limit(100);
        if (status === 'refund') q = q.gt('refund_due', 0).is('refund_tx', null);
        else if (status) q = q.eq('status', status);
        return must(await q);
      },
      markRefundSent: async (id, txid) =>
        must(await sb.rpc('admin_mark_refund_sent', { p_order_id: id, p_txid: txid.trim() })),
      confirmOrder: async (id, txid, amount) =>
        must(await sb.rpc('admin_confirm_order', { p_order_id: id, p_txid: txid.trim(), p_amount: amount })),
      results: async (day) => must(await sb.from('daily_results').select('*').eq('day', day)),
      saveResults: async (rows) =>
        must(await sb.from('daily_results').upsert(rows.map((r) => ({ ...r, entered_by: uid, updated_at: new Date().toISOString() }))).select()),
      publishDay: async (day) => must(await sb.rpc('admin_publish_day', { p_day: day })),
      publishedDays: async () => must(await sb.from('published_days').select('*').order('day', { ascending: false }).limit(30)),
      withdrawals: async (status) => {
        let q = sb.from('withdrawals').select('*, profiles!withdrawals_user_id_fkey(email, full_name)')
          .order('requested_at', { ascending: false }).limit(100);
        if (status) q = q.eq('status', status);
        return must(await q);
      },
      markSent: async (id, txid) => must(await sb.rpc('admin_mark_withdrawal_sent', { p_id: id, p_txid: txid.trim() })),
      reject: async (id, reason) => must(await sb.rpc('admin_reject_withdrawal', { p_id: id, p_reason: reason })),
      settings: async () => must(await sb.from('settings').select('*').single()),
      saveSettings: async (patch) =>
        must(await sb.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1).select().single()),
      adjust: async (userId, amount, note) =>
        must(await sb.rpc('admin_adjust_balance', { p_user: userId, p_amount: amount, p_note: note }))
    }
  };

  return api;
}
