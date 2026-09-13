/**
 * Real nameplate specs. Two kinds of product:
 *
 *   share - a hashrate slice of a machine already racked. Priced at the
 *           parent's per-terahash rate and carrying the same proportion of its
 *           power draw, so a share returns exactly what the whole unit returns.
 *           This is what lets the ladder start at 250 USDT: no ASIC costs that
 *           little, but a sixteenth of one does.
 *   unit  - the whole machine, racked under the buyer's name.
 */
export const RIGS = [
  // ---- shares: the entry ladder, 250 -> 1500 ----
  { id: 'sh-s21pro-14', kind: 'share', brand: 'Bitmain', model: 'S21 Pro / 14 TH share',
    of: { model: 'Antminer S21 Pro', hash: 234 }, algo: 'SHA-256', coin: 'BTC',
    hash: 14, unit: 'TH/s', watts: 210, price: 250, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 420 },
  { id: 'sh-s21pro-28', kind: 'share', brand: 'Bitmain', model: 'S21 Pro / 28 TH share',
    of: { model: 'Antminer S21 Pro', hash: 234 }, algo: 'SHA-256', coin: 'BTC',
    hash: 28, unit: 'TH/s', watts: 420, price: 500, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 210 },
  { id: 'sh-m60sp-50', kind: 'share', brand: 'MicroBT', model: 'M60S+ / 50 TH share',
    of: { model: 'Whatsminer M60S+', hash: 212 }, algo: 'SHA-256', coin: 'BTC',
    hash: 50, unit: 'TH/s', watts: 821, price: 750, cool: 'Air', skin: 'microbt',
    site: 'Ekibastuz, KZ', stock: 96 },
  { id: 'sh-s21xp-48', kind: 'share', brand: 'Bitmain', model: 'S21 XP / 48 TH share',
    of: { model: 'Antminer S21 XP', hash: 270 }, algo: 'SHA-256', coin: 'BTC',
    hash: 48, unit: 'TH/s', watts: 648, price: 1000, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 72 },
  { id: 'sh-s21xph-72', kind: 'share', brand: 'Bitmain', model: 'S21 XP Hydro / 72 TH share',
    of: { model: 'Antminer S21 XP Hydro', hash: 473 }, algo: 'SHA-256', coin: 'BTC',
    hash: 72, unit: 'TH/s', watts: 864, price: 1500, cool: 'Hydro', skin: 'bitmain-h',
    site: 'Itaipu, PY', stock: 38 },

  // ---- whole units, 1560 -> 17900 ----
  { id: 's19kpro', kind: 'unit', brand: 'Bitmain', model: 'Antminer S19k Pro', algo: 'SHA-256', coin: 'BTC',
    hash: 120, unit: 'TH/s', watts: 2760, price: 1560, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 63 },
  { id: 's19xp', kind: 'unit', brand: 'Bitmain', model: 'Antminer S19 XP', algo: 'SHA-256', coin: 'BTC',
    hash: 141, unit: 'TH/s', watts: 3010, price: 2115, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 47 },
  { id: 'm50spp', kind: 'unit', brand: 'MicroBT', model: 'Whatsminer M50S++', algo: 'SHA-256', coin: 'BTC',
    hash: 156, unit: 'TH/s', watts: 3276, price: 2340, cool: 'Air', skin: 'microbt',
    site: 'Ekibastuz, KZ', stock: 52 },
  { id: 'm60sp', kind: 'unit', brand: 'MicroBT', model: 'Whatsminer M60S+', algo: 'SHA-256', coin: 'BTC',
    hash: 212, unit: 'TH/s', watts: 3479, price: 3180, cool: 'Air', skin: 'microbt',
    site: 'Ekibastuz, KZ', stock: 41 },
  { id: 's21pro', kind: 'unit', brand: 'Bitmain', model: 'Antminer S21 Pro', algo: 'SHA-256', coin: 'BTC',
    hash: 234, unit: 'TH/s', watts: 3510, price: 4299, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 34 },
  { id: 's21xp', kind: 'unit', brand: 'Bitmain', model: 'Antminer S21 XP', algo: 'SHA-256', coin: 'BTC',
    hash: 270, unit: 'TH/s', watts: 3645, price: 5690, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 12 },
  { id: 'm66sp', kind: 'unit', brand: 'MicroBT', model: 'Whatsminer M66S+', algo: 'SHA-256', coin: 'BTC',
    hash: 318, unit: 'TH/s', watts: 5406, price: 6120, cool: 'Hydro', skin: 'microbt-h',
    site: 'Itaipu, PY', stock: 9 },
  { id: 'ks5pro', kind: 'unit', brand: 'Bitmain', model: 'Antminer KS5 Pro', algo: 'kHeavyHash', coin: 'KAS',
    hash: 21, unit: 'TH/s', watts: 3150, price: 6900, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 7 },
  { id: 'l9', kind: 'unit', brand: 'Bitmain', model: 'Antminer L9', algo: 'Scrypt', coin: 'LTC + DOGE',
    hash: 16, unit: 'GH/s', watts: 3360, price: 8400, cool: 'Air', skin: 'bitmain',
    site: 'Ekibastuz, KZ', stock: 4 },
  { id: 's21xph', kind: 'unit', brand: 'Bitmain', model: 'Antminer S21 XP Hydro', algo: 'SHA-256', coin: 'BTC',
    hash: 473, unit: 'TH/s', watts: 5676, price: 9850, cool: 'Hydro', skin: 'bitmain-h',
    site: 'Itaipu, PY', stock: 6 },
  { id: 's21e3u', kind: 'unit', brand: 'Bitmain', model: 'Antminer S21e XP Hyd 3U', algo: 'SHA-256', coin: 'BTC',
    hash: 860, unit: 'TH/s', watts: 11180, price: 17900, cool: 'Hydro', skin: 'bitmain-h',
    site: 'Itaipu, PY', stock: 3 },

];

export const byId = (id) => RIGS.find((r) => r.id === id);
