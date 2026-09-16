/**
 * Database rows use snake_case and Postgres numerics; the UI and economics.js
 * use camelCase numbers. These are the only two places that translate.
 */

export const toConfig = (s) => ({
  ticker: 'USDT',
  network: 'TRC-20 (Tron)',
  receiveAddress: s.receive_address || '',
  btcHashprice: +s.btc_hashprice,
  ltcHashprice: +s.ltc_hashprice,
  kasHashprice: +s.kas_hashprice,
  powerRate: +s.power_rate,
  splitStandard: +s.split_standard,
  splitPro: +s.split_pro,
  proPremium: +s.pro_premium,
  uptimeSLA: +s.uptime_sla,
  referralShare: +s.referral_share,
  cashbackRate: +s.cashback_rate,
  cashbackCap: +s.cashback_cap,
  withdrawMin: +s.withdraw_min,
  withdrawFee: +s.withdraw_fee,
  orderTtlMinutes: +s.order_ttl_minutes
});

export const toRig = (m) => ({
  id: m.id,
  kind: m.kind,
  brand: m.brand,
  model: m.model,
  of: m.kind === 'share' ? { model: m.parent_model, hash: +m.parent_hash } : undefined,
  algo: m.algo,
  coin: m.coin,
  hash: +m.hash,
  unit: m.unit,
  watts: +m.watts,
  price: +m.price,
  cool: m.cool,
  skin: m.skin,
  site: m.site,
  stock: +m.stock,
  active: m.active,
  sort: +m.sort
});

/** UI rig -> database row, for the admin machine editor. */
export const fromRig = (r) => ({
  id: r.id,
  kind: r.kind,
  brand: r.brand,
  model: r.model,
  parent_model: r.kind === 'share' ? r.of?.model || null : null,
  parent_hash: r.kind === 'share' ? +r.of?.hash || null : null,
  algo: r.algo,
  coin: r.coin,
  hash: +r.hash,
  unit: r.unit,
  watts: +r.watts,
  price: +r.price,
  cool: r.cool,
  skin: r.skin,
  site: r.site,
  stock: +r.stock,
  active: !!r.active,
  sort: +r.sort || 0
});

export const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
export const TXID = /^[0-9a-fA-F]{64}$/;
export const tronscanTx = (tx) => `https://tronscan.org/#/transaction/${tx}`;
