-- =============================================================================
-- Hashyard schema
--
-- Money model: the platform never holds customer deposits.
--   * Buying     - the customer pays the exact order amount straight to the
--                  platform's TRON address. Nothing is deposited in advance.
--   * Balance    - the sum of an append-only ledger of what they have EARNED.
--                  It is never a column anyone edits.
--   * Withdrawal - a request. An admin sends the USDT by hand and records the
--                  transaction hash.
-- =============================================================================

create type public.user_role         as enum ('user', 'admin');
create type public.machine_kind      as enum ('share', 'unit');
create type public.order_status      as enum ('awaiting_payment', 'paid', 'expired', 'cancelled', 'needs_review');
create type public.withdrawal_status as enum ('pending', 'sent', 'rejected');
create type public.ledger_kind       as enum (
  'earning',              -- daily owner share of a machine's net revenue
  'sla_credit',           -- uptime-guarantee top-up
  'referral',             -- share of the platform fee on a referred user's machine
  'cashback',             -- first-purchase rebate
  'overpayment',          -- customer paid more than the order asked
  'withdrawal',           -- money leaving the balance (negative)
  'withdrawal_reversal',  -- a rejected withdrawal coming back
  'adjustment'            -- manual correction by an admin
);

-- ---------------------------------------------------------------- settings --
-- One row. Commercial terms plus the inputs used for catalogue ESTIMATES.
-- Real payouts come from daily_results, not from these hashprices.
create table public.settings (
  id               int primary key default 1 check (id = 1),
  receive_address  text not null default '',
  split_standard   numeric(5,4) not null default 0.80 check (split_standard between 0 and 1),
  split_pro        numeric(5,4) not null default 0.90 check (split_pro between 0 and 1),
  pro_premium      numeric(5,4) not null default 0.06 check (pro_premium >= 0),
  uptime_sla       numeric(5,4) not null default 0.97 check (uptime_sla between 0 and 1),
  referral_share   numeric(5,4) not null default 0.05 check (referral_share between 0 and 1),
  cashback_rate    numeric(5,4) not null default 0.10 check (cashback_rate between 0 and 1),
  cashback_cap     numeric(20,6) not null default 250 check (cashback_cap >= 0),
  withdraw_min     numeric(20,6) not null default 20 check (withdraw_min >= 0),
  withdraw_fee     numeric(20,6) not null default 1 check (withdraw_fee >= 0),
  order_ttl_minutes int not null default 60 check (order_ttl_minutes between 5 and 1440),
  btc_hashprice    numeric(12,4) not null default 45.20,
  ltc_hashprice    numeric(12,4) not null default 0.95,
  kas_hashprice    numeric(12,4) not null default 0.55,
  power_rate       numeric(8,4)  not null default 0.062,
  last_scan_at     timestamptz,
  updated_at       timestamptz not null default now(),
  constraint receive_address_format
    check (receive_address = '' or receive_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$')
);

-- ---------------------------------------------------------------- profiles --
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  role            public.user_role not null default 'user',
  payout_address  text check (payout_address is null or payout_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'),
  referral_code   text not null unique,
  referred_by     uuid references public.profiles (id),
  email_updates   boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint no_self_referral check (referred_by is null or referred_by <> id)
);

-- ---------------------------------------------------------------- machines --
create table public.machines (
  id           text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  kind         public.machine_kind not null,
  brand        text not null,
  model        text not null,
  parent_model text,
  parent_hash  numeric,
  algo         text not null check (algo in ('SHA-256', 'Scrypt', 'kHeavyHash')),
  coin         text not null,
  hash         numeric not null check (hash > 0),
  unit         text not null check (unit in ('TH/s', 'GH/s')),
  watts        int not null check (watts > 0),
  price        numeric(20,6) not null check (price > 0),
  cool         text not null default 'Air' check (cool in ('Air', 'Hydro')),
  skin         text not null default 'bitmain',
  site         text not null default '',
  stock        int not null default 0 check (stock >= 0),
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint share_has_parent check (kind = 'unit' or (parent_model is not null and parent_hash > 0))
);

-- ------------------------------------------------------------------ orders --
create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id),
  machine_id    text not null references public.machines (id),
  plan          text not null check (plan in ('standard', 'pro')),
  split         numeric(5,4) not null,
  price         numeric(20,6) not null check (price > 0),
  -- price plus a small unique fingerprint, so an incoming transfer of exactly
  -- this amount identifies the order without per-order addresses
  pay_amount    numeric(20,6) not null check (pay_amount >= price),
  pay_address   text not null,
  status        public.order_status not null default 'awaiting_payment',
  claimed_txid  text check (claimed_txid is null or claimed_txid ~ '^[0-9a-fA-F]{64}$'),
  tx_hash       text unique,
  paid_amount   numeric(20,6),
  from_address  text,
  review_note   text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  paid_at       timestamptz
);
create index orders_user on public.orders (user_id, created_at desc);
create index orders_open on public.orders (status, created_at) where status in ('awaiting_payment', 'expired');
create index orders_amount_recent on public.orders (pay_amount, created_at);

-- ---------------------------------------------------------------- holdings --
create table public.holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id),
  machine_id  text not null references public.machines (id),
  order_id    uuid not null unique references public.orders (id),
  split       numeric(5,4) not null,
  started_on  date not null,          -- the first day that earns
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index holdings_user on public.holdings (user_id);
create index holdings_active on public.holdings (machine_id) where active;

-- ----------------------------------------------------------- daily results --
-- Entered by an admin from the pool payout and the power bill, per unit of
-- each machine. Payouts are computed from these, never typed in directly, so
-- every customer figure traces back to two numbers you can show.
create table public.daily_results (
  day         date not null,
  machine_id  text not null references public.machines (id) on delete cascade,
  revenue     numeric(20,6) not null check (revenue >= 0),
  power_cost  numeric(20,6) not null check (power_cost >= 0),
  uptime      numeric(5,4) not null default 1 check (uptime between 0 and 1),
  note        text,
  entered_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now(),
  primary key (day, machine_id)
);

create table public.published_days (
  day           date primary key,
  published_at  timestamptz not null default now(),
  published_by  uuid references public.profiles (id),
  holdings_paid int not null default 0,
  total_paid    numeric(20,6) not null default 0
);

-- ------------------------------------------------------------------ ledger --
create table public.ledger (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id),
  kind           public.ledger_kind not null,
  amount         numeric(20,6) not null,
  day            date,
  holding_id     uuid references public.holdings (id),
  order_id       uuid references public.orders (id),
  withdrawal_id  uuid,
  note           text,
  created_at     timestamptz not null default now()
);
create index ledger_user on public.ledger (user_id, created_at desc);
create index ledger_day on public.ledger (day);
-- settlement is idempotent: re-publishing a day updates rows instead of adding
create unique index ledger_settle_once on public.ledger (kind, holding_id, day)
  where kind in ('earning', 'sla_credit', 'referral');
create unique index ledger_cashback_once on public.ledger (user_id) where kind = 'cashback';

-- ------------------------------------------------------------- withdrawals --
create table public.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id),
  amount        numeric(20,6) not null check (amount > 0),
  fee           numeric(20,6) not null default 0 check (fee >= 0),
  address       text not null,
  status        public.withdrawal_status not null default 'pending',
  tx_hash       text unique,
  admin_note    text,
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz,
  processed_by  uuid references public.profiles (id)
);
create index withdrawals_status on public.withdrawals (status, requested_at);
create unique index withdrawals_one_pending on public.withdrawals (user_id) where status = 'pending';

alter table public.ledger
  add constraint ledger_withdrawal_fk foreign key (withdrawal_id) references public.withdrawals (id);

-- ------------------------------------------------------------------- audit --
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null,
  entity     text,
  entity_id  text,
  detail     jsonb,
  at         timestamptz not null default now()
);
create index audit_at on public.audit_log (at desc);

create table public.email_log (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, day)
);
