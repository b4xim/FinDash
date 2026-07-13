# FinDash

A self-hosted personal finance dashboard built with Next.js and Supabase. Track spending, investments, SIPs, EMIs, credit cards, and lending — all in one place, all under your control.

---

## Features

- **Overview** — Net worth snapshot, monthly income vs. spend, top categories at a glance
- **Spending** — Add, edit, search, and filter transactions; credit card bill tracking; monthly trend charts
- **Investing** — Holdings tracker with live price sync for mutual funds (via MFapi.in) and stocks/ETFs (via Yahoo Finance); allocation pie; AI portfolio analysis; SIP mandate tracker
- **SIP Tracker** — Track systematic investment plans across mutual funds, ETFs, and stocks; log installments; see monthly outflow and next SIP date
- **EMI Tracker** — Track loan EMIs with amortization, active/closed status
- **Budget** — Monthly category caps with usage alerts
- **Goals** — Savings goal tracking with progress rings
- **Lending** — Track money lent to or borrowed from people, with partial settlement support
- **Credit Cards** — Gmail-parsed statement bills per card per month, with due date and status tracking
- **Smart Picks** — AI-generated buy recommendations for Indian stocks and mutual funds
- **Sync** — Gmail OAuth sync for automatic transaction and credit card parsing (read-only access, revocable)
- **Settings** — Change password, connect/disconnect Gmail

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (Postgres) |
| Auth | Cookie-based password gate + NextAuth for Gmail OAuth |
| Styling | Tailwind CSS |
| Price data | MFapi.in (mutual funds, free, no key) · yahoo-finance2 (stocks/ETFs) |
| AI | Google Gemini API |
| Deployment | Vercel |

---

## Self-Hosting

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works fine)
- A Google Cloud project with Gmail API enabled (only needed if you want email sync)

### 1 — Clone and install

```bash
git clone https://github.com/your-username/FinDash.git
cd FinDash
npm install
```

### 2 — Environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `APP_PASSWORD` | The password you'll use to log in |
| `SESSION_SECRET` | Random 32-byte hex string — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, never exposed to browser) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for Gmail sync — optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (for Gmail sync — optional) |
| `NEXTAUTH_SECRET` | Another random 32-byte hex string |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev, your domain in production |
| `GEMINI_API_KEY` | Google Gemini API key (for AI features — optional) |

### 3 — Set up the database

Run the SQL files in order in your Supabase SQL Editor:

1. `supabase-schema.sql` — core tables (transactions, holdings, etc.)
2. `supabase-credit-cards-migration.sql` — credit card tables
3. `supabase-sips-migration.sql` — SIP tracker table

### 4 — Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your `APP_PASSWORD`.

---

## Gmail Sync (optional)

The sync feature connects to Gmail with **read-only** OAuth access to parse transaction and credit card statement emails. No emails are stored — only the parsed amount, date, and merchant are extracted and shown in a review queue for you to approve or reject before anything is saved.

To set it up:

1. Create a Google Cloud project, enable the Gmail API
2. Create an OAuth 2.0 Web Client credential
3. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
4. Fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`
5. Go to **Settings → Connect Gmail** in the dashboard

---

## Deployment

The easiest path is Vercel + a custom domain:

1. Push to GitHub
2. Import the repo on [Vercel](https://vercel.com) and add all env variables from `.env.local`
3. Point a subdomain (e.g. `finance.yourdomain.com`) to Vercel via a CNAME record
4. Add the production redirect URI to your Google OAuth client

---

## Price Sync

| Asset type | Source | How to trigger |
|---|---|---|
| Mutual Fund (linked via search) | [MFapi.in](https://mfapi.in) — free, no key | Refresh Prices button |
| Stock / ETF (NSE symbol with `.NS`) | Yahoo Finance | Refresh Prices button |
| FD / PPF / Other | Manual | Edit the holding |

---

## License

MIT — use it, fork it, adapt it for your own finances.
