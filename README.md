# Hashyard

A hosted-mining marketplace. Customers sign in with Google, buy a whole mining
machine or a share of one by paying USDT (TRC-20) straight to your wallet, and
are paid what it mined every day. You run it from an operator console.

```bash
npm install
npm run dev          # http://localhost:5173
```

Without Supabase keys the site runs in **demo mode**: sample customers, no real
payments, and a banner saying so. The sample customers live in
`src/data/demoCustomers.js` and are never loaded once the site is connected to
Supabase. Follow the setup below to go live.

---

## How the money moves

| | |
|---|---|
| **Buying** | The customer pays the exact order amount (e.g. `4299.087` USDT) straight to **your** TRON wallet over TRC-20. There are no deposits and no way to pay from a balance. |
| **Overpaying** | Anything sent above the order amount is a refund you send back to the wallet it came from — never added to a balance. Under 1 USDT is not refunded (the network fee would be higher). |
| **Matching** | Every minute a scanner reads your wallet's incoming USDT and matches each transfer to an order by its unique amount. If an exchange rounds the amount, the customer pastes their transaction ID instead. |
| **Earning** | Each morning you enter each machine's profit after electricity, and publish. Owners are paid their plan's share of it. |
| **Earnings to withdraw** | Only what a customer's machines earned and they haven't withdrawn. What they paid for machines is never in it (that bought the machines). Nobody can edit it — it's the sum of an append-only ledger. |
| **Withdrawing** | The customer requests it. You send from your own wallet within 24 hours and paste the transaction ID. |

No private key is ever stored on a server. The system only *reads* the
blockchain; you move money by hand.

---

## Going live — one-time setup (about an hour)

Everything below is free for a small number of customers:

| Service | What for | Free plan |
|---|---|---|
| **Supabase** | Database, sign-in, background jobs | Plenty for a test with a few customers. Pauses after a week with no activity; restart it from the dashboard. |
| **Google Cloud** | "Continue with Google" | Free. While the app is in *Testing*, only the Gmail addresses you add can sign in (up to 100). |
| **TronGrid** | Reading your wallet for payments | A scan every minute is far below the free limit. |
| **Cloudflare Pages** or **Netlify** | Hosting the website | Free, and allowed for a business. (Vercel's free plan is for non-commercial use.) |
| **Resend** + a domain *(optional)* | The daily earnings email | 100 emails a day free; a domain is about $10 a year. Skip it for now — customers see everything on their dashboard. |

### 1. Supabase — database, login and background jobs

1. Create a project at [supabase.com](https://supabase.com). Pick a region near your customers.
2. Open **Project Settings → API** and keep this page open. You need the
   **Project URL**, the **anon / publishable key**, and the **project ref**
   (the `xxxx` in `https://xxxx.supabase.co`).
3. **Database → Extensions**: enable **pg_cron** and **pg_net**.
4. Push the database from this folder:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```

   That creates every table, security rule and function from `supabase/migrations/`.

### 2. Google — sign-in

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project called `Hashyard`.
2. **Google Auth Platform → Get started** (older consoles: *APIs & Services → OAuth consent screen*):
   - App name `Hashyard`, your email as support email
   - Audience: **External**
   - Contact email: yours → **Create**
3. **Audience → Test users → Add users**: the Gmail addresses of everyone who
   should be able to sign in (you, and your testers). While *Publishing status*
   is **Testing**, nobody else can. Publish the app later to open sign-up to
   everyone — with only name and email requested, Google does not need to review it.
4. **Clients → Create client** → type **Web application**:
   - Authorized JavaScript origins: your site, e.g. `https://hashyard.pages.dev`,
     and `http://localhost:5173` for testing on your computer
   - Authorized redirect URIs: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   - **Create**, then copy the **Client ID** and **Client secret**.
5. Supabase → **Authentication → Sign In / Providers → Google** → turn it on,
   paste the Client ID and Client secret → **Save**.
6. Same page → **Email** → turn it **off**, so Google is the only way to sign in.
7. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: your live site, e.g. `https://hashyard.pages.dev`
   - **Redirect URLs**: add `https://hashyard.pages.dev/**` and `http://localhost:5173/**`

> The Client secret goes only into Supabase. Never put it in the website or in git.

### 3. TronGrid — reading your wallet

1. [trongrid.io](https://www.trongrid.io) → sign up → create an **API key**.

### 4. Deploy the payment scanner

Make up a long random password for `CRON_SECRET` (e.g. from a password
manager). Then:

```bash
npx supabase secrets set TRONGRID_API_KEY=your-trongrid-key CRON_SECRET=your-random-password
npx supabase functions deploy payments
```

Then in Supabase → **SQL Editor**, run once (same password):

```sql
select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
select vault.create_secret('your-random-password', 'cron_secret');
```

The payment scan (every minute) starts working as soon as these exist.

**Later, for daily emails** (needs a domain): at [resend.com](https://resend.com)
add and verify your domain, create an API key, then:

```bash
npx supabase secrets set RESEND_API_KEY=your-resend-key EMAIL_FROM="Hashyard <updates@yourdomain.com>" SITE_URL=https://hashyard.pages.dev
npx supabase functions deploy daily-email
```

### 5. Connect the website

Locally: copy `.env.example` to `.env.local` and fill in the two values.

On **Cloudflare Pages** (or Netlify): connect the GitHub repository, build
command `npm run build`, output folder `dist`, and add the environment
variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Redeploy after
adding them. The demo banner disappears once they're set.

> The anon/publishable key is safe to put in the website — it only allows what
> the security rules permit. **Never** put the service role / secret key in the
> website or in git.

### 6. Make yourself the operator

1. Open your live site and **sign in with Google** once.
2. Supabase → SQL Editor (use the Gmail address you signed in with):
   ```sql
   update profiles set role = 'admin' where email = 'you@gmail.com';
   ```
3. Reload the site → account menu → **Operator console** → **Settings** →
   enter **your receiving wallet** (your TRON address) and save. Until you do,
   nobody can buy.

### 7. Add customers who already paid you

For people who bought before the site existed, or paid in cash or by bank:

1. Ask them to open the site and **sign in with Google** once (add their Gmail
   as a test user first — step 2.3).
2. Console → **Customers** → their row → **Record a sale**: the machine, plan,
   price they actually paid for one, how many, the date they paid, and how
   they paid.

Each machine becomes theirs exactly as if bought on the site: it counts as
*bought* on the leaderboard and starts earning the day after the payment date.
Earnings only come from the daily profit you publish, so nothing is paid for
days before you start publishing. Every recorded sale is in the audit log.

### 8. Test with real money, small

1. Console → **Machines → Add a machine**: a test machine priced `2` USDT, stock 1.
2. Buy it from a normal account and send the exact amount shown.
3. Within a minute or two the payment page should turn to "Payment received"
   by itself. If it doesn't, see *Troubleshooting*.
4. Remove the test machine.

---

## Your daily routine

1. **Morning — Daily profit.** For each whole machine, enter yesterday's
   profit for one machine after electricity (it can be negative). Shares fill in
   automatically. Leave *Running* at 100 unless a machine was down. Press
   **Save and publish** — that pays everyone and triggers the 09:00 UTC email.
   You can correct and publish again; nobody is paid twice.
2. **Withdrawals.** Each card shows exactly what to send and where. Send it from
   your wallet, paste the transaction ID, press **Mark as sent**. Cards turn
   orange after 20 hours.
3. **Orders → Refunds to send.** Customers who sent more than asked. Send the
   extra back to the wallet shown, paste the transaction ID.
4. **Orders → Needs a look.** Payments that arrived short, or after an order
   expired with no stock left. Confirm by hand or refund from your wallet.
5. **Machines.** Change a price by typing in the price column and pressing
   Enter. It only affects new orders. The table also shows how many sold and
   how much profit each machine has paid its owners.

---

## Checking it works

```bash
npm run test:db         # 133 checks: purchases, recorded sales, refunds, payouts, guarantee, referrals,
                        #             withdrawals, leaderboard, and every security rule
npm run test:payments   # 21 checks: matching transfers to orders, fake-token and claim-theft protection
npm run check           # every source file parses and every import resolves
npm run verify          # the catalogue's estimated economics
```

`test:db` needs PostgreSQL 15+ installed locally; it creates a throwaway
database on port 55432 and deletes it afterwards.

---

## Where things live

| Path | What it is |
|---|---|
| `supabase/migrations/` | The database: tables, security rules, and every function that moves money |
| `supabase/functions/payments/` | Payment scanner (reads TronGrid, confirms orders) |
| `supabase/functions/daily-email/` | Daily earnings email |
| `supabase/functions/_shared/payments.js` | The matching logic — the same file runs on the server and in the tests |
| `src/api/live.js` / `src/api/demo.js` | The real backend, and the in-browser demo with the same rules |
| `src/admin/` | Operator console |
| `src/pages/Leaderboard.jsx` | Public leaderboard (anonymised in the database, not the browser) |
| `src/pages/` | Customer site |

## Leaderboard and privacy

The leaderboard ranks customers by how much they have **bought** — the total
price of their paid machine orders. Unpaid, cancelled and under-review orders
never count. How much crypto someone has put in is private, so the database
never returns it with a real identity unless they asked for that:

| Setting | Shown as |
|---|---|
| Anonymous *(default)* | `Miner 3F9A` — stable, but not traceable to a person |
| Show my name | `Aylar K.` — first name and initial, never the surname or email |
| Keep me off it | Not listed at all |

Customers change this in **Wallet**. The ranking function returns only places,
aliases and rounded totals — never an id, an email or a balance.

## Troubleshooting

- **"Payments are not set up yet" when buying** — add your receiving wallet in Console → Settings.
- **Payment not confirming** — check Supabase → Edge Functions → `payments` → Logs. Most often the
  TronGrid key or the `project_url` vault secret is missing. Customers can always paste their
  transaction ID, and you can confirm by hand in Orders.
- **"Access blocked: Hashyard has not completed the Google verification process"** — that Gmail
  address is not on the test-user list (step 2.3). Add it, or publish the app.
- **"redirect_uri_mismatch" from Google** — the redirect URI in Google must be exactly
  `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (step 2.4).
- **Signed in with Google but landed back signed out** — your site's address is missing from
  Supabase → Authentication → URL Configuration → Redirect URLs (step 2.7).
- **No daily email** — the day must be *published*, `RESEND_API_KEY` and a verified domain must be
  set, and the customer must have emails turned on (Wallet page).

## Before real customers

Holding customers' earnings and paying them out is regulated in many countries.
Get a lawyer's view wherever you register the business. Earnings shown in the
shop are estimates; real payouts move with the bitcoin price.
