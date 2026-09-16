// node supabase/functions/_shared/payments.test.mjs
import { toMicro, fromMicro, parseTransfers, matchTransfers, USDT_TRC20 } from './payments.js';

let pass = 0;
const ok = (cond, msg) => {
  if (!cond) { console.error('FAIL ' + msg); process.exit(1); }
  pass++; console.log('ok   ' + msg);
};
const throws = (fn, msg) => { try { fn(); ok(false, msg); } catch { ok(true, msg); } };

const ME = 'TQrY8tryqsYVCYS3MFbtffiPp2ccyn4STm';
const FAKE_USDT = 'TFakeTokenContractThatSaysUSDTxxxx';
const tx = (n) => n.repeat(64).slice(0, 64);
const t0 = Date.parse('2026-09-14T10:00:00Z');

console.log('== amounts ==');
ok(toMicro('250.037') === 250037000n, '"250.037" is 250037000 micro-USDT');
ok(toMicro('4299') === 4299000000n, 'whole numbers work');
ok(toMicro(0.1 + 0.2) === 300000n, '0.1 + 0.2 does not leak float error into money');
ok(toMicro('4299.087000') === 4299087000n, 'the database numeric format parses exactly');
ok(fromMicro(4299087000n) === '4299.087000', 'converting back gives the database format');
throws(() => toMicro('1e3'), 'scientific notation is refused');
throws(() => toMicro('-5'), 'negative amounts are refused');
throws(() => toMicro('1.0000001'), 'more than 6 decimals is refused');

console.log('== parsing TronGrid ==');
const raw = {
  success: true,
  data: [
    { transaction_id: tx('A'), type: 'Transfer', from: 'TPayer1', to: ME, value: '4299087000', block_timestamp: t0 + 60e3,
      token_info: { address: USDT_TRC20, decimals: 6, symbol: 'USDT' } },
    { transaction_id: tx('B'), type: 'Transfer', from: 'TScam', to: ME, value: '4299087000', block_timestamp: t0 + 60e3,
      token_info: { address: FAKE_USDT, decimals: 6, symbol: 'USDT' } },
    { transaction_id: tx('C'), type: 'Transfer', from: 'TPayer2', to: 'TSomeoneElse', value: '100000000', block_timestamp: t0,
      token_info: { address: USDT_TRC20, decimals: 6, symbol: 'USDT' } },
    { transaction_id: tx('D'), type: 'Approval', from: 'TPayer3', to: ME, value: '1', block_timestamp: t0,
      token_info: { address: USDT_TRC20, decimals: 6, symbol: 'USDT' } }
  ]
};
const parsed = parseTransfers(raw, ME);
ok(parsed.length === 1, 'only the genuine incoming USDT transfer is kept');
ok(!parsed.some((p) => p.from === 'TScam'), 'a fake token calling itself USDT is ignored');
ok(parsed[0].amount === 4299087000n && parsed[0].txid === tx('a'), 'amount and transaction ID are read correctly');
throws(() => parseTransfers({ success: false, error: 'rate limited' }, ME), 'an error response is not treated as "no payments"');

console.log('== matching ==');
const order = (id, price, amount, minutesAfter, claimed = null) => ({
  id, price: String(price), pay_amount: String(amount),
  created_at: new Date(t0 + minutesAfter * 60e3).toISOString(), claimed_txid: claimed
});
const transfer = (id, amount, minutesAfter, from = 'TPayer') =>
  ({ txid: tx(id), from, amount: toMicro(amount), ts: t0 + minutesAfter * 60e3 });

let r = matchTransfers([transfer('1', '4299.087', 5)], [order('o1', 4299, '4299.087', 0)]);
ok(r.matches.length === 1 && r.matches[0].orderId === 'o1' && r.matches[0].how === 'exact',
   'a transfer of exactly the order amount pays that order');

r = matchTransfers([transfer('1', '4299.088', 5)], [order('o1', 4299, '4299.087', 0)]);
ok(r.matches.length === 0, 'an amount off by 0.001 does not auto-match');

r = matchTransfers([transfer('1', '4299.087', -30)], [order('o1', 4299, '4299.087', 0)]);
ok(r.matches.length === 0, 'a transfer sent before the order existed does not pay it');

r = matchTransfers([transfer('1', '250.412', 5)], [order('o1', 250, '250.412', 0)], new Set([tx('1')]));
ok(r.matches.length === 0, 'a transaction already attached to an order is never reused');

r = matchTransfers(
  [transfer('1', '250.412', 5)],
  [order('o1', 250, '250.412', 0), order('o2', 250, '250.555', 1)]
);
ok(r.matches.length === 1 && r.matches[0].orderId === 'o1', 'one transfer pays one order, never two');

r = matchTransfers([transfer('1', '250.00', 5)], [order('o1', 250, '250.412', 0, tx('1'))]);
ok(r.matches.length === 1 && r.matches[0].how === 'claimed',
   'an exchange that rounded to 250.00 still matches once the customer pastes their transaction ID');

r = matchTransfers(
  [transfer('1', '250.555', 5)],
  [order('victim', 250, '250.555', 0), order('thief', 250, '250.300', 1, tx('1'))]
);
ok(r.matches.length === 1 && r.matches[0].orderId === 'victim',
   'claiming someone else\'s exact-amount payment does not work - the real owner gets it');

r = matchTransfers([transfer('1', '100', 5)], [order('o1', 250, '250.412', 0, tx('1'))]);
ok(r.matches.length === 1 && r.matches[0].amount === toMicro('100'),
   'a claimed underpayment is passed on so the database can park it for review');

r = matchTransfers(
  [transfer('1', '250.412', 5)],
  [order('a', 250, '250.412', 0), order('b', 250, '250.412', 0)]
);
ok(r.matches.length === 0 && r.skipped[0].reason === 'ambiguous amount',
   'two open orders with the same amount are left for a human rather than guessed');

console.log(`\n${pass} checks passed`);
