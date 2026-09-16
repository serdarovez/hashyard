-- 1. Referrals: also return how much each invited customer has bought (paid
--    orders only) and which machines they own, so the Referrals page can show
--    what the referrer should earn from them.
-- 2. Names: at most 60 characters. A name sent along with sign-up is trimmed
--    to fit, so an oversized name can neither block a sign-up nor break the
--    daily email or the pages that show it.

-- ------------------------------------------------------------ referrals ----

drop function if exists public.my_referrals();

create function public.my_referrals()
returns table (name text, joined timestamptz, machines int, bought numeric, earned numeric, holdings jsonb)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(p.full_name, ' ', 1), ''), split_part(p.email, '@', 1)),
         p.created_at,
         (select count(*)::int from holdings h where h.user_id = p.id and h.active),
         (select coalesce(sum(o.price), 0) from orders o where o.user_id = p.id and o.status = 'paid'),
         (select coalesce(sum(l.amount), 0) from ledger l
            join holdings h on h.id = l.holding_id
           where l.kind = 'referral' and l.user_id = auth.uid() and h.user_id = p.id),
         (select coalesce(jsonb_agg(jsonb_build_object('machine_id', h.machine_id, 'split', h.split)), '[]'::jsonb)
            from holdings h where h.user_id = p.id and h.active)
    from profiles p
   where p.referred_by = auth.uid()
   order by p.created_at desc;
$$;

revoke all on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

-- ---------------------------------------------------------------- names ----

update profiles set full_name = left(btrim(full_name), 60)
 where full_name is not null and char_length(full_name) > 60;

alter table profiles
  add constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 60);

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
    left(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''), 60),
    new.raw_user_meta_data ->> 'avatar_url',
    v_code
  );
  return new;
end $$;
