/**
 * Operator-side fixtures: the fleet, the customers, the order book and the
 * withdrawal queue. Same shape a real backend would return.
 */

export const SEED_FLEET = [
  { sn: '21P-8842-KZ', rigId: 's21pro', owner: 'Merdan A.', site: 'Ekibastuz', uptime: 0.957, temp: 64, online: true },
  { sn: '21P-9107-KZ', rigId: 's21pro', owner: 'Aylar K.', site: 'Ekibastuz', uptime: 0.994, temp: 61, online: true },
  { sn: '21X-4410-KZ', rigId: 's21xp', owner: 'Aylar K.', site: 'Ekibastuz', uptime: 0.998, temp: 59, online: true },
  { sn: 'M60-7731-KZ', rigId: 'm60sp', owner: 'Serdar M.', site: 'Ekibastuz', uptime: 0.981, temp: 67, online: true },
  { sn: 'M60-7732-KZ', rigId: 'm60sp', owner: 'pool', site: 'Ekibastuz', uptime: 0.912, temp: 71, online: true },
  { sn: '19K-2205-KZ', rigId: 's19kpro', owner: 'Jemal O.', site: 'Ekibastuz', uptime: 0.889, temp: 74, online: true },
  { sn: '21H-0071-PY', rigId: 's21xph', owner: 'pool', site: 'Itaipu', uptime: 0.999, temp: 48, online: true },
  { sn: '21H-0072-PY', rigId: 's21xph', owner: 'Merdan A.', site: 'Itaipu', uptime: 0.996, temp: 47, online: true },
  { sn: 'M66-3390-PY', rigId: 'm66sp', owner: 'pool', site: 'Itaipu', uptime: 0.643, temp: 0, online: false },
  { sn: 'L9-0512-KZ', rigId: 'l9', owner: 'Serdar M.', site: 'Ekibastuz', uptime: 0.977, temp: 69, online: true },
  { sn: 'KS5-1180-KZ', rigId: 'ks5pro', owner: 'pool', site: 'Ekibastuz', uptime: 0.968, temp: 66, online: true },
  { sn: '21E-0009-PY', rigId: 's21e3u', owner: 'pool', site: 'Itaipu', uptime: 0.991, temp: 51, online: true }
];

export const SEED_USERS = [
  { id: 'u_8841', name: 'Merdan A.', handle: 'merdan', joined: '14 Jun 2026', balance: 1284.6,
    rigs: 2, kyc: 'approved', referredBy: null },
  { id: 'u_8902', name: 'Aylar K.', handle: 'aylar', joined: '12 Jun 2026', balance: 402.15,
    rigs: 2, kyc: 'approved', referredBy: 'merdan' },
  { id: 'u_9014', name: 'Serdar M.', handle: 'serdar', joined: '03 Jul 2026', balance: 88.4,
    rigs: 2, kyc: 'approved', referredBy: 'merdan' },
  { id: 'u_9130', name: 'Jemal O.', handle: 'jemal', joined: '21 Jul 2026', balance: 12.05,
    rigs: 1, kyc: 'pending', referredBy: 'merdan' },
  { id: 'u_9288', name: 'Batyr R.', handle: 'batyr', joined: '02 Aug 2026', balance: 0,
    rigs: 0, kyc: 'none', referredBy: 'merdan' }
];

export const SEED_ORDERS = [
  { id: 'o_2291', when: '9 Sep 09:14', user: 'Aylar K.', rigId: 'sh-s21pro-28', split: 0.8, amount: 500, status: 'filled' },
  { id: 'o_2290', when: '8 Sep 17:02', user: 'Serdar M.', rigId: 'l9', split: 0.9, amount: 8400, status: 'racking' },
  { id: 'o_2289', when: '8 Sep 11:48', user: 'Jemal O.', rigId: 'sh-s21pro-14', split: 0.8, amount: 250, status: 'filled' },
  { id: 'o_2288', when: '7 Sep 20:31', user: 'Aylar K.', rigId: 's21xp', split: 0.9, amount: 5690, status: 'filled' },
  { id: 'o_2287', when: '7 Sep 08:05', user: 'Batyr R.', rigId: 'sh-m60sp-50', split: 0.8, amount: 750, status: 'cancelled' }
];

export const SEED_WITHDRAWALS = [
  { id: 'w_5512', when: '9 Sep 08:41', user: 'Merdan A.', amount: 1284.6,
    address: 'TJm5Wc2xR8pQ4nZ7bVdL3sKyH9aE6fUt1r', status: 'pending', kyc: 'approved' },
  { id: 'w_5511', when: '9 Sep 07:12', user: 'Aylar K.', amount: 12400.0,
    address: 'TWd8Fk3nQ2xV7bR1sL9cYzP4aH6eU5tJm', status: 'pending', kyc: 'approved' },
  { id: 'w_5510', when: '8 Sep 22:55', user: 'Jemal O.', amount: 60.0,
    address: 'TPq2Rn7wK4mX9hL5bV3cZsA8fD6gN1uE0', status: 'pending', kyc: 'pending' },
  { id: 'w_5509', when: '8 Sep 14:20', user: 'Serdar M.', amount: 88.4,
    address: 'TKz9Bm4xW7pN2vQ6rL8cYtA5fS3dH1uJ2', status: 'approved', kyc: 'approved' },
  { id: 'w_5508', when: '7 Sep 19:03', user: 'Aylar K.', amount: 320.0,
    address: 'TWd8Fk3nQ2xV7bR1sL9cYzP4aH6eU5tJm', status: 'sent', kyc: 'approved' }
];

/** Withdrawals over this size get a human in the loop. */
export const REVIEW_THRESHOLD = 10000;
