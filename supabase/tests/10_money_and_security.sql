-- Test suite: every path that moves money, and every security rule.
-- Runs against a scratch Postgres after 00_supabase_stub.sql and the migrations.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ------------------------------------------------------------- helpers ------
create schema test;
grant usage on schema test to public;

create function test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok   %', msg;
end $$;

create function test.near(a numeric, b numeric, msg text) returns void language plpgsql as $$
begin
  if a is null or abs(a - b) > 0.000002 then
    raise exception 'FAIL: % (got %, expected %)', msg, a, b;
  end if;
  raise notice 'ok   % (%)', msg, round(a, 6);
end $$;

-- run a statement that must fail; optionally with a specific SQLSTATE
create function test.fails(q text, code text, msg text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'FAIL (no error raised): %', msg;
exception when others then
  if sqlerrm like 'FAIL (no error raised)%' then raise; end if;
  if code is not null and sqlstate <> code then
    raise exception 'FAIL: % - expected sqlstate %, got % (%)', msg, code, sqlstate, sqlerrm;
  end if;
  raise notice 'ok   % -> "%"', msg, sqlerrm;
end $$;

create function test.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;

-- Supabase sets the identity per request, so switching to the anon role in a
-- real client carries no user. The stub keeps session state, so clear it.
create function test.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

grant execute on all functions in schema test to public;

\set ADMIN '00000000-0000-0000-0000-00000000000a'
\set ALICE '00000000-0000-0000-0000-000000000001'
\set BOB   '00000000-0000-0000-0000-000000000002'
\set ADDR  'TQrY8tryqsYVCYS3MFbtffiPp2ccyn4STm'
\set TX1   aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
\set TX2   bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
\set TX3   cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
\set TX4   dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
\set TX5   eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
\set TX6   ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
\set TX7   1111111111111111111111111111111111111111111111111111111111111111

\echo
\echo '== sign-up =='
insert into auth.users (id, email, raw_user_meta_data) values
  (:'ADMIN', 'owner@example.com', '{"full_name":"Owner"}'),
  (:'ALICE', 'alice@example.com', '{"full_name":"Alice Karim"}'),
  (:'BOB',   'bob@example.com',   '{"name":"Bob"}');
select test.ok((select count(*) from profiles) = 3, 'Google sign-up trigger creates a profile per user');
select test.ok((select count(distinct referral_code) from profiles) = 3, 'each user gets a unique referral code');
begin;
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000ff', 'long@example.com', json_build_object('full_name', '  ' || repeat('y', 200))::jsonb);
select test.ok((select full_name from profiles where email = 'long@example.com') = repeat('y', 60),
               'an oversized name sent at sign-up is trimmed to 60 characters instead of blocking the sign-up');
rollback;
update profiles set role = 'admin' where id = :'ADMIN';   -- the one-off SQL the owner runs
select referral_code as alice_code from profiles where id = :'ALICE' \gset

\echo
\echo '== anonymous visitors =='
set role anon;
select test.ok((select count(*) from machines) = 16, 'anonymous visitors can browse all 16 machines');
select test.fails('select * from orders', '42501', 'anonymous visitors cannot read orders');
select test.fails('select * from ledger', '42501', 'anonymous visitors cannot read the ledger');
reset role;

\echo
\echo '== admin sets up payments =='
set role authenticated; select test.as_user(:'ADMIN');
update settings set receive_address = :'ADDR';
reset role;
select test.ok((select receive_address from settings) = :'ADDR', 'admin can set the receiving wallet');

set role authenticated; select test.as_user(:'ALICE');
update settings set split_standard = 0.99;
reset role;
select test.ok((select split_standard from settings) = 0.80, 'a normal user cannot change the terms');

\echo
\echo '== profiles =='
set role authenticated; select test.as_user(:'ALICE');
select test.fails($q$update profiles set role = 'admin' where id = auth.uid()$q$, '42501',
                  'a user cannot make themselves admin');
select test.fails($q$update profiles set referral_code = 'HACKED' where id = auth.uid()$q$, '42501',
                  'a user cannot change their referral code');
update profiles set payout_address = :'ADDR' where id = auth.uid();
select test.ok((select payout_address from profiles where id = auth.uid()) = :'ADDR',
               'a user can save their own payout wallet');
select test.fails($q$update profiles set payout_address = 'not-a-tron-address' where id = auth.uid()$q$, '23514',
                  'a malformed TRON address is rejected');
select test.ok((select count(*) from profiles) = 1, 'a user sees only their own profile');
select test.fails(format('update profiles set full_name = %L where id = auth.uid()', repeat('x', 61)), '23514',
                  'a name longer than 60 characters is refused');
reset role;

set role authenticated; select test.as_user(:'BOB');
select test.ok(set_referrer(:'alice_code'), 'Bob joins through Alice''s referral code');
select test.ok(not set_referrer(:'alice_code'), 'a referral cannot be attached twice');
reset role;

\echo
\echo '== buying =='
set role authenticated; select test.as_user(:'ALICE');
select o.id as order1, o.pay_amount as amt1, o.price as price1 from create_order('s21pro', 'standard') o \gset
select test.ok(:price1 = 4299, 'the Standard price is the catalogue price');
select test.ok(:amt1 > 4299 and :amt1 < 4300, 'the amount to pay carries a unique fingerprint (' || :amt1 || ')');
select test.ok((select count(*) from orders) = 1, 'Alice sees her own order');
select test.fails(format('select confirm_order_payment(%L::uuid, %L, %s, null, now())', :'order1', :'TX1', :amt1),
                  '42501', 'a customer cannot mark their own order as paid');
reset role;
select test.ok((select stock from machines where id = 's21pro') = 33, 'ordering reserves one unit of stock');

set role authenticated; select test.as_user(:'BOB');
select o.price as pro_price from create_order('s21pro', 'pro') o \gset
select test.ok(:pro_price = 4557, 'the Pro price is 6% more, matching the website (4557)');
select test.ok((select count(*) from orders) = 1, 'Bob cannot see Alice''s order');
select o.id as bob_share, o.pay_amount as bob_amt from create_order('sh-s21pro-14', 'standard') o \gset
select test.fails($q$select create_order('s21pro', 'nonsense')$q$, null, 'an unknown plan is rejected');
select test.fails($q$select create_order('does-not-exist', 'standard')$q$, null, 'an unknown machine is rejected');
reset role;

\echo
\echo '== payment confirmed on-chain (service role) =='
set role service_role;
select status as s1 from confirm_order_payment(:'order1', :'TX1', :amt1, 'TSenderAddress', '2026-09-01 10:00+00') \gset
select test.ok(:'s1' = 'paid', 'a matching transfer marks the order paid');
select status as s1b from confirm_order_payment(:'order1', :'TX1', :amt1, 'TSenderAddress', '2026-09-01 10:00+00') \gset
select test.ok(:'s1b' = 'paid', 'confirming the same transfer twice is harmless');
select test.fails(format('select confirm_order_payment(%L::uuid, %L, %s, null, now())', :'bob_share', :'TX1', :bob_amt),
                  null, 'one transfer cannot pay for two orders');
select status as s2 from confirm_order_payment(:'bob_share', :'TX2', :bob_amt, 'TBobWallet', '2026-09-01 11:00+00') \gset
reset role;
select test.ok((select count(*) from holdings where order_id = :'order1') = 1, 'exactly one holding is created');
select test.ok((select started_on from holdings where order_id = :'order1') = '2026-09-02',
               'the machine starts earning from the next full day');
select test.near((select amount from ledger where user_id = :'ALICE' and kind = 'cashback'), 250,
                 'first-purchase cashback is 10% capped at 250');

\echo
\echo '== underpayment and late payment =='
set role authenticated; select test.as_user(:'BOB');
select o.id as under_id from create_order('s19xp', 'standard') o \gset
reset role;
set role service_role;
select status as su from confirm_order_payment(:'under_id', :'TX3', 100, 'TBob', now()) \gset
reset role;
select test.ok(:'su' = 'needs_review', 'an underpaid order goes to review instead of being fulfilled');
select test.ok((select count(*) from holdings where order_id = :'under_id') = 0, 'no machine is assigned for an underpayment');

set role authenticated; select test.as_user(:'BOB');
select o.id as late_id, o.pay_amount as late_amt from create_order('m60sp', 'standard') o \gset
reset role;
update orders set expires_at = now() - interval '1 minute' where id = :'late_id';
set role service_role;
select expire_orders() as expired \gset
reset role;
select test.ok(:expired >= 1, 'expired orders are swept');
select test.ok((select stock from machines where id = 'm60sp') = 41, 'expiring an order releases its stock');
set role service_role;
select status as sl from confirm_order_payment(:'late_id', :'TX4', :late_amt, 'TBob', now()) \gset
reset role;
select test.ok(:'sl' = 'paid', 'a late payment is still honoured while stock remains');
select test.ok((select stock from machines where id = 'm60sp') = 40, 'and it takes the stock back');

\echo
\echo '== cancelling and order limits =='
set role authenticated; select test.as_user(:'ALICE');
select o.id as c1 from create_order('s21xp', 'standard') o \gset
select status as cs from cancel_order(:'c1') \gset
select test.ok(:'cs' = 'cancelled', 'a customer can cancel an unpaid order');
select create_order('s21xp', 'standard') \gset
select create_order('s21xp', 'standard') \gset
select create_order('s21xp', 'standard') \gset
select test.fails($q$select create_order('s21xp', 'standard')$q$, null, 'a customer is limited to 3 unpaid orders');
reset role;
select test.ok((select stock from machines where id = 's21xp') = 9, 'stock is right after cancel + 3 open orders (12 - 3)');

\echo
\echo '== daily results and payouts =='
-- Normal day. Figures are per unit of an Antminer S21 Pro and of the 14 TH share.
set role authenticated; select test.as_user(:'ADMIN');
insert into daily_results (day, machine_id, revenue, power_cost, uptime) values
  ('2026-09-02', 's21pro',       10.5768,  5.22288,  1.0),
  ('2026-09-02', 'sh-s21pro-14', 0.6328,   0.31248,  1.0),
  -- Thursday outage: the machine hashed 71.2% of the day
  ('2026-09-06', 's21pro',       8.057829, 3.718691, 0.712);
reset role;

set role authenticated; select test.as_user(:'ALICE');
select test.ok((select count(*) from daily_results) = 0, 'customers cannot see unpublished figures');
select test.fails($q$select admin_publish_day('2026-09-02')$q$, '42501', 'a customer cannot publish a day');
select test.fails($q$insert into daily_results values ('2026-09-03','s21pro',99,0,1)$q$, '42501',
                  'a customer cannot enter results');
reset role;

set role authenticated; select test.as_user(:'ADMIN');
select test.fails(format('select admin_publish_day(%L)', (now() at time zone 'utc')::date), null,
                  'today cannot be published before it has finished');
select admin_publish_day('2026-09-02') as pub \gset
reset role;

-- (10.5768 - 5.22288) * 0.80
select test.near((select amount from ledger where user_id = :'ALICE' and kind = 'earning' and day = '2026-09-02'),
                 4.283136, 'S21 Pro owner earns (revenue - power) x 80%');
-- (0.6328 - 0.31248) * 0.80
select test.near((select amount from ledger where user_id = :'BOB' and kind = 'earning' and day = '2026-09-02'),
                 0.256256, 'the 14 TH share earns the same way');
-- platform fee on Bob's share is 0.064064; Alice gets 5% of it
select test.near((select amount from ledger where user_id = :'ALICE' and kind = 'referral' and day = '2026-09-02'),
                 0.0032032, 'Alice earns 5% of the platform fee on Bob''s machine');
select test.ok((select count(*) from ledger where kind = 'sla_credit' and day = '2026-09-02') = 0,
               'a full-uptime day pays no guarantee credit');

set role authenticated; select test.as_user(:'ADMIN');
select admin_publish_day('2026-09-02') \gset
reset role;
select test.ok((select count(*) from ledger where kind = 'earning' and day = '2026-09-02') = 2,
               'publishing a day twice does not pay twice');

set role authenticated; select test.as_user(:'ADMIN');
update daily_results set revenue = 11.0 where day = '2026-09-02' and machine_id = 's21pro';
select admin_publish_day('2026-09-02') \gset
reset role;
select test.near((select amount from ledger where user_id = :'ALICE' and kind = 'earning' and day = '2026-09-02'),
                 (11.0 - 5.22288) * 0.8, 're-publishing after a correction updates the payout instead of adding one');

set role authenticated; select test.as_user(:'ADMIN');
select admin_publish_day('2026-09-06') \gset
reset role;
select test.near((select amount from ledger where user_id = :'ALICE' and kind = 'earning' and day = '2026-09-06'),
                 3.4713104, 'outage day: owner earns on the hours actually hashed');
-- website model for the same day gave a 1.26 credit; exact: 0.8 * 4.339138 * (0.97/0.712 - 1)
select test.near((select amount from ledger where user_id = :'ALICE' and kind = 'sla_credit' and day = '2026-09-06'),
                 0.8 * (8.057829 - 3.718691) * (0.97 / 0.712 - 1),
                 'outage day: uptime guarantee tops up the missing hours (matches the website: 1.26)');

set role authenticated; select test.as_user(:'ALICE');
select test.ok((select count(*) from daily_results) = 3, 'after publishing, customers can see the figures behind their payout');
reset role;

\echo
\echo '== withdrawals =='
select balance_of(:'ALICE') as alice_before \gset
set role authenticated; select test.as_user(:'ALICE');
select test.near(my_balance(), :alice_before, 'my_balance() matches the ledger');
select test.fails($q$select request_withdrawal(10)$q$, null, 'a withdrawal below the 20 USDT minimum is refused');
select test.fails(format('select request_withdrawal(%s)', :alice_before + 1), null, 'you cannot withdraw more than your balance');
select w.id as w1 from request_withdrawal(100) w \gset
select test.near(my_balance(), :alice_before - 100, 'requesting a withdrawal takes it out of the balance at once');
select test.fails($q$select request_withdrawal(20)$q$, null, 'only one withdrawal can wait at a time');
select test.fails(format('select admin_mark_withdrawal_sent(%L::uuid, %L)', :'w1', :'TX1'), '42501',
                  'a customer cannot mark their own withdrawal as sent');
reset role;

set role authenticated; select test.as_user(:'BOB');
select test.fails($q$select request_withdrawal(20)$q$, null, 'no payout wallet saved means no withdrawal');
select test.ok((select count(*) from withdrawals) = 0, 'Bob cannot see Alice''s withdrawal');
reset role;

set role authenticated; select test.as_user(:'ADMIN');
select status as wr from admin_reject_withdrawal(:'w1', 'please verify your wallet') \gset
reset role;
select test.ok(:'wr' = 'rejected', 'the admin can reject a withdrawal');
select test.near(balance_of(:'ALICE'), :alice_before, 'a rejected withdrawal returns the money to the balance');

set role authenticated; select test.as_user(:'ALICE');
select w.id as w2 from request_withdrawal(100) w \gset
reset role;
set role authenticated; select test.as_user(:'ADMIN');
select test.fails(format('select admin_mark_withdrawal_sent(%L::uuid, %L)', :'w2', 'nope'), null,
                  'a malformed transaction ID is refused');
select status as ws from admin_mark_withdrawal_sent(:'w2', :'TX2') \gset
select test.fails(format('select admin_mark_withdrawal_sent(%L::uuid, %L)', :'w2', :'TX3'), null,
                  'a withdrawal cannot be sent twice');
reset role;
select test.ok(:'ws' = 'sent', 'the admin records the transaction hash once it is sent');
select test.near(balance_of(:'ALICE'), :alice_before - 100, 'after sending, the balance stays reduced');

\echo
\echo '== admin tools =='
set role authenticated; select test.as_user(:'ADMIN');
insert into machines (id, kind, brand, model, algo, coin, hash, unit, watts, price, stock)
values ('test-rig', 'unit', 'Test', 'Test Rig', 'SHA-256', 'BTC', 100, 'TH/s', 2000, 999, 5);
select test.ok(admin_remove_machine('test-rig') = 'deleted', 'a machine nobody bought is deleted');
select test.ok(admin_remove_machine('s21pro') = 'hidden', 'a machine with buyers is hidden, not deleted');
select test.ok((admin_overview() ->> 'users')::int = 3, 'the overview counts users');
select test.ok((select count(*) from admin_users()) = 3, 'the admin sees every customer');
select test.ok((select count(*) from audit_log) > 0, 'admin actions are written to the audit log');
update machines set active = true where id = 's21pro';
reset role;

select coalesce(sum(price), 0) as bob_bought from orders where user_id = :'BOB' and status = 'paid' \gset
select count(*) as bob_rigs from holdings where user_id = :'BOB' and active \gset
select test.ok(:bob_bought > 0, 'Bob has bought something for the referral check');
set role authenticated; select test.as_user(:'ALICE');
select test.fails($q$select admin_overview()$q$, '42501', 'a customer cannot open the admin overview');
select test.ok((select count(*) from admin_users()) = 0, 'a customer gets no rows from the customer list');
select test.ok((select count(*) from my_referrals()) = 1, 'Alice sees Bob in her referrals');
select test.near((select earned from my_referrals()), 0.0032032, 'with what she earned from him');
select test.near((select bought from my_referrals()), :bob_bought, 'with how much he bought (paid orders only)');
select test.ok((select jsonb_array_length(holdings) from my_referrals()) = :bob_rigs, 'and the machines he owns, for the estimate');
reset role;

\echo
\echo '== leaderboard: ranked by deposits =='
-- By this point in the suite: Alice paid 4299 for an S21 Pro (and has one
-- cancelled and three unpaid orders). Bob paid 250 for a share and 3180 for an
-- M60S+, and has one UNDERPAID order sitting in review. None of the unpaid or
-- under-review orders may count.
select test.ok((select count(*) from leaderboard()) = 2, 'both customers who paid for machines are listed');
select test.near((select deposited_total from leaderboard() where place = 1), 4299,
                 'deposits count only paid orders - cancelled and unpaid orders are ignored');
select test.near((select deposited_total from leaderboard() where place = 2), 3430,
                 'an underpaid order still under review does not count as a deposit');
select test.ok((select deposited from leaderboard() where place = 1)
             > (select deposited from leaderboard() where place = 2), 'the biggest depositor ranks first');
select test.ok((select machines from leaderboard() where place = 2) = 2, 'machine counts are shown');
select test.near((select earned_total from leaderboard() where place = 1), 9.35,
                 'earnings are shown alongside, excluding the 250 cashback');
select test.ok((select alias from leaderboard() where place = 1) like 'Miner %', 'people are anonymous by default');
select test.ok((select alias from leaderboard() where place = 1) !~* 'alice|example.com',
               'the anonymous alias leaks neither name nor email');

-- the 30-day view: Bob's M60S+ was paid today, so it must count whatever date the suite runs on
select test.ok((select deposited from leaderboard('30d') where deposited_total = 3430) >= 3180,
               'the 30-day view counts a purchase paid today');
select test.ok(not exists (select 1 from leaderboard('30d') where deposited > deposited_total),
               'the 30-day figure never exceeds the all-time one');
select test.fails($q$select * from leaderboard('forever')$q$, null, 'an unknown period is refused');

set role authenticated; select test.as_user(:'ALICE');
update profiles set leaderboard = 'name' where id = auth.uid();
select test.ok((select alias from leaderboard() where is_me) = 'Alice K.', 'opting in shows first name and initial, never the surname');
select test.ok((select count(*) from leaderboard() where is_me) = 1, 'you can see which row is yours');
reset role;

set role authenticated; select test.as_user(:'BOB');
select test.ok((select count(*) from leaderboard(p_limit => 1)) = 2 and
               (select count(*) from leaderboard(p_limit => 1) where is_me) = 1,
               'your own row is included even outside the top');
update profiles set leaderboard = 'hidden' where id = auth.uid();
select test.ok((select count(*) from leaderboard()) = 1, 'hiding takes you off the board entirely');
update profiles set leaderboard = 'anonymous' where id = auth.uid();
-- row level security makes this match no rows rather than raise: the update
-- succeeds and changes nothing, which is the outcome that matters
update profiles set leaderboard = 'hidden' where id <> auth.uid();
reset role;
select test.ok((select leaderboard from profiles where id = :'ALICE') = 'name',
               'a customer cannot change someone else''s leaderboard setting');

select test.as_anon();
set role anon;
select test.ok((select count(*) from leaderboard()) = 2, 'visitors who are not signed in can see the board');
select test.ok((select count(*) from leaderboard() where is_me) = 0, 'and no row is marked as theirs');
select test.near((platform_stats() ->> 'deposited_total')::numeric, 7729, 'the total deposited is public: 4299 + 3430');
select test.ok((platform_stats() ->> 'buyers')::int = 2, 'as is the number of buyers');
reset role;

\echo '== overpayments are refunded, never held =='
select id as ov_id, pay_amount as ov_amt from orders
 where user_id = :'ALICE' and status = 'awaiting_payment' order by created_at limit 1 \gset
select balance_of(:'ALICE') as bal_before \gset
set role service_role;
select status as ov_status, refund_due as ov_refund
  from confirm_order_payment(:'ov_id', :'TX5', :ov_amt + 25, 'TAliceWallet', now()) \gset
reset role;
select test.ok(:'ov_status' = 'paid', 'an overpaid order is still fulfilled');
select test.near(:ov_refund, 25, 'the extra 25 USDT is recorded as a refund owed to the sender');
select test.near(balance_of(:'ALICE'), :bal_before, 'the overpayment is NOT added to the customer''s balance');
select test.ok(not exists (select 1 from ledger where kind = 'overpayment'), 'no customer money ever enters the ledger');

select id as small_id, pay_amount as small_amt from orders
 where user_id = :'ALICE' and status = 'awaiting_payment' order by created_at limit 1 \gset
set role service_role;
select refund_due as small_refund from confirm_order_payment(:'small_id', :'TX6', :small_amt + 0.5, 'TAliceWallet', now()) \gset
reset role;
select test.near(:small_refund, 0, 'under 1 USDT is not refunded - the network fee would exceed it');

set role authenticated; select test.as_user(:'ALICE');
select test.fails(format('select admin_mark_refund_sent(%L::uuid, %L)', :'ov_id', :'TX7'), '42501',
                  'a customer cannot mark their own refund as sent');
reset role;
set role authenticated; select test.as_user(:'ADMIN');
select (admin_overview() ->> 'refunds_due')::int as refunds_open \gset
select test.ok(:refunds_open = 1, 'the admin overview shows one refund to send');
select test.fails(format('select admin_mark_refund_sent(%L::uuid, %L)', :'ov_id', 'nope'), null,
                  'a malformed refund transaction ID is refused');
select refund_tx as rtx from admin_mark_refund_sent(:'ov_id', :'TX7') \gset
select test.ok(:'rtx' = :'TX7', 'the admin records the refund transaction');
select test.fails(format('select admin_mark_refund_sent(%L::uuid, %L)', :'ov_id', :'TX7'), null,
                  'a refund cannot be marked sent twice');
select test.fails(format('select admin_mark_refund_sent(%L::uuid, %L)', :'small_id', :'TX7'), null,
                  'an order with nothing owed cannot be refunded');

\echo
\echo '== per-machine figures for the admin =='
select test.ok((select sold from admin_machine_stats() where machine_id = 's21xp') = 2, 'machines sold are counted');
select test.near((select sales from admin_machine_stats() where machine_id = 's21xp'), 11380, 'sales per machine add up');
select test.near((select paid_to_owners from admin_machine_stats() where machine_id = 's21pro'), 9.35,
                 'profit paid to owners per machine (earnings + guarantee, not referrals)');
select test.ok((select last_day from admin_machine_stats() where machine_id = 's21pro') = '2026-09-06',
               'the latest published day is shown');
reset role;
set role authenticated; select test.as_user(:'ALICE');
select test.fails($q$select * from admin_machine_stats()$q$, '42501', 'a customer cannot see per-machine sales');
reset role;
select test.as_anon();
set role anon;
select test.fails($q$select * from admin_machine_stats()$q$, '42501', 'nor can a visitor');
reset role;

\echo
\echo '== sales paid outside the site =='
\set DANA  '00000000-0000-0000-0000-000000000009'
insert into auth.users (id, email, raw_user_meta_data) values (:'DANA', 'dana@example.com', '{"full_name":"Dana"}');
select stock as s21e_before from machines where id = 's21e3u' \gset
select (current_date - 20) as paid_day \gset

set role authenticated; select test.as_user(:'ALICE');
select test.fails(format('select admin_record_sale(%L::uuid, %L, %L, 17900, 1, %L::date, %L)', :'DANA', 's21e3u', 'standard', :'paid_day', 'cash'),
                  '42501', 'a customer cannot record a sale');
reset role;

set role authenticated; select test.as_user(:'ADMIN');
select test.fails(format('select admin_record_sale(%L::uuid, %L, %L, 17900, 1, %L::date, %L)', :'DANA', 's21e3u', 'standard', current_date + 1, 'cash in hand'),
                  null, 'a payment date in the future is refused');
select test.fails(format('select admin_record_sale(%L::uuid, %L, %L, 17900, 1, %L::date, %L)', :'DANA', 's21e3u', 'standard', :'paid_day', ' '),
                  null, 'a sale without a note on how it was paid is refused');
select test.fails(format('select admin_record_sale(%L::uuid, %L, %L, 0, 1, %L::date, %L)', :'DANA', 's21e3u', 'standard', :'paid_day', 'cash in hand'),
                  null, 'a zero price is refused');
select test.fails(format('select admin_record_sale(%L::uuid, %L, %L, 17900, 1, %L::date, %L)', :'DANA', 'no-such-rig', 'standard', :'paid_day', 'cash in hand'),
                  null, 'an unknown machine is refused');
select test.fails(format('select admin_record_sale(%L::uuid, %L, %L, 17900, 99, %L::date, %L)', :'DANA', 's21e3u', 'standard', :'paid_day', 'cash in hand'),
                  null, 'more than the stock is refused');

select admin_record_sale(:'DANA', 's21e3u', 'standard', 17900, 2, :'paid_day', 'Cash, handed over in the office', true) as rec \gset
reset role;
select test.ok((:'rec'::jsonb ->> 'orders')::int = 2, 'two machines are recorded in one go');
select test.ok((select count(*) from orders where user_id = :'DANA' and status = 'paid' and recorded_note is not null) = 2,
               'as paid orders marked as recorded by hand');
select test.near((select sum(price) from orders where user_id = :'DANA' and status = 'paid'), 35800, 'they count as bought');
select test.ok((select count(*) from holdings where user_id = :'DANA' and started_on = :'paid_day'::date + 1) = 2,
               'each machine earns from the day after the payment date');
select test.ok((select stock from machines where id = 's21e3u') = :s21e_before - 2, 'the stock goes down');
select test.near((select sum(amount) from ledger where user_id = :'DANA' and kind = 'cashback'), 250,
                 'first-purchase cashback when ticked (10% capped at 250)');
select test.ok((select count(*) from ledger where user_id = :'DANA' and kind = 'earning') = 0,
               'recording a sale pays no earnings by itself');
select test.ok(exists (select 1 from audit_log where action = 'order.recorded'), 'recorded sales are in the audit log');

set role authenticated; select test.as_user(:'ADMIN');
select admin_record_sale(:'DANA', 's19kpro', 'pro', 1654, 1, current_date, 'TRON transfer from their exchange', true) as rec2 \gset
reset role;
select test.near((select sum(amount) from ledger where user_id = :'DANA' and kind = 'cashback'), 250,
                 'a second recorded sale gets no second cashback');
select test.ok((select split from orders where user_id = :'DANA' and machine_id = 's19kpro') = 0.90, 'the Pro plan keeps the Pro split');
select test.ok((select started_on from holdings h join orders o on o.id = h.order_id
                 where o.user_id = :'DANA' and o.machine_id = 's19kpro') = (now() at time zone 'utc')::date + 1,
               'a sale recorded for today starts tomorrow');

\echo
\echo 'ALL TESTS PASSED'
