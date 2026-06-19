# FinDash — Personal Finance Dashboard

## Chunk 1 Setup Instructions

Follow these steps after receiving the Chunk 1 files.

---

### Step 1 — Install dependencies

```bash
cd finance-dashboard
npm install
```

---

### Step 2 — Create your `.env.local`

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | What to put |
|---|---|
| `APP_PASSWORD` | Any strong password — this is what you type on the login page |
| `SESSION_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase → Project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same place as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Same place — keep this private |
| `GOOGLE_CLIENT_ID` | Leave blank for now (Chunk 4) |
| `GOOGLE_CLIENT_SECRET` | Leave blank for now (Chunk 4) |
| `NEXTAUTH_SECRET` | Run the same random bytes command again |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev |

---

### Step 3 — Set up Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Pick a name (e.g. `findash`), strong DB password, region closest to you (Mumbai = ap-south-1)
3. Wait ~2 minutes for provisioning
4. Go to **SQL Editor** → **New Query**
5. Paste the contents of `supabase-schema.sql` and click **Run**
6. Copy your project URL and keys into `.env.local`

---

### Step 4 — Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see:
- A beautiful login page with dark violet glow
- After entering your `APP_PASSWORD`, the sidebar dashboard with placeholder pages

---

### What's working after Chunk 1

- ✅ Login page with password gate
- ✅ Signed cookie session (stays logged in for 7 days)
- ✅ Sidebar navigation with active state
- ✅ Route protection (unauthenticated → redirect to login)
- ✅ Logout button
- ✅ All page routes exist (overview, spending, investing, sync, settings)
- ✅ Supabase schema ready for data

---

## Chunk 2 Setup Instructions

No new environment variables, no new Supabase setup needed — this builds on Chunk 1.

### Step 1 — Get the new files

Extract the Chunk 2 archive into your existing `finance-dashboard` folder. It will add new files and overwrite `overview/page.tsx` and `spending/page.tsx`.

### Step 2 — Reinstall (just in case)

```bash
npm install
```

### Step 3 — Restart the dev server

If it's already running, stop it (Ctrl+C) and start again:
```bash
npm run dev
```

### Step 4 — Test it

1. Go to **http://localhost:3000/spending**
2. Click **Add Transaction**
3. Fill in:
   - Date: today
   - Description: "Swiggy"
   - Amount: 450
   - Type: Debit (expense)
   - Category: Food & Dining
4. Click **Add Transaction** — it should appear in the table immediately
5. Add 4–5 more with different categories and a couple of past months' dates to see the charts populate
6. Try the pencil icon to edit one, trash icon to delete one
7. Try the search box and category/type filters
8. Go to **http://localhost:3000/overview** — you should now see real numbers, not ₹0

### New files this chunk adds
- `src/app/api/transactions/route.ts` — list & create transactions
- `src/app/api/transactions/[id]/route.ts` — edit & delete transactions
- `src/app/api/stats/route.ts` — aggregated stats for Overview page
- `src/components/spending/*` — form, table, pie chart, bar chart
- `src/components/ui/Modal.tsx` and `ConfirmDialog.tsx` — reusable dialogs

### What's working after Chunk 2

- ✅ Add / edit / delete transactions — all saved to Supabase
- ✅ Transaction table with search, category filter, type filter, sortable columns
- ✅ Category pie chart — live, updates as you add transactions
- ✅ Monthly trend bar chart — last 6 months, spend vs income
- ✅ Overview page — live net worth, month-over-month % change, top categories
- ✅ Gmail-synced transactions (once Chunk 4 lands) will show a small mail icon

### What's coming next

**Chunk 3:** Investing page — holdings table, manual add/edit, allocation pie chart, basic performance view

---

## Chunk 3 Setup Instructions

This chunk adds the Investing page with **auto NAV sync for mutual funds** via MFapi.in (a free, no-key Indian mutual fund data API).

### Step 1 — Update your Supabase schema

You already have the `holdings` table from Chunk 1, but it needs two new columns for mutual fund auto-sync. Go to Supabase → SQL Editor → New Query and run:

```sql
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS mfapi_code TEXT;
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ;
```

(If this is your very first time running the schema — i.e. you skipped Chunk 1/2 setup — just run the full `supabase-schema.sql` file instead, it already includes these columns.)

### Step 2 — Get the new files

Extract this archive into your `finance-dashboard` folder — it adds new files and updates `investing/page.tsx`, `overview/page.tsx`, and `api/stats/route.ts`.

**Remember:** copy your existing `.env.local` back in — it's never included in these archives.

### Step 3 — No new env variables needed

MFapi.in requires no API key, so nothing new to add to `.env.local`.

### Step 4 — Restart and test

```bash
npm install
npm run dev
```

1. Go to **http://localhost:3000/investing**
2. Click **Add Holding**
3. Try a **mutual fund**:
   - Asset Type: Mutual Fund
   - Type "HDFC Flexi Cap" or "Parag Parikh" in the fund search box → wait for the dropdown → click a result
   - It auto-fills the fund name and links the AMFI scheme code
   - Enter Units (e.g. `100`) and Avg Buy Price (e.g. `45`)
   - Leave Current Price blank — it'll default to your buy price until you refresh
   - Account: "Zerodha" or wherever you hold it → Add Holding
4. Try a **stock**:
   - Asset Type: Stock
   - Name: "Reliance Industries", Ticker: "RELIANCE"
   - Units, Avg Buy Price, Current Price (manual) → Add Holding
5. Click **Refresh Prices** at the top — this fetches the real NAV for any mutual funds you added (stocks are skipped, since they need manual updates)
6. Check the holdings table — you should see current value, gain/loss in ₹ and %, and a small lightning bolt icon next to auto-synced mutual funds
7. Go to **Overview** — Net Worth and Investments stat cards should now reflect your holdings too

### How the price syncing actually works

| Asset type | Price source |
|---|---|
| Mutual Fund (linked via search) | Auto-fetched from MFapi.in when you click "Refresh Prices" |
| Stock / ETF | Manual — edit the holding to update current price |
| FD / PPF | Manual — these don't have market prices anyway |

MFapi.in is a free, community-run API with no official uptime guarantee. If a refresh ever fails for a fund, it'll just show "failed" in the refresh summary — nothing breaks, you can always fall back to entering that one price manually.

### What's working after Chunk 3

- ✅ Add / edit / delete investment holdings
- ✅ Mutual fund search with auto-link to AMFI scheme code
- ✅ One-click "Refresh Prices" — pulls live NAV for all linked mutual funds
- ✅ Stocks/ETFs/FD/PPF — manual price entry, fully supported
- ✅ Holdings table — current value, gain/loss in ₹ and %, last price update time
- ✅ Allocation pie chart by asset type
- ✅ Overview page now reflects real net worth including investments

### What's coming next

**Chunk 4:** Gmail OAuth connection, email sync for transactions/investments, review queue, Settings page (password change, Gmail revoke)

---

## Chunk 4 Setup Instructions

This is the biggest chunk — it adds Gmail OAuth, the email sync engine, the review queue, a Credit Cards view, and the Settings page. Take your time on the Google Cloud setup, it's the fiddly part.

### Step 1 — Update your Supabase schema

Run this in Supabase → SQL Editor → New Query:

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS card_last4 TEXT;
```

(`pending_emails` and `app_settings` tables already exist from Chunk 1 — nothing else to add there.)

### Step 2 — Get the new files

Extract this archive into your `finance-dashboard` folder. As always, copy your `.env.local` back in afterward — it's never included in archives.

### Step 3 — Set up Google Cloud OAuth (the long part)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
   - Name: `FinDash` (or anything) → Create
3. With your new project selected, go to **APIs & Services → Library**
   - Search for **Gmail API** → click it → **Enable**
4. Go to **APIs & Services → OAuth consent screen**
   - User Type: **External** → Create
   - App name: `FinDash`, your email for support email and developer contact
   - Click **Save and Continue** through Scopes (skip — we set scopes in code)
   - On the **Test users** step, click **Add Users** → add your own Gmail address
   - This matters: while the app is in "Testing" mode, only test users you list can log in. That's fine — it's just you.
   - Save and Continue → Back to Dashboard
5. Go to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `FinDash Web`
   - Under **Authorized redirect URIs**, click **Add URI** and add:
     ```
     http://localhost:3000/api/auth/callback/google
     ```
   - (You'll add your production URL here too, after deploying — see Step 7)
   - Click **Create**
6. A popup shows your **Client ID** and **Client Secret** — copy both

### Step 4 — Add the new env variables

Open `.env.local` and fill in:

| Variable | What to put |
|---|---|
| `GOOGLE_CLIENT_ID` | From Step 3 — ends in `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | From Step 3 — starts with `GOCSPX-` |
| `NEXTAUTH_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev |

### Step 5 — Install and run

```bash
npm install
npm run dev
```

### Step 6 — Test the full flow

1. Go to **http://localhost:3000/settings**
2. Click **Connect Gmail** → you'll be redirected to Google's consent screen
   - You may see an "unverified app" warning since the app isn't published — click **Advanced → Go to FinDash (unsafe)**. This is expected and safe; it's just Google flagging that the app hasn't gone through their review process, which isn't needed for personal use.
   - Grant the Gmail read-only permission
3. You'll land back on Settings, now showing "Connected to your@email.com"
4. Go to **Sync** in the sidebar
5. Click **Sync Now** — this searches your Gmail for emails from the configured senders (ICICI, SBI Card, Axis, Zerodha, Groww, 5paisa) and pulls anything new
   - If you don't have any matching emails yet, it'll say "No new emails found" — that's correct behavior, not a bug
6. If matches are found, they appear in the **Review Queue** below
7. Click a card to expand it — review/edit the parsed date, amount, description, category
8. Click **Approve & Save** to create a real transaction, or **Reject** to discard
9. Go to **Spending** → click the **Credit Cards** tab — any approved card transactions will be grouped here automatically
10. Back in **Settings**, test **Change Password** — log out and back in with the new password to confirm it works
11. Test **Disconnect Gmail** — confirms it revokes access cleanly

### Important notes on email parsing

- The parser in `src/lib/emailParser.ts` uses regex pattern matching tuned to *typical* ICICI/SBI Card/Axis/Zerodha/Groww/5paisa email formats. Your bank's actual wording may differ slightly — that's exactly why the **Review Queue exists**. Nothing is ever auto-saved; you always confirm or correct before it becomes a real transaction.
- If a parse comes back "Low confidence," double check every field before approving.
- To support a new sender or fix a parsing pattern, edit `src/lib/emailParser.ts` — each bank has its own small parser function, and add the sender's email domain to `RELEVANT_SENDERS` in `src/lib/gmail.ts`.

### What's working after Chunk 4

- ✅ Gmail OAuth connection (read-only, revocable anytime)
- ✅ One-click sync — pulls new transaction/investment emails since last sync
- ✅ Review queue — every parsed email shown with editable fields before saving
- ✅ Approve creates a real transaction; Reject discards it; nothing is automatic
- ✅ Credit Cards tab on Spending page — transactions grouped by card with current-cycle spend
- ✅ Settings page — change password (works even though APP_PASSWORD is an env var). Gmail connect/disconnect with Google-side token revocation

### 🎉 The app is now feature-complete

All 6 pages are fully functional: Login, Overview, Spending, Investing, Sync, Settings. Time to deploy it for real — see below.

---

## Deploying to Production

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "FinDash — initial complete build"
```
Create a new repo on [github.com](https://github.com/new) (keep it **Private** — this is your personal finance data), then:
```bash
git remote add origin https://github.com/yourusername/finance-dashboard.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub
2. **New Project** → import your `finance-dashboard` repo
3. Before clicking Deploy, expand **Environment Variables** and add every variable from your `.env.local`:
   - `APP_PASSWORD`, `SESSION_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` → set this to `https://finance.yourdomain.com` (your future subdomain — see below)
4. Click **Deploy**

### Step 3 — Connect your GoDaddy subdomain

1. In Vercel → your project → **Settings → Domains** → type `finance.yourdomain.com` → **Add**
2. Vercel will show you a CNAME target (usually `cname.vercel-dns.com`)
3. Go to **GoDaddy → My Products → DNS** for your domain
4. **Add Record**:
   - Type: `CNAME`
   - Name: `finance`
   - Value: `cname.vercel-dns.com`
   - TTL: default is fine
5. Save — DNS propagation usually takes a few minutes, sometimes up to an hour

### Step 4 — Update Google OAuth for production

1. Back in [console.cloud.google.com](https://console.cloud.google.com) → your project → **Credentials** → click your OAuth client
2. Under **Authorized redirect URIs**, click **Add URI**:
   ```
   https://finance.yourdomain.com/api/auth/callback/google
   ```
3. Save

### Step 5 — Final check

1. Visit `https://finance.yourdomain.com`
2. Log in with your `APP_PASSWORD`
3. Go to Settings → Connect Gmail again (production needs its own OAuth grant, separate from localhost)
4. Try a sync to confirm everything works end-to-end in production

You now have a fully private, fully functional personal finance dashboard running on your own domain, for free.

---

## Add-on: Yahoo Finance Stock/ETF Price Auto-Sync

This update adds automatic price refresh for **stocks and ETFs**, on top of the mutual fund NAV sync from Chunk 3. Both now share the same "Refresh Prices" button.

### Step 1 — Install the new package

```bash
npm install
```
(`yahoo-finance2` was added to `package.json` — no other setup needed, no API key required.)

### Step 2 — No schema changes needed

This reuses the existing `ticker` column on `holdings` — no migration required.

### Step 3 — Test it

1. Go to **Investing** → **Add Holding**
2. Asset Type → **Stock**
3. Name: `Reliance Industries`
4. Symbol: `RELIANCE.NS` (NSE symbol with `.NS` suffix — see the helper text in the form)
5. Units, Avg Buy Price → leave Current Price blank → **Add Holding**
6. Click **Refresh Prices** at the top — the stock's price should update to the live Yahoo Finance quote, same as mutual funds already do
7. Try an invalid symbol (e.g. `FAKESYMBOL.NS`) on another holding — refresh should still succeed for everything else and just report that one as failed, never breaking the whole batch

### How it works

| Asset type | Price source | Trigger |
|---|---|---|
| Mutual Fund (linked via search) | MFapi.in | Refresh Prices button |
| Stock / ETF (symbol with `.NS`) | Yahoo Finance (`yahoo-finance2`) | Refresh Prices button |
| FD / PPF / Other | Manual only | Edit the holding |

Each holding refreshes independently on the server — if Yahoo Finance is down, rate-limited, or a symbol is wrong, that one holding is marked "failed" in the response and everything else still updates normally.

### Symbol format note

Yahoo Finance needs the exchange suffix to find Indian stocks — `RELIANCE` alone won't resolve, but `RELIANCE.NS` (NSE) will. The form reminds you of this under the Symbol field whenever Asset Type is Stock or ETF.
