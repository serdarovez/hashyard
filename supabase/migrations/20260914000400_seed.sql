-- The terms row and the starting catalogue. Edit either from the admin panel
-- afterwards; this only runs once, when the database is first created.

insert into public.settings (id) values (1) on conflict do nothing;

insert into public.machines
  (id, kind, brand, model, parent_model, parent_hash, algo, coin, hash, unit, watts, price, cool, skin, site, stock, sort)
values
  ('sh-s21pro-14', 'share', 'Bitmain', 'S21 Pro / 14 TH share', 'Antminer S21 Pro', 234, 'SHA-256', 'BTC', 14, 'TH/s', 210, 250, 'Air', 'bitmain', 'Ekibastuz, KZ', 420, 10),
  ('sh-s21pro-28', 'share', 'Bitmain', 'S21 Pro / 28 TH share', 'Antminer S21 Pro', 234, 'SHA-256', 'BTC', 28, 'TH/s', 420, 500, 'Air', 'bitmain', 'Ekibastuz, KZ', 210, 20),
  ('sh-m60sp-50',  'share', 'MicroBT', 'M60S+ / 50 TH share', 'Whatsminer M60S+', 212, 'SHA-256', 'BTC', 50, 'TH/s', 821, 750, 'Air', 'microbt', 'Ekibastuz, KZ', 96, 30),
  ('sh-s21xp-48',  'share', 'Bitmain', 'S21 XP / 48 TH share', 'Antminer S21 XP', 270, 'SHA-256', 'BTC', 48, 'TH/s', 648, 1000, 'Air', 'bitmain', 'Ekibastuz, KZ', 72, 40),
  ('sh-s21xph-72', 'share', 'Bitmain', 'S21 XP Hydro / 72 TH share', 'Antminer S21 XP Hydro', 473, 'SHA-256', 'BTC', 72, 'TH/s', 864, 1500, 'Hydro', 'bitmain-h', 'Itaipu, PY', 38, 50),
  ('s19kpro',  'unit', 'Bitmain', 'Antminer S19k Pro',       null, null, 'SHA-256',    'BTC',        120, 'TH/s', 2760,  1560,  'Air',   'bitmain',   'Ekibastuz, KZ', 63, 60),
  ('s19xp',    'unit', 'Bitmain', 'Antminer S19 XP',         null, null, 'SHA-256',    'BTC',        141, 'TH/s', 3010,  2115,  'Air',   'bitmain',   'Ekibastuz, KZ', 47, 70),
  ('m50spp',   'unit', 'MicroBT', 'Whatsminer M50S++',       null, null, 'SHA-256',    'BTC',        156, 'TH/s', 3276,  2340,  'Air',   'microbt',   'Ekibastuz, KZ', 52, 80),
  ('m60sp',    'unit', 'MicroBT', 'Whatsminer M60S+',        null, null, 'SHA-256',    'BTC',        212, 'TH/s', 3479,  3180,  'Air',   'microbt',   'Ekibastuz, KZ', 41, 90),
  ('s21pro',   'unit', 'Bitmain', 'Antminer S21 Pro',        null, null, 'SHA-256',    'BTC',        234, 'TH/s', 3510,  4299,  'Air',   'bitmain',   'Ekibastuz, KZ', 34, 100),
  ('s21xp',    'unit', 'Bitmain', 'Antminer S21 XP',         null, null, 'SHA-256',    'BTC',        270, 'TH/s', 3645,  5690,  'Air',   'bitmain',   'Ekibastuz, KZ', 12, 110),
  ('m66sp',    'unit', 'MicroBT', 'Whatsminer M66S+',        null, null, 'SHA-256',    'BTC',        318, 'TH/s', 5406,  6120,  'Hydro', 'microbt-h', 'Itaipu, PY',     9, 120),
  ('ks5pro',   'unit', 'Bitmain', 'Antminer KS5 Pro',        null, null, 'kHeavyHash', 'KAS',         21, 'TH/s', 3150,  6900,  'Air',   'bitmain',   'Ekibastuz, KZ',  7, 130),
  ('l9',       'unit', 'Bitmain', 'Antminer L9',             null, null, 'Scrypt',     'LTC + DOGE',  16, 'GH/s', 3360,  8400,  'Air',   'bitmain',   'Ekibastuz, KZ',  4, 140),
  ('s21xph',   'unit', 'Bitmain', 'Antminer S21 XP Hydro',   null, null, 'SHA-256',    'BTC',        473, 'TH/s', 5676,  9850,  'Hydro', 'bitmain-h', 'Itaipu, PY',     6, 150),
  ('s21e3u',   'unit', 'Bitmain', 'Antminer S21e XP Hyd 3U', null, null, 'SHA-256',    'BTC',        860, 'TH/s', 11180, 17900, 'Hydro', 'bitmain-h', 'Itaipu, PY',     3, 160)
on conflict (id) do nothing;
