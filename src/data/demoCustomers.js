/**
 * SAMPLE CUSTOMERS — used only in demo mode (no Supabase keys set).
 *
 * None of this reaches the live site: once the website is connected to
 * Supabase, every customer, purchase and total comes from the real database,
 * and this file is never loaded. The site shows a "Demo" banner while it is
 * in use.
 *
 * Each purchase is [machine id, plan, days ago] (0 = today). Prices come from the machine
 * catalogue (Pro costs 6% more), so every "bought" total is a real sum of real
 * catalogue prices:
 *   Sapar   5 x S21e XP Hyd 3U 17,900 + S21 XP 5,690 + S19k Pro 1,560 + 14 TH share 250  = 97,000
 *   Baibol  M66S+ 6,120 + S19 XP 2,115 + 48 TH share 1,000 + 28 TH share 500 + 14 TH share (Pro) 265 = 10,000
 *
 * A purchase can have a 4th item for the operator screens:
 *   { sent: 530 }  the customer sent a different amount (more = a refund to send, less = needs a look)
 *   'waiting'      order placed, not paid yet
 *   'expired'      order placed, never paid
 * Those never count towards "bought".
 *
 * visibility: how they appear on the leaderboard - 'name', 'anonymous' or 'hidden'
 * referredBy: the name of the customer whose invite link they used
 */
export const VIEWER = 'Sapar';

export const DEMO_CUSTOMERS = [
  { name: 'Sapar', visibility: 'name', referredBy: null,
    purchases: [['sh-s21pro-14', 'standard', 58], ['s19kpro', 'standard', 57], ['s21e3u', 'standard', 55], ['s21xp', 'standard', 50],
      ['s21e3u', 'standard', 48], ['s21e3u', 'standard', 41], ['s21e3u', 'standard', 30], ['s21e3u', 'standard', 21]] },
  { name: 'Baibol', visibility: 'name', referredBy: 'Sapar',
    // joined today: everything was bought today, so his machines start earning tomorrow
    purchases: [['m66sp', 'standard', 0], ['s19xp', 'standard', 0], ['sh-s21xp-48', 'standard', 0],
      ['sh-s21pro-28', 'standard', 0], ['sh-s21pro-14', 'pro', 0]] },

  { name: 'Myrat Nazarov', visibility: 'name', referredBy: null, purchases: [['s21xp', 'standard', 55], ['s21pro', 'standard', 24]] },
  { name: 'Gulnara Orazova', visibility: 'name', referredBy: null, purchases: [['s21xph', 'standard', 52]] },
  { name: 'Nurmuhammet Soltanov', visibility: 'name', referredBy: null, purchases: [['s21xp', 'standard', 19], ['m60sp', 'standard', 19]] },
  { name: 'Dowran Allaberdiyev', visibility: 'anonymous', referredBy: null, purchases: [['l9', 'standard', 39], ['sh-s21pro-14', 'standard', 39]] },
  { name: 'Dovlet Hojayev', visibility: 'anonymous', referredBy: null, purchases: [['l9', 'standard', 40]] },
  { name: 'Atamyrat Babayev', visibility: 'name', referredBy: null, purchases: [['m66sp', 'standard', 22], ['s19kpro', 'standard', 22]] },
  { name: 'Rustam Saparov', visibility: 'name', referredBy: 'Sapar', purchases: [['s21pro', 'standard', 50], ['m60sp', 'standard', 15]] },
  { name: 'Maral Annayeva', visibility: 'name', referredBy: null, purchases: [['ks5pro', 'standard', 35], ['sh-s21pro-14', 'standard', 10]] },
  { name: 'Amanmyrat Durdyyev', visibility: 'anonymous', referredBy: null, purchases: [['ks5pro', 'standard', 43]] },
  { name: 'Batyr Hydyrov', visibility: 'name', referredBy: null, purchases: [['m66sp', 'pro', 27]] },
  { name: 'Oguljan Nurova', visibility: 'anonymous', referredBy: null, purchases: [['m66sp', 'standard', 25]] },
  { name: 'Kerim Berdiyev', visibility: 'name', referredBy: null, purchases: [['s21xp', 'pro', 44]] },
  { name: 'Bayram Gurbanov', visibility: 'anonymous', referredBy: null, purchases: [['m60sp', 'standard', 42], ['m50spp', 'standard', 28]] },
  { name: 'Merdan Atayev', visibility: 'name', referredBy: null, purchases: [['s21pro', 'standard', 45], ['sh-s21xp-48', 'standard', 20]] },
  { name: 'Kakajan Orazov', visibility: 'name', referredBy: 'Sapar', purchases: [['s21pro', 'standard', 46], ['sh-s21pro-28', 'standard', 13]] },
  { name: 'Serdar Meredov', visibility: 'anonymous', referredBy: null, purchases: [['s19kpro', 'standard', 49], ['m60sp', 'standard', 17]] },
  { name: 'Yhlas Amanov', visibility: 'name', referredBy: null, purchases: [['s21pro', 'pro', 37]] },
  { name: 'Arslan Myradov', visibility: 'anonymous', referredBy: null, purchases: [['s19xp', 'standard', 47], ['s19kpro', 'standard', 47]] },
  { name: 'Hojamyrat Ilyasov', visibility: 'name', referredBy: null, purchases: [['m50spp', 'standard', 34], ['sh-s21xp-48', 'standard', 9]] },
  { name: 'Resul Tagandurdyyev', visibility: 'name', referredBy: 'Rustam Saparov', purchases: [['m60sp', 'standard', 36]] },
  { name: 'Enejan Yazmuradova', visibility: 'name', referredBy: 'Gulnara Orazova', purchases: [['sh-s21xph-72', 'standard', 24], ['sh-s21xp-48', 'standard', 12]] },
  { name: 'Gozel Ovezova', visibility: 'name', referredBy: 'Merdan Atayev', purchases: [['sh-s21xp-48', 'standard', 26], ['sh-s21xph-72', 'standard', 14]] },
  { name: 'Sona Begmuradova', visibility: 'name', referredBy: null, purchases: [['sh-s21xph-72', 'standard', 21]] },
  { name: 'Leyla Rejepova', visibility: 'name', referredBy: null, purchases: [['sh-m60sp-50', 'standard', 29], ['sh-s21pro-14', 'standard', 8], ['m60sp', 'standard', 5, 'expired']] },
  { name: 'Jemal Pirliyeva', visibility: 'name', referredBy: null, purchases: [['sh-s21xp-48', 'standard', 5], ['s19kpro', 'standard', 0, 'waiting']] },
  { name: 'Ogulshirin Atayeva', visibility: 'name', referredBy: 'Merdan Atayev', purchases: [['sh-m60sp-50', 'standard', 23]] },
  { name: 'Jennet Muhammedova', visibility: 'anonymous', referredBy: null, purchases: [['sh-m60sp-50', 'standard', 16]] },
  { name: 'Dunya Sahedova', visibility: 'name', referredBy: null, purchases: [['sh-s21pro-28', 'standard', 7], ['sh-s21pro-14', 'standard', 3], ['m50spp', 'standard', 0, { sent: 2300 }]] },
  { name: 'Selbi Charyyeva', visibility: 'name', referredBy: 'Sapar', purchases: [['sh-s21pro-28', 'standard', 18]] },
  { name: 'Ayna Kakabayeva', visibility: 'name', referredBy: null, purchases: [['sh-s21pro-28', 'standard', 1, { sent: 530 }]] },
  { name: 'Bahar Garayeva', visibility: 'name', referredBy: 'Sapar', purchases: [['sh-s21pro-14', 'standard', 4]] },
  { name: 'Aysoltan Gylyjova', visibility: 'name', referredBy: null, purchases: [['sh-s21pro-14', 'standard', 2]] },
  { name: 'Mahri Hudayberdiyeva', visibility: 'hidden', referredBy: null, purchases: [['sh-s21pro-14', 'standard', 6]] }
];

/** Withdrawals already sent, and two still waiting — [name, amount, days ago, sent?] */
export const DEMO_WITHDRAWALS = [
  ['Sapar', 1200, 20, true],
  ['Gulnara Orazova', 300, 15, true],
  ['Myrat Nazarov', 150, 10, true],
  ['Kerim Berdiyev', 80, 5, true],
  ['Merdan Atayev', 60, 0.25, false],
  ['Dovlet Hojayev', 200, 0.8, false]
];
