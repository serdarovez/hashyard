-- =============================================================================
-- Functions. Everything that moves money runs here, inside one transaction,
-- with row locks - never as several calls from the browser.
--
-- Access is controlled by EXECUTE grants at the bottom of this file:
--   * user functions      -> authenticated
--   * admin_* functions   -> authenticated, and each checks is_admin() itself
--   * payment / settlement -> service_role only (edge functions and cron)
-- =============================================================================

-- ---------------------------------------------------------------- helpers --

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
end $$;

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_detail);
$$;

create or replace function public.balance_of(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::numeric(20,6) from ledger where user_id = p_user;
$$;

create or replace function public.my_balance()
returns numeric language sql stable security definer set search_path = public as $$
  select public.balance_of(auth.uid());
$$;

-- Estimated full-uptime net revenue for one unit, from the settings hashprices.
-- Only used as the SLA fallback when a machine hashed zero hours that day.
create or replace function public.estimated_full_net(p_machine machines, s settings)
returns numeric language sql immutable as $$
  select (
    case p_machine.algo
      when 'SHA-256'    then p_machine.hash / 1000 * s.btc_hashprice
      when 'kHeavyHash' then p_machine.hash * s.kas_hashprice
      else                   p_machine.hash * s.ltc_hashprice
    end
    - p_machine.watts / 1000.0 * 24 * s.power_rate
  );
$$;

-- --------------------------------------------------------------- new users --

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  loop
    -- 8 characters from an alphabet without look-alikes (no 0/O/1/I)
    v_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from profiles where referral_code = v_code);
  end loop;

  insert into profiles (id, email, full_name, avatar_url, referral_code)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_code
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A referral can be attached once, and only before the user's first purchase.
create or replace function public.set_referrer(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ref uuid;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;

  select id into v_ref from profiles where referral_code = upper(trim(p_code));
  if v_ref is null or v_ref = v_uid then return false; end if;

  if exists (select 1 from orders where user_id = v_uid and status = 'paid') then
    return false;
  end if;

  update profiles set referred_by = v_ref where id = v_uid and referred_by is null;
  return found;
end $$;

-- ------------------------------------------------------------------ orders --

create or replace function public.create_order(p_machine_id text, p_plan text)
returns orders language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  s         settings;
  m         machines;
  v_split   numeric;
  v_price   numeric;
  v_amount  numeric;
  v_try     int := 0;
  v_scale   int := 1000;
  o         orders;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_plan not in ('standard', 'pro') then raise exception 'unknown plan %', p_plan; end if;

  select * into s from settings where id = 1;
  if coalesce(s.receive_address, '') = '' then
    raise exception 'payments are not set up yet';
  end if;

  if (select count(*) from orders where user_id = v_uid and status = 'awaiting_payment') >= 3 then
    raise exception 'you already have 3 unpaid orders - pay or wait for them to expire';
  end if;

  -- lock the machine so two buyers cannot take the last unit
  select * into m from machines where id = p_machine_id for update;
  if not found or not m.active then raise exception 'this machine is not for sale'; end if;
  if m.stock < 1 then raise exception 'sold out'; end if;

  -- price is computed here, never taken from the browser
  if p_plan = 'pro' then
    v_split := s.split_pro;
    v_price := round(m.price * (1 + s.pro_premium));
  else
    v_split := s.split_standard;
    v_price := m.price;
  end if;

  -- unique amount: price + 0.001..0.999, not reused for 7 days so a late
  -- payment can never be mistaken for a newer order. Falls back to four
  -- decimals if a price point ever runs out of three-decimal slots.
  loop
    v_try := v_try + 1;
    if v_try > 40 then raise exception 'too many open orders at this price, try again shortly'; end if;
    if v_try > 20 then v_scale := 10000; end if;
    v_amount := v_price + (1 + floor(random() * (v_scale - 1)))::numeric / v_scale;
    exit when not exists (
      select 1 from orders where pay_amount = v_amount and created_at > now() - interval '7 days'
    );
  end loop;

  update machines set stock = stock - 1, updated_at = now() where id = m.id;

  insert into orders (user_id, machine_id, plan, split, price, pay_amount, pay_address, expires_at)
  values (v_uid, m.id, p_plan, v_split, v_price, v_amount, s.receive_address,
          now() + make_interval(mins => s.order_ttl_minutes))
  returning * into o;

  perform audit('order.create', 'order', o.id::text,
                jsonb_build_object('machine', m.id, 'plan', p_plan, 'price', v_price, 'amount', v_amount));
  return o;
end $$;

create or replace function public.cancel_order(p_order_id uuid)
returns orders language plpgsql security definer set search_path = public as $$
declare
  o orders;
begin
  select * into o from orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'order not found'; end if;
  if o.status <> 'awaiting_payment' then raise exception 'only an unpaid order can be cancelled'; end if;

  update orders set status = 'cancelled' where id = o.id returning * into o;
  update machines set stock = stock + 1, updated_at = now() where id = o.machine_id;
  return o;
end $$;

-- The customer says "I paid, here is my transaction ID". The payment scanner
-- verifies it against the chain on its next pass.
create or replace function public.claim_payment(p_order_id uuid, p_txid text)
returns orders language plpgsql security definer set search_path = public as $$
declare
  o orders;
begin
  if p_txid !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'that does not look like a TRON transaction ID (64 characters, 0-9 and a-f)';
  end if;
  update orders set claimed_txid = lower(p_txid)
   where id = p_order_id and user_id = auth.uid() and status in ('awaiting_payment', 'expired')
  returning * into o;
  if not found then raise exception 'order not found or already paid'; end if;
  return o;
end $$;

-- Release stock held by unpaid orders past their deadline.
create or replace function public.expire_orders()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  with gone as (
    update orders set status = 'expired'
     where status = 'awaiting_payment' and expires_at < now()
    returning machine_id
  ), per_machine as (
    select machine_id, count(*) as c from gone group by machine_id
  ), restock as (
    update machines m set stock = m.stock + p.c, updated_at = now()
      from per_machine p where m.id = p.machine_id
    returning 1
  )
  select count(*) into n from gone;
  return n;
end $$;

-- Called by the payment scanner once a matching transfer is confirmed on-chain.
-- Idempotent: confirming the same order with the same transaction twice is a no-op.
create or replace function public.confirm_order_payment(
  p_order_id uuid, p_txid text, p_amount numeric, p_from text, p_paid_at timestamptz
) returns orders language plpgsql security definer set search_path = public as $$
declare
  o        orders;
  s        settings;
  v_stock  int;
  v_first  boolean;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'order % not found', p_order_id; end if;

  if o.status = 'paid' then
    if o.tx_hash = lower(p_txid) then return o; end if;
    raise exception 'order % already paid by a different transaction', p_order_id;
  end if;

  if exists (select 1 from orders where tx_hash = lower(p_txid)) then
    raise exception 'transaction % is already attached to another order', p_txid;
  end if;

  if p_amount < o.price then
    update orders set status = 'needs_review', tx_hash = lower(p_txid), paid_amount = p_amount,
                      from_address = p_from, review_note = 'underpaid'
     where id = o.id returning * into o;
    perform audit('order.underpaid', 'order', o.id::text, jsonb_build_object('amount', p_amount));
    return o;
  end if;

  -- a late payment on an expired order still needs a unit to be available
  if o.status in ('expired', 'cancelled') then
    select stock into v_stock from machines where id = o.machine_id for update;
    if v_stock < 1 then
      update orders set status = 'needs_review', tx_hash = lower(p_txid), paid_amount = p_amount,
                        from_address = p_from, review_note = 'paid after expiry, sold out - refund or restock'
       where id = o.id returning * into o;
      perform audit('order.late_no_stock', 'order', o.id::text, jsonb_build_object('amount', p_amount));
      return o;
    end if;
    update machines set stock = stock - 1, updated_at = now() where id = o.machine_id;
  end if;

  v_first := not exists (select 1 from orders where user_id = o.user_id and status = 'paid');

  update orders
     set status = 'paid', tx_hash = lower(p_txid), paid_amount = p_amount,
         from_address = p_from, paid_at = coalesce(p_paid_at, now()), review_note = null
   where id = o.id
  returning * into o;

  insert into holdings (user_id, machine_id, order_id, split, started_on)
  values (o.user_id, o.machine_id, o.id, o.split, (o.paid_at at time zone 'utc')::date + 1);

  if p_amount - o.pay_amount > 0.01 then
    insert into ledger (user_id, kind, amount, order_id, note)
    values (o.user_id, 'overpayment', p_amount - o.pay_amount, o.id, 'paid more than the order amount');
  end if;

  select * into s from settings where id = 1;
  if v_first and s.cashback_rate > 0 then
    insert into ledger (user_id, kind, amount, order_id, note)
    values (o.user_id, 'cashback', least(o.price * s.cashback_rate, s.cashback_cap), o.id,
            'first-purchase cashback')
    on conflict do nothing;
  end if;

  perform audit('order.paid', 'order', o.id::text,
                jsonb_build_object('tx', o.tx_hash, 'amount', p_amount));
  return o;
end $$;

-- --------------------------------------------------------------- settlement --

-- Pays every active holding for one day from that day's daily_results.
-- Safe to run again after correcting a result: rows are updated, not added.
create or replace function public.settle_day(p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s        settings;
  r        record;
  v_net    numeric;
  v_owner  numeric;
  v_fee    numeric;
  v_credit numeric;
  v_ref    numeric;
  v_count  int := 0;
  v_total  numeric := 0;
begin
  select * into s from settings where id = 1;

  for r in
    select h.id as holding_id, h.user_id, h.split, p.referred_by,
           d.revenue, d.power_cost, d.uptime, m as machine
      from holdings h
      join daily_results d on d.machine_id = h.machine_id and d.day = p_day
      join machines m on m.id = h.machine_id
      join profiles p on p.id = h.user_id
     where h.active and h.started_on <= p_day
  loop
    v_net   := r.revenue - r.power_cost;
    -- a day where power cost more than the machine mined pays nothing;
    -- the loss is the platform's, which is what pushes you to switch it off
    v_owner := greatest(v_net, 0) * r.split;
    v_fee   := greatest(v_net, 0) - v_owner;

    -- Uptime guarantee. Net scales linearly with hours hashed, so the
    -- full-day net is net / uptime and the shortfall to the SLA floor is
    -- split * net * (sla / uptime - 1). It covers lost HOURS only: a low
    -- price day is never topped up.
    v_credit := 0;
    if r.uptime < s.uptime_sla then
      if r.uptime > 0 and v_net > 0 then
        v_credit := r.split * v_net * (s.uptime_sla / r.uptime - 1);
      elsif r.uptime = 0 then
        v_credit := greatest(estimated_full_net(r.machine, s), 0) * r.split * s.uptime_sla;
      end if;
    end if;

    v_ref := case when r.referred_by is not null then v_fee * s.referral_share else 0 end;

    insert into ledger (user_id, kind, amount, day, holding_id, note)
    values (r.user_id, 'earning', round(v_owner, 6), p_day, r.holding_id, 'daily earnings')
    on conflict (kind, holding_id, day) where kind in ('earning', 'sla_credit', 'referral')
    do update set amount = excluded.amount;

    if v_credit > 0 then
      insert into ledger (user_id, kind, amount, day, holding_id, note)
      values (r.user_id, 'sla_credit', round(v_credit, 6), p_day, r.holding_id, 'uptime guarantee')
      on conflict (kind, holding_id, day) where kind in ('earning', 'sla_credit', 'referral')
      do update set amount = excluded.amount;
    else
      delete from ledger where kind = 'sla_credit' and holding_id = r.holding_id and day = p_day;
    end if;

    if v_ref > 0 then
      insert into ledger (user_id, kind, amount, day, holding_id, note)
      values (r.referred_by, 'referral', round(v_ref, 6), p_day, r.holding_id, 'referral share')
      on conflict (kind, holding_id, day) where kind in ('earning', 'sla_credit', 'referral')
      do update set amount = excluded.amount, user_id = excluded.user_id;
    else
      delete from ledger where kind = 'referral' and holding_id = r.holding_id and day = p_day;
    end if;

    v_count := v_count + 1;
    v_total := v_total + v_owner + v_credit;
  end loop;

  insert into published_days (day, published_by, holdings_paid, total_paid)
  values (p_day, auth.uid(), v_count, round(v_total, 6))
  on conflict (day) do update
    set published_at = now(), published_by = excluded.published_by,
        holdings_paid = excluded.holdings_paid, total_paid = excluded.total_paid;

  perform audit('day.publish', 'day', p_day::text,
                jsonb_build_object('holdings', v_count, 'total', round(v_total, 6)));
  return jsonb_build_object('day', p_day, 'holdings', v_count, 'total', round(v_total, 6));
end $$;

-- ------------------------------------------------------------- withdrawals --

create or replace function public.request_withdrawal(p_amount numeric)
returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  p      profiles;
  s      settings;
  w      withdrawals;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;

  -- lock the profile: two simultaneous requests cannot both pass the balance check
  select * into p from profiles where id = v_uid for update;
  select * into s from settings where id = 1;

  if p.payout_address is null then
    raise exception 'add your TRON wallet address before withdrawing';
  end if;
  if p_amount is null or p_amount < s.withdraw_min then
    raise exception 'the minimum withdrawal is % USDT', s.withdraw_min;
  end if;
  if p_amount > public.balance_of(v_uid) then
    raise exception 'that is more than your balance';
  end if;
  if exists (select 1 from withdrawals where user_id = v_uid and status = 'pending') then
    raise exception 'you already have a withdrawal waiting to be sent';
  end if;

  insert into withdrawals (user_id, amount, fee, address)
  values (v_uid, p_amount, s.withdraw_fee, p.payout_address)
  returning * into w;

  insert into ledger (user_id, kind, amount, withdrawal_id, note)
  values (v_uid, 'withdrawal', -p_amount, w.id, 'withdrawal request');

  perform audit('withdrawal.request', 'withdrawal', w.id::text, jsonb_build_object('amount', p_amount));
  return w;
end $$;

-- ------------------------------------------------------------------- admin --

create or replace function public.admin_mark_withdrawal_sent(p_id uuid, p_txid text)
returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  w withdrawals;
begin
  perform require_admin();
  if p_txid !~ '^[0-9a-fA-F]{64}$' then raise exception 'transaction ID must be 64 hex characters'; end if;

  update withdrawals
     set status = 'sent', tx_hash = lower(p_txid), processed_at = now(), processed_by = auth.uid()
   where id = p_id and status = 'pending'
  returning * into w;
  if not found then raise exception 'withdrawal not found or already processed'; end if;

  perform audit('withdrawal.sent', 'withdrawal', w.id::text, jsonb_build_object('tx', w.tx_hash));
  return w;
end $$;

create or replace function public.admin_reject_withdrawal(p_id uuid, p_reason text)
returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  w withdrawals;
begin
  perform require_admin();
  update withdrawals
     set status = 'rejected', admin_note = p_reason, processed_at = now(), processed_by = auth.uid()
   where id = p_id and status = 'pending'
  returning * into w;
  if not found then raise exception 'withdrawal not found or already processed'; end if;

  -- the money goes back to the balance
  insert into ledger (user_id, kind, amount, withdrawal_id, note)
  values (w.user_id, 'withdrawal_reversal', w.amount, w.id, coalesce(p_reason, 'withdrawal rejected'));

  perform audit('withdrawal.rejected', 'withdrawal', w.id::text, jsonb_build_object('reason', p_reason));
  return w;
end $$;

create or replace function public.admin_publish_day(p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_day >= (now() at time zone 'utc')::date then
    raise exception 'you can only publish a day that has finished';
  end if;
  return public.settle_day(p_day);
end $$;

-- For a payment you verified by hand (e.g. the customer sent the wrong amount).
create or replace function public.admin_confirm_order(p_order_id uuid, p_txid text, p_amount numeric)
returns orders language plpgsql security definer set search_path = public as $$
declare
  o orders;
begin
  perform require_admin();
  -- clear a previous review so the order can be confirmed against the price
  update orders set status = case when status = 'needs_review' then 'awaiting_payment'::order_status else status end,
                    tx_hash = case when status = 'needs_review' then null else tx_hash end
   where id = p_order_id;
  o := public.confirm_order_payment(p_order_id, p_txid, p_amount, null, now());
  perform audit('order.manual_confirm', 'order', p_order_id::text, jsonb_build_object('tx', p_txid, 'amount', p_amount));
  return o;
end $$;

-- A machine with buyers cannot be deleted - it is hidden from sale instead.
create or replace function public.admin_remove_machine(p_id text)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if exists (select 1 from orders where machine_id = p_id) then
    update machines set active = false, updated_at = now() where id = p_id;
    perform audit('machine.hide', 'machine', p_id, null);
    return 'hidden';
  end if;
  delete from machines where id = p_id;
  perform audit('machine.delete', 'machine', p_id, null);
  return 'deleted';
end $$;

create or replace function public.admin_adjust_balance(p_user uuid, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if coalesce(trim(p_note), '') = '' then raise exception 'say why - it is shown to the customer'; end if;
  insert into ledger (user_id, kind, amount, note) values (p_user, 'adjustment', p_amount, p_note);
  perform audit('balance.adjust', 'profile', p_user::text, jsonb_build_object('amount', p_amount, 'note', p_note));
end $$;

create or replace function public.admin_users()
returns table (id uuid, email text, full_name text, role user_role, created_at timestamptz,
               referred_by_email text, holdings int, balance numeric, paid_total numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.full_name, p.role, p.created_at,
         r.email,
         (select count(*)::int from holdings h where h.user_id = p.id and h.active),
         public.balance_of(p.id),
         (select coalesce(sum(o.price), 0) from orders o where o.user_id = p.id and o.status = 'paid')
    from profiles p
    left join profiles r on r.id = p.referred_by
   where public.is_admin()
   order by p.created_at desc;
$$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return jsonb_build_object(
    'users',              (select count(*) from profiles),
    'active_holdings',    (select count(*) from holdings where active),
    'sales_total',        (select coalesce(sum(price), 0) from orders where status = 'paid'),
    'open_orders',        (select count(*) from orders where status = 'awaiting_payment'),
    'needs_review',       (select count(*) from orders where status = 'needs_review'),
    'pending_withdrawals',(select count(*) from withdrawals where status = 'pending'),
    'pending_amount',     (select coalesce(sum(amount), 0) from withdrawals where status = 'pending'),
    'owed_to_customers',  (select coalesce(sum(amount), 0) from ledger),
    'last_published',     (select max(day) from published_days)
  );
end $$;

-- What a signed-in user earned from the people they referred.
create or replace function public.my_referrals()
returns table (name text, joined timestamptz, machines int, earned numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(split_part(p.full_name, ' ', 1), split_part(p.email, '@', 1)),
         p.created_at,
         (select count(*)::int from holdings h where h.user_id = p.id and h.active),
         (select coalesce(sum(l.amount), 0) from ledger l
            join holdings h on h.id = l.holding_id
           where l.kind = 'referral' and l.user_id = auth.uid() and h.user_id = p.id)
    from profiles p
   where p.referred_by = auth.uid()
   order by p.created_at desc;
$$;

-- --------------------------------------------------------- audit triggers --

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor, action, entity, entity_id, detail)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(
      case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'id',
      case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'machine_id'
    ),
    jsonb_build_object('old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                       'new', case when tg_op <> 'DELETE' then to_jsonb(new) end)
  );
  return coalesce(new, old);
end $$;

create trigger audit_machines after insert or update or delete on public.machines
  for each row execute function public.audit_row();
create trigger audit_daily_results after insert or update or delete on public.daily_results
  for each row execute function public.audit_row();
create trigger audit_settings after update on public.settings
  for each row execute function public.audit_row();

-- ------------------------------------------------------------------ grants --
-- Postgres lets PUBLIC execute every function by default. Take that away and
-- grant each function to exactly the role that should call it.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_admin(),
  public.my_balance(),
  public.set_referrer(text),
  public.create_order(text, text),
  public.cancel_order(uuid),
  public.claim_payment(uuid, text),
  public.request_withdrawal(numeric),
  public.my_referrals(),
  public.admin_mark_withdrawal_sent(uuid, text),
  public.admin_reject_withdrawal(uuid, text),
  public.admin_publish_day(date),
  public.admin_confirm_order(uuid, text, numeric),
  public.admin_remove_machine(text),
  public.admin_adjust_balance(uuid, numeric, text),
  public.admin_users(),
  public.admin_overview()
to authenticated;

-- Row-level policies call is_admin() for every visitor, signed in or not. It
-- simply returns false for anonymous callers, so this grant is safe.
grant execute on function public.is_admin() to anon;

grant execute on function
  public.expire_orders(),
  public.confirm_order_payment(uuid, text, numeric, text, timestamptz),
  public.settle_day(date),
  public.balance_of(uuid)
to service_role;
