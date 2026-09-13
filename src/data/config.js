/**
 * The entire economy of the platform.
 *
 * Nothing in the UI hardcodes a yield, a payout or a fee — every figure on
 * every page is derived from these constants plus a machine's nameplate
 * specs. Change a value here and the whole site moves with it.
 */
export const CONFIG = {
  ticker:        'USDT',
  network:       'TRC-20 (Tron)',

  // market
  btcHashprice:  45.20,   // USD per PH/s per day, SHA-256
  ltcHashprice:  0.95,    // USD per GH/s per day, Scrypt (incl. merged DOGE)
  kasHashprice:  0.55,    // USD per TH/s per day, kHeavyHash
  powerRate:     0.062,   // USD per kWh, hosting tariff

  // commercial terms
  splitStandard: 0.80,    // owner's share of net revenue — no lock-in
  splitPro:      0.90,    // owner's share of net revenue — costs more up front
  proPremium:    0.06,    // Pro costs this much more to buy. Without a real price
                          // difference the cheaper split is strictly worse, and the
                          // choice stops meaning anything.
  entryPrice:    250,     // cheapest share on the ladder

  // the uptime guarantee. Covers hours hashed, never the price of a hash.
  // Break-even uptime for the platform is exactly ownerSplit × uptimeSLA,
  // so 80/20 turns a loss below 77.6% and 90/10 below 87.3%.
  uptimeSLA:     0.97,
  slaFunding:    'fee',   // self-insured out of the platform fee, no reserve

  // promotions
  firstDeposit:  0.10,    // hosting credit on a first deposit
  firstDepCap:   250,
  referralShare: 0.05,    // share of the PLATFORM FEE, never of a deposit

  // withdrawals
  withdrawFee:   1.00,
  withdrawMin:   10
};
