import { CONFIG } from './config.js';
import { byId } from './catalog.js';
import { dayEcon, econ } from '../lib/economics.js';

/**
 * Demo account and the trading week.
 *
 * Anything that depends on the config is a BUILDER, not a constant, because
 * the admin panel can change the config at runtime. The provider calls these
 * inside a useMemo keyed on the live config.
 */
export const ME = {
  name: 'Merdan A.',
  handle: 'merdan',
  initials: 'MA',
  joined: 'June 2026',
  balance: 1284.6,
  credit: 186.4,
  address: 'TQr7Vd4kK9mYh2PnLxJ6cWzA8fS3bNuE5g',
  payoutAddress: 'TJm5Wc2xR8pQ4nZ7bVdL3sKyH9aE6fUt1r',
  owned: { rigId: 's21pro', share: CONFIG.splitStandard, days: 34, qty: 1, serial: '21P-8842-KZ' },
  invites: [
    { n: 'Aylar K.', i: 'AK', since: '12 Jun', rigs: 2, earned: 41.8, live: true },
    { n: 'Serdar M.', i: 'SM', since: '03 Jul', rigs: 1, earned: 17.25, live: true },
    { n: 'Jemal O.', i: 'JO', since: '21 Jul', rigs: 1, earned: 9.4, live: true },
    { n: 'Batyr R.', i: 'BR', since: '02 Aug', rigs: 0, earned: 0, live: false }
  ]
};

/**
 * `hp` is the hashprice multiplier for that day, `up` the fraction of hours
 * the machine actually hashed. Thursday is a real outage: the day the uptime
 * guarantee pays.
 */
export const WEEK = [
  { d: 'Mon', date: '3 Sep', hp: 0.94, up: 1.0, note: 'Normal' },
  { d: 'Tue', date: '4 Sep', hp: 1.02, up: 1.0, note: 'Normal' },
  { d: 'Wed', date: '5 Sep', hp: 0.97, up: 0.998, note: 'Pool reconnect, 3 min' },
  { d: 'Thu', date: '6 Sep', hp: 1.07, up: 0.712, note: 'Hashboard 2 fault - swapped 16:40' },
  { d: 'Fri', date: '7 Sep', hp: 0.99, up: 1.0, note: 'Normal' },
  { d: 'Sat', date: '8 Sep', hp: 1.03, up: 0.991, note: 'Firmware update, 13 min' },
  { d: 'Sun', date: '9 Sep', hp: 1.0, up: 1.0, note: 'Normal' }
];

export const REF_TOTAL = ME.invites.reduce((a, b) => a + b.earned, 0);

/** Everything the customer pages need, recomputed whenever the config moves. */
export function buildAccount(cfg) {
  const myRig = byId(ME.owned.rigId);
  const myEcon = econ(myRig, ME.owned.share, cfg);
  const series = WEEK.map((d) => dayEcon(d, myRig, ME.owned.share, cfg));
  const weekTotal = series.reduce((a, b) => a + b.paid, 0);
  const weekCredit = series.reduce((a, b) => a + b.credit, 0);
  const weekUptime = series.reduce((a, b) => a + b.up, 0) / series.length;
  const lifetime = myEcon.you * ME.owned.days;
  return { myRig, myEcon, series, weekTotal, weekCredit, weekUptime, lifetime, tx: buildTx(series, cfg) };
}

export function buildTx(series, cfg) {
  return [
    { t: 'payout', on: 'earn', d: 'Today, 00:07', amt: series[6].paid, note: 'S21 Pro daily settlement' },
    { t: 'payout', on: 'earn', d: '8 Sep, 00:07', amt: series[5].paid, note: 'S21 Pro daily settlement' },
    { t: 'referral', on: 'earn', d: '8 Sep, 00:07', amt: 1.42, note: 'Aylar K. revenue share' },
    { t: 'payout', on: 'earn', d: '7 Sep, 00:07', amt: series[4].paid, note: 'S21 Pro daily settlement' },
    { t: 'credit', on: 'earn', d: '6 Sep, 00:07', amt: series[3].credit,
      note: `Uptime credit, SLA ${Math.round(cfg.uptimeSLA * 100)}%` },
    { t: 'payout', on: 'earn', d: '6 Sep, 00:07', amt: series[3].earned, note: 'S21 Pro daily settlement' },
    { t: 'withdraw', on: 'chain', d: '4 Sep, 18:22', amt: -320, note: 'TJm5...Ut1r', hash: 'a3f907...c21b' },
    { t: 'payout', on: 'earn', d: '4 Sep, 00:07', amt: series[1].paid, note: 'S21 Pro daily settlement' },
    { t: 'purchase', on: 'buy', d: '6 Aug, 11:04', amt: -4299, note: 'Antminer S21 Pro, 80/20 split' },
    { t: 'bonus', on: 'earn', d: '6 Aug, 10:58', amt: 250, note: 'First-deposit hosting credit' },
    { t: 'deposit', on: 'chain', d: '6 Aug, 10:52', amt: 5400, note: 'TQr7...NuE5g', hash: '7b1ec4...9f04' }
  ];
}

export const TX_LABEL = {
  payout: 'Daily payout',
  credit: 'Uptime credit',
  referral: 'Referral share',
  bonus: 'Deposit bonus',
  deposit: 'Deposit',
  withdraw: 'Withdrawal',
  purchase: 'Machine purchase'
};
