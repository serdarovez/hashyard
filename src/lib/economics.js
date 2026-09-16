import { CONFIG } from '../data/config.js';

/**
 * Every function takes the config explicitly, defaulting to the shipped one.
 *
 * That is what lets the admin panel edit hashprice or the power tariff and
 * have the customer-facing pages recompute: the live config comes from React
 * context and is threaded in here, rather than these functions closing over a
 * module singleton that no re-render can see.
 */

/** Gross USD a machine mines in a day at the given hashprice. */
export function grossPerDay(rig, cfg = CONFIG) {
  if (rig.algo === 'SHA-256') return (rig.hash / 1000) * cfg.btcHashprice;
  if (rig.algo === 'kHeavyHash') return rig.hash * cfg.kasHashprice;
  return rig.hash * cfg.ltcHashprice; // Scrypt
}

/** A machine's steady-state day at a given owner split. */
export function econ(rig, share, cfg = CONFIG) {
  const gross = grossPerDay(rig, cfg);
  const power = (rig.watts / 1000) * 24 * cfg.powerRate;
  const net = gross - power;
  const you = net * share;
  return {
    gross,
    power,
    net,
    you,
    fee: net * (1 - share),
    dailyPct: (you / rig.price) * 100,
    apr: (you / rig.price) * 365 * 100,
    payback: Math.round(rig.price / you),
    viable: you > 0
  };
}

/**
 * One dated day of settlement.
 *
 * Two things move independently: `hp`, the hashprice that day, and `up`, the
 * fraction of the day the machine actually hashed. Only `up` is guaranteed - a
 * shortfall is topped up to what SLA uptime would have earned AT THAT DAY'S
 * hashprice, which keeps the liability bounded and leaves price risk with the
 * owner.
 */
export function dayEcon(day, rig, share, cfg = CONFIG) {
  const base = econ(rig, share, cfg);
  const gross = base.gross * day.hp * day.up;
  const power = base.power * day.up; // a stopped machine draws nothing
  const net = gross - power;
  const earned = net * share;
  const fullNet = base.gross * day.hp - base.power;
  const floor = fullNet * share * cfg.uptimeSLA;
  const credit = Math.max(0, floor - earned);
  return {
    ...day,
    gross,
    power,
    net,
    earned,
    credit,
    fee: net * (1 - share),
    paid: earned + credit
  };
}

/**
 * The uptime below which SLA credits cost the platform more than the fee it
 * collected that day. The algebra cancels hashprice, model and power cost:
 * only the split and the floor matter.
 */
export const breakEvenUptime = (share, cfg = CONFIG) => share * cfg.uptimeSLA;

/**
 * What a machine costs at a given split. Pro keeps more of the revenue and
 * costs more up front - that difference is the whole reason the choice exists.
 */
export function priceFor(rig, share, cfg = CONFIG) {
  return share >= cfg.splitPro ? Math.round(rig.price * (1 + cfg.proPremium)) : rig.price;
}

/** Months to earn back the purchase price at today's rate. */
export function paybackMonths(rig, share, cfg = CONFIG) {
  const e = econ(rig, share, cfg);
  if (!e.viable) return null;
  return Math.round(priceFor(rig, share, cfg) / e.you / 30.44);
}

export function efficiency(rig) {
  return rig.unit === 'TH/s'
    ? { v: (rig.watts / rig.hash).toFixed(1), u: 'J/TH' }
    : { v: (rig.watts / (rig.hash * 1000)).toFixed(2), u: 'J/MH' };
}

export function hashpriceLabel(rig, cfg = CONFIG) {
  if (rig.algo === 'SHA-256') return '$' + money(cfg.btcHashprice) + '/PH-day';
  if (rig.algo === 'kHeavyHash') return '$' + cfg.kasHashprice.toFixed(2) + '/TH-day';
  return '$' + cfg.ltcHashprice.toFixed(2) + '/GH-day';
}

export const money = (n) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const round = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** A payment amount exactly as it must be sent - every decimal kept, no thousands separators. */
export const exact = (n) => Number(n).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
