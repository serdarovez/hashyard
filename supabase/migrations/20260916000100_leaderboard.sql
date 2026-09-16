-- =============================================================================
-- Leaderboard
--
-- What a customer has earned is private financial information, so this never
-- exposes it with a real identity unless the person chose to:
--
--   anonymous (default) - shown as "Miner 3F9A", stable but not traceable
--   name                - shown as "Aylar K." (first name + initial, never the email)
--   hidden              - not on the board at all
--
-- The function is SECURITY DEFINER because ranking needs to read every user's
-- ledger, which row level security rightly forbids. It returns only ranks,
-- aliases and rounded totals - never an id, an email or a balance.
-- =============================================================================

create type public.leaderboard_visibility as enum ('anonymous', 'name', 'hidden');

alter table public.profiles
  add column leaderboard public.leaderboard_visibility not null default 'anonymous';

-- adding a column does not extend an existing column-level grant
grant update (full_name, payout_address, email_updates, leaderboard) on public.profiles to authenticated;

-- Earnings only: the daily share, the uptime guarantee and referral income.
-- Cashback and manual adjustments are not something you "earned mining", so
-- they would make the ranking misleading.
create or replace function public.leaderboard(p_limit int default 20)
returns table (
  place        int,
  alias        text,
  is_me        boolean,
  machines     int,
  earned_total numeric,
  earned_30d   numeric,
  joined       date
)
language sql stable security definer set search_path = public as $$
  with totals as (
    select p.id,
           p.full_name,
           p.leaderboard,
           p.created_at,
           coalesce(sum(l.amount) filter (where l.kind in ('earning', 'sla_credit', 'referral')), 0) as total,
           coalesce(sum(l.amount) filter (
             where l.kind in ('earning', 'sla_credit', 'referral')
               and l.day >= (now() at time zone 'utc')::date - 30), 0) as last30,
           (select count(*) from holdings h where h.user_id = p.id and h.active) as machines
      from profiles p
      left join ledger l on l.user_id = p.id
     where p.leaderboard <> 'hidden'
     group by p.id
  ),
  ranked as (
    select *, row_number() over (order by total desc, id) as place from totals where total > 0
  )
  select place::int,
         case
           when leaderboard = 'name' and coalesce(full_name, '') <> '' then
             split_part(full_name, ' ', 1) ||
             case when split_part(full_name, ' ', 2) <> ''
                  then ' ' || left(split_part(full_name, ' ', 2), 1) || '.' else '' end
           else 'Miner ' || upper(substr(md5(id::text), 1, 4))
         end,
         id = auth.uid(),
         machines::int,
         round(total, 2),
         round(last30, 2),
         created_at::date
    from ranked
   -- the top N, plus your own row even when you are further down
   where place <= greatest(p_limit, 1) or id = auth.uid()
   order by place;
$$;

-- Honest headline numbers for the same page.
create or replace function public.platform_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'miners',       (select count(distinct user_id) from holdings where active),
    'machines',     (select count(*) from holdings where active),
    'paid_total',   (select round(coalesce(sum(amount), 0), 2) from ledger
                      where kind in ('earning', 'sla_credit', 'referral')),
    'paid_30d',     (select round(coalesce(sum(amount), 0), 2) from ledger
                      where kind in ('earning', 'sla_credit', 'referral')
                        and day >= (now() at time zone 'utc')::date - 30),
    'days_paid',    (select count(*) from published_days)
  );
$$;

-- Readable by visitors who have not signed in: the board is anonymous by
-- default, and showing real activity is the point of having one.
grant execute on function public.leaderboard(int), public.platform_stats() to anon, authenticated;
