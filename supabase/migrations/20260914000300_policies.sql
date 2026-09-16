-- =============================================================================
-- Row level security.
--
-- The browser talks to the database directly with the public "anon" key, so
-- these rules ARE the security boundary. Every table has RLS on; anything not
-- explicitly allowed here is denied. Writes that move money are not allowed
-- as table writes at all - they only happen through the functions in the
-- previous migration.
-- =============================================================================

alter table public.settings       enable row level security;
alter table public.profiles       enable row level security;
alter table public.machines       enable row level security;
alter table public.orders         enable row level security;
alter table public.holdings       enable row level security;
alter table public.daily_results  enable row level security;
alter table public.published_days enable row level security;
alter table public.ledger         enable row level security;
alter table public.withdrawals    enable row level security;
alter table public.audit_log      enable row level security;
alter table public.email_log      enable row level security;

-- Start from nothing, then grant table access role by role. RLS then narrows
-- each grant down to the rows a caller may touch.
revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------- public ---
-- Anyone, signed in or not, can browse the catalogue and read the terms.
grant select on public.machines, public.settings to anon, authenticated;

create policy "catalogue is public" on public.machines
  for select using (active or public.is_admin());

create policy "terms are public" on public.settings
  for select using (true);

-- ------------------------------------------------------------- own rows ----
grant select on public.profiles, public.orders, public.holdings,
                public.ledger, public.withdrawals to authenticated;

create policy "see own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Users may edit only these three columns of their own profile. Role,
-- referral code and referrer are not in the grant, so they cannot be changed
-- from the browser even by a user editing their own row.
grant update (full_name, payout_address, email_updates) on public.profiles to authenticated;
create policy "edit own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "see own orders" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

create policy "see own holdings" on public.holdings
  for select using (user_id = auth.uid() or public.is_admin());

create policy "see own ledger" on public.ledger
  for select using (user_id = auth.uid() or public.is_admin());

create policy "see own withdrawals" on public.withdrawals
  for select using (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------ published results --
-- Customers can see the published revenue and power figures their payouts
-- were calculated from. Unpublished drafts are admin-only.
grant select on public.daily_results, public.published_days to authenticated;

create policy "see published days" on public.published_days
  for select using (true);

create policy "see published results" on public.daily_results
  for select using (
    public.is_admin()
    or exists (select 1 from public.published_days p where p.day = daily_results.day)
  );

-- ------------------------------------------------------------------ admin --
grant insert, update, delete on public.machines, public.daily_results to authenticated;
grant update on public.settings to authenticated;
grant select on public.audit_log to authenticated;

create policy "admin writes machines" on public.machines
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admin writes results" on public.daily_results
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admin edits terms" on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

create policy "admin reads audit" on public.audit_log
  for select using (public.is_admin());

-- email_log has no policies: only the service role (the email function) uses it.

-- ------------------------------------------------------------ service role --
-- Edge functions use the service role, which bypasses RLS; it still needs
-- table privileges.
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;

-- --------------------------------------------------------------- realtime --
-- Push changes to open browsers. RLS applies to realtime too, so each user
-- only receives their own rows.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.orders, public.ledger, public.withdrawals, public.machines;
  end if;
end $$;
