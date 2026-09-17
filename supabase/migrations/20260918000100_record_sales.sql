-- Recording a sale that was paid outside the website (cash, bank, a transfer
-- made before the site existed). The operator picks the customer, machine,
-- plan, price actually paid, how many and the date, and writes down how it was
-- paid. It becomes a paid order and a machine, exactly like a purchase made on
-- the site: it counts as "bought", and it earns from the day after the payment
-- date whenever that day's profit is published.
--
-- Nothing is invented: earnings still only come from the daily profit the
-- operator publishes, and every recorded sale is in the audit log with its note.

alter table public.orders add column recorded_note text;

create or replace function public.admin_record_sale(
  p_user      uuid,
  p_machine   text,
  p_plan      text,
  p_price     numeric,
  p_quantity  int,
  p_paid_on   date,
  p_note      text,
  p_cashback  boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s          settings;
  m          machines;
  v_today    date := (now() at time zone 'utc')::date;
  v_paid_at  timestamptz;
  v_split    numeric;
  v_first    boolean;
  v_order    orders;
  v_ids      uuid[] := '{}';
  v_cashback numeric := 0;
begin
  perform require_admin();

  if not exists (select 1 from profiles where id = p_user) then raise exception 'customer not found'; end if;
  select * into m from machines where id = p_machine for update;
  if not found then raise exception 'machine not found'; end if;
  if p_plan not in ('standard', 'pro') then raise exception 'plan must be standard or pro'; end if;
  if p_price is null or p_price <= 0 then raise exception 'enter the price that was paid for one machine'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'quantity must be 1 to 100'; end if;
  if p_paid_on is null or p_paid_on > v_today then raise exception 'the payment date cannot be in the future'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'write down how it was paid (e.g. cash on 12 July, or the transaction ID)';
  end if;
  if m.stock < p_quantity then
    raise exception 'only % in stock - raise the stock in Machines first', m.stock;
  end if;

  select * into s from settings where id = 1;
  v_split := case when p_plan = 'pro' then s.split_pro else s.split_standard end;
  -- today: now; an earlier day: midday UTC, so the machine starts the next day either way
  v_paid_at := case when p_paid_on = v_today then now()
                    else (p_paid_on::timestamp + interval '12 hours') at time zone 'utc' end;
  v_first := not exists (select 1 from orders where user_id = p_user and status = 'paid');

  for i in 1..p_quantity loop
    insert into orders (user_id, machine_id, plan, split, price, pay_amount, pay_address, status,
                        paid_amount, paid_at, created_at, expires_at, recorded_note)
    values (p_user, m.id, p_plan, v_split, round(p_price, 6), round(p_price, 6), coalesce(s.receive_address, ''), 'paid',
            round(p_price, 6), v_paid_at, v_paid_at, v_paid_at, btrim(p_note))
    returning * into v_order;

    insert into holdings (user_id, machine_id, order_id, split, started_on)
    values (p_user, m.id, v_order.id, v_split, (v_paid_at at time zone 'utc')::date + 1);

    v_ids := v_ids || v_order.id;
  end loop;

  update machines set stock = stock - p_quantity, updated_at = now() where id = m.id;

  -- the same first-purchase cashback a purchase on the site gets, only if the operator ticks it
  if p_cashback and v_first and s.cashback_rate > 0 then
    v_cashback := round(least(p_price * s.cashback_rate, s.cashback_cap), 6);
    insert into ledger (user_id, kind, amount, order_id, note)
    values (p_user, 'cashback', v_cashback, v_ids[1], 'first-purchase cashback')
    on conflict do nothing;
  end if;

  perform audit('order.recorded', 'order', v_ids[1]::text,
                jsonb_build_object('user', p_user, 'machine', m.id, 'plan', p_plan, 'price', p_price,
                                   'quantity', p_quantity, 'paid_on', p_paid_on, 'note', btrim(p_note),
                                   'cashback', v_cashback, 'orders', to_jsonb(v_ids)));

  return jsonb_build_object('orders', p_quantity, 'total', round(p_price * p_quantity, 6),
                            'cashback', v_cashback, 'starts_on', (v_paid_at at time zone 'utc')::date + 1);
end $$;

revoke all on function public.admin_record_sale(uuid, text, text, numeric, int, date, text, boolean) from public, anon;
grant execute on function public.admin_record_sale(uuid, text, text, numeric, int, date, text, boolean) to authenticated;
