-- =============================================================================
-- 1. Never hold a customer's money.
--
--    Machines are bought only by paying the order amount over TRC-20. The one
--    place a customer's own money could end up held was an OVERPAYMENT, which
--    used to be credited to their balance. Now it is recorded as a refund the
--    operator sends back to the paying address, exactly like a withdrawal.
--
--    Overpayments under 1 USDT are not refunded: sending them back costs more
--    in TRON network fees than the amount itself. The payment page says so.
--
-- 2. Per-machine figures for the operator console: how many sold, sales, and
--    how much profit each machine has paid its owners.
-- =============================================================================

alter table public.orders
  add column refund_due numeric(20,6) not null default 0 check (refund_due >= 0),
  add column refund_tx  text unique check (refund_tx is null or refund_tx ~ '^[0-9a-f]{64}$');

create index orders_refund_open on public.orders (paid_at) where refund_due > 0 and refund_tx is null;

create or replace function public.confirm_order_payment(
  p_order_id uuid, p_txid text, p_amount numeric, p_from text, p_paid_at timestamptz
) returns orders language plpgsql security definer set search_path = public as $$
declare
  o        orders;
  s        settings;
  v_stock  int;
  v_first  boolean;
  v_over   numeric;
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

  -- anything above the amount we asked for goes back to the sender, not into a balance
  v_over := p_amount - o.pay_amount;

  update orders
     set status = 'paid', tx_hash = lower(p_txid), paid_amount = p_amount,
         from_address = p_from, paid_at = coalesce(p_paid_at, now()), review_note = null,
         refund_due = case when v_over >= 1 then round(v_over, 6) else 0 end
   where id = o.id
  returning * into o;

  insert into holdings (user_id, machine_id, order_id, split, started_on)
  values (o.user_id, o.machine_id, o.id, o.split, (o.paid_at at time zone 'utc')::date + 1);

  select * into s from settings where id = 1;
  if v_first and s.cashback_rate > 0 then
    insert into ledger (user_id, kind, amount, order_id, note)
    values (o.user_id, 'cashback', least(o.price * s.cashback_rate, s.cashback_cap), o.id,
            'first-purchase cashback')
    on conflict do nothing;
  end if;

  perform audit('order.paid', 'order', o.id::text,
                jsonb_build_object('tx', o.tx_hash, 'amount', p_amount, 'refund_due', o.refund_due));
  return o;
end $$;

-- The operator has sent an overpayment back and records the transaction.
create or replace function public.admin_mark_refund_sent(p_order_id uuid, p_txid text)
returns orders language plpgsql security definer set search_path = public as $$
declare
  o orders;
begin
  perform require_admin();
  if p_txid !~ '^[0-9a-fA-F]{64}$' then raise exception 'transaction ID must be 64 hex characters'; end if;

  update orders set refund_tx = lower(p_txid)
   where id = p_order_id and refund_due > 0 and refund_tx is null
  returning * into o;
  if not found then raise exception 'no refund is owed on this order, or it was already sent'; end if;

  perform audit('order.refund_sent', 'order', o.id::text,
                jsonb_build_object('tx', o.refund_tx, 'amount', o.refund_due));
  return o;
end $$;

-- One row per machine: how it is selling, and what it has paid its owners.
create or replace function public.admin_machine_stats()
returns table (
  machine_id      text,
  sold            int,
  sales           numeric,
  owners          int,
  paid_to_owners  numeric,
  last_day        date,
  last_profit     numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return query
  select m.id,
         (select count(*)::int from orders o where o.machine_id = m.id and o.status = 'paid'),
         (select coalesce(sum(o.price), 0) from orders o where o.machine_id = m.id and o.status = 'paid'),
         (select count(distinct h.user_id)::int from holdings h where h.machine_id = m.id and h.active),
         (select round(coalesce(sum(l.amount), 0), 2) from ledger l join holdings h on h.id = l.holding_id
           where h.machine_id = m.id and l.kind in ('earning', 'sla_credit')),
         d.day,
         round(d.revenue - d.power_cost, 4)
    from machines m
    left join lateral (
      select r.day, r.revenue, r.power_cost from daily_results r
       where r.machine_id = m.id order by r.day desc limit 1
    ) d on true
   order by m.sort, m.id;
end $$;

-- New functions are executable by everyone by default; admin ones must not be.
revoke execute on function public.admin_mark_refund_sent(uuid, text), public.admin_machine_stats() from public, anon;
grant execute on function public.admin_mark_refund_sent(uuid, text), public.admin_machine_stats() to authenticated;

-- The overview now also counts refunds waiting to be sent.
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return jsonb_build_object(
    'users',               (select count(*) from profiles),
    'active_holdings',     (select count(*) from holdings where active),
    'sales_total',         (select coalesce(sum(price), 0) from orders where status = 'paid'),
    'open_orders',         (select count(*) from orders where status = 'awaiting_payment'),
    'needs_review',        (select count(*) from orders where status = 'needs_review'),
    'refunds_due',         (select count(*) from orders where refund_due > 0 and refund_tx is null),
    'refunds_amount',      (select coalesce(sum(refund_due), 0) from orders where refund_due > 0 and refund_tx is null),
    'pending_withdrawals', (select count(*) from withdrawals where status = 'pending'),
    'pending_amount',      (select coalesce(sum(amount), 0) from withdrawals where status = 'pending'),
    'owed_to_customers',   (select coalesce(sum(amount), 0) from ledger),
    'last_published',      (select max(day) from published_days)
  );
end $$;
