-- =============================================================================
-- Leaderboard, ranked by deposits.
--
-- The platform takes no deposits in the usual sense - customers pay for
-- machines directly - so "deposited" is the total a customer has paid for
-- machines: the price of every PAID order. Unpaid, expired, cancelled and
-- under-review orders never count, so the board cannot be inflated by
-- orders nobody paid for.
--
-- Privacy is unchanged from the first version: anonymous by default, a name
-- only if the customer opts in, and no id, email or balance ever returned.
-- =============================================================================

-- the return type changes, so the old function has to go first
drop function if exists public.leaderboard(int);

create or replace function public.leaderboard(p_period text default 'all', p_limit int default 20)
returns table (
  place            int,
  alias            text,
  is_me            boolean,
  machines         int,
  deposited        numeric,
  deposited_total  numeric,
  earned_total     numeric,
  joined           date
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_since timestamptz;
begin
  if p_period not in ('all', '30d') then
    raise exception 'period must be all or 30d';
  end if;
  v_since := case when p_period = '30d' then now() - interval '30 days' else '-infinity'::timestamptz end;

  return query
  with people as (
    select p.id, p.full_name, p.leaderboard, p.created_at,
           (select coalesce(sum(o.price), 0) from orders o
             where o.user_id = p.id and o.status = 'paid') as dep_all,
           (select coalesce(sum(o.price), 0) from orders o
             where o.user_id = p.id and o.status = 'paid' and o.paid_at >= v_since) as dep_period,
           (select coalesce(sum(l.amount), 0) from ledger l
             where l.user_id = p.id and l.kind in ('earning', 'sla_credit', 'referral')) as earned,
           (select count(*) from holdings h where h.user_id = p.id and h.active) as n_machines
      from profiles p
     where p.leaderboard <> 'hidden'
  ),
  ranked as (
    select *, row_number() over (order by dep_period desc, dep_all desc, id) as rn
      from people
     where dep_period > 0
  )
  select r.rn::int,
         case
           when r.leaderboard = 'name' and coalesce(r.full_name, '') <> '' then
             split_part(r.full_name, ' ', 1) ||
             case when split_part(r.full_name, ' ', 2) <> ''
                  then ' ' || left(split_part(r.full_name, ' ', 2), 1) || '.' else '' end
           else 'Miner ' || upper(substr(md5(r.id::text), 1, 4))
         end,
         r.id = auth.uid(),
         r.n_machines::int,
         round(r.dep_period, 2),
         round(r.dep_all, 2),
         round(r.earned, 2),
         r.created_at::date
    from ranked r
   -- the top N, plus your own row even when you are further down
   where r.rn <= greatest(p_limit, 1) or r.id = auth.uid()
   order by r.rn;
end $$;

create or replace function public.platform_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'deposited_total', (select round(coalesce(sum(price), 0), 2) from orders where status = 'paid'),
    'deposited_30d',   (select round(coalesce(sum(price), 0), 2) from orders
                         where status = 'paid' and paid_at >= now() - interval '30 days'),
    'buyers',          (select count(distinct user_id) from orders where status = 'paid'),
    'miners',          (select count(distinct user_id) from holdings where active),
    'machines',        (select count(*) from holdings where active),
    'paid_total',      (select round(coalesce(sum(amount), 0), 2) from ledger
                         where kind in ('earning', 'sla_credit', 'referral')),
    'paid_30d',        (select round(coalesce(sum(amount), 0), 2) from ledger
                         where kind in ('earning', 'sla_credit', 'referral')
                           and day >= (now() at time zone 'utc')::date - 30),
    'days_paid',       (select count(*) from published_days)
  );
$$;

grant execute on function public.leaderboard(text, int), public.platform_stats() to anon, authenticated;
