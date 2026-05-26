# LORDE AI - Premium Automated Trading Bot Platform

**Updated:** May 26, 2026  
**Status:** Production-ready dashboard with full UI/UX enhancements, real-time analytics, and modular component architecture.

## 📋 Overview

LORDE AI is a web-based trading automation platform for Deriv Synthetic Indices (24/7 markets). Users connect their Deriv API token, select an account, await admin approval, then deploy algorithmic bots (V75 Mean Reversion, Crash 500 Hunter, Boom 1000 Reversal) that execute trades via an external WebSocket engine (managed separately). This repository contains the **frontend application layer** (Next.js 14, App Router, Clerk Auth, Supabase) responsible for:

- User authentication & onboarding
- Deriv token & account connection flow
- Bot control (start/stop via unified API)
- Real-time trade monitoring & P&L tracking
- Bot configuration & performance analytics
- Admin approval workflow (separate route)

## 🧩 What Was Added / Changed

### ✅ New Frontend Components (`src/components/dashboard/`)

| Component | Purpose |
|----------|---------|
| `Sidebar.tsx` | Collapsible navigation sidebar (Dashboard, Analytics, History, Settings) with live bot status indicator. |
| `EquityChart.tsx` | Recharts-based area chart showing cumulative P&L equity curve with timeframe selector (1H/24H/7D/30D/ALL). Displays total P&L, win rate, trade count. |
| `BotConfigModal.tsx` | Slide-out modal to configure per-bot parameters: stake amount, tick interval, max drawdown (range slider), max trades per day. |
| `TradeDetailPanel.tsx` | Expandable row below any trade in the ledger showing contract ID, stake, entry→exit spread, full timestamp. |
| `Toast.tsx` | Global toast notification system with `notify()` helper. Shows slide-up alerts for new trades (with P&L color), bot start/stop, config saves, and errors. |

### 🔧 Modified Files

| File | Changes |
|------|---------|
| `app/dashboard/page.tsx` | **Major rewrite**: Added sidebar + tabbed interface (Dashboard/Analytics/History/Settings); integrated all new components; added account badge in navbar; timeframe-filtered metrics; click-to-expand trade rows; toast notifications on realtime trades; bot config modal triggers via gear icon. Preserved all existing auth, Deriv connection, approval flows, and bot start/stop logic. |
| `app/api/bot/control/route.ts` | **NEW** unified API endpoint: `POST /api/bot/control` accepts `{ bot_type, action: "start" \| "stop" }`. Checks user approval status (`users.status === 'approved'`), upserts `bots` table with `(user_id, bot_type)` conflict target. |
| `app/api/bots/start/route.ts` | Fixed Clerk import: `auth` from `@clerk/nextjs/server` + `await auth()`. |
| `app/api/bots/stop/route.ts` | Same fix as above. |
| `tailwind.config.js` | Added `fadeIn` and `slideUp` keyframes + animations for modals/toasts. |
| `globals.css` | Unchanged (Tailwind base). |

### 🗑️ Deleted / Unused
- None. All existing files retained for backward compatibility (old `/api/bots/start` and `/api/bots/stop` routes still exist but are unused by the dashboard).

## 🗄️ Backend Requirements (Supabase)

For the platform to function fully, the following must be configured in your Supabase project (`https://eyvcapwdlbfnqofibeui.supabase.co` as per `.env.local`):

### 1. Required Tables & Columns

Ensure these tables exist with at least these columns (inferred from code; exact types may vary):

#### `users`
- `id` (PK, text) – Clerk user ID
- `status` (text) – e.g., `'approved'`

#### `user_nodes`
- `id` (PK)
- `clerk_user_id` (text, unique)
- `deriv_token` (text)
- `selected_account_id` (text)
- `account_type` (text: `'demo'` \| `'real'`)
- `status` (text: `'pending_approved'` \| `'approved'` \| `'rejected'`)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `bots`
- `id` (PK)
- `user_id` (text, references `users.id`)
- `bot_type` (text: `'v75_mean_reversion'` \| `'crash500_hunter'` \| `'boom1000_reversal'`)
- `status` (text: `'running'` \| `'stopped'` \| `'error'`)
- `config` (jsonb, nullable)
- `started_at` (timestamp)
- `stopped_at` (timestamp)
- *Unique constraint:* `(user_id, bot_type)`

#### `trades`
- `id` (PK)
- `user_id` (text, references `users.id`)
- `contract_type` (text: `'CALL'` \| `'PUT'`)
- `symbol` (text)
- `entry_price` (numeric)
- `exit_price` (numeric)
- `stake` (numeric)
- `pnl` (numeric)
- `result` (text: `'win'` \| `'loss'`)
- `timestamp` (timestamp)

#### `user_deriv_connections`
- `user_id` (text)
- `api_token` (text)
- `accounts` (jsonb)
- `updated_at` (timestamp)

#### `admin_actions` (for audit)
- `action_type` (text)
- `target_id` (text)
- `details` (jsonb)

### 2. Supabase Realtime

**Realtime must be enabled** on the `public.trades` table for live trade streaming:

```sql
-- Enable replication for the trades table
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
```

If the publication does not exist, create it via Supabase Dashboard → Database → Realtime, or run:

```sql
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
```

### 3. Row Level Security (RLS)

Ensure RLS policies allow the **anon key** (used by the client) to:
- `SELECT` on `user_nodes` (by `clerk_user_id`)
- `SELECT`/`UPSERT` on `bots` (by `user_id`)
- `SELECT`/`INSERT` on `trades` (by `user_id`)
- `SELECT` on `users` (by `id`)
- `UPSERT` on `user_deriv_connections` (by `user_id`)

Example policy for `trades` (simplified):

```sql
create policy "Users can view own trades"
on trades for select
using (auth.uid()::text = user_id);
```

### 4. Indexes (Recommended)

For performance, add these indexes:

```sql
CREATE INDEX idx_trades_user_id_timestamp ON trades (user_id, timestamp DESC);
CREATE INDEX idx_bots_user_id_bot_type ON bots (user_id, bot_type);
CREATE INDEX idx_user_nodes_clerk_user_id ON user_nodes (clerk_user_id);
```

## 🔑 Environment Variables

Required in `.env.local` (see example in repo):

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_OUT_REDIRECT_URL=/

NEXT_PUBLIC_DERIV_DEFAULT_APP_ID=33mZdzOJ000s1hj182NFG   # or your own
NEXT_PUBLIC_APP_URL=http://localhost:3000

NODE_ENV=development
```

## 🚀 How to Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Visit `http://localhost:3000` – sign up/sign in via Clerk.

4. Connect Deriv token → select account → await admin approval (via `/admin/approve-node` route).

5. Once approved, deploy bots from the dashboard, monitor real-time trades, adjust bot configs, and view analytics.

## 📦 Dependencies

See `package.json` for full list. Key ones:

- `@clerk/nextjs` – Auth
- `@supabase/supabase-js` – Database & Realtime
- `recharts` – Charts (already installed, used in `EquityChart.tsx`)
- `@clerk/themes` – Dark theme customization

## 🧪 Testing

Manual testing steps:
1. Verify auth flow (sign up/in redirects to `/dashboard`).
2. Test Deriv connection modal: valid token → fetches accounts → select → save → pending approval.
3. Approve a user via Supabase: `UPDATE users SET status = 'approved' WHERE id = '<clerk-user-id>';`
4. After approval, check that bot cards appear and are stoppable/stoppable.
5. Start a bot → verify it appears as "Running" in metric cards and bot grid.
6. Open a trade via external engine (or simulate insert into `trades` table) → see toast + trade appear in ledger + P&L update + equity chart update.
7. Click a trade row → expand to see detail panel.
8. Click gear icon on a bot → adjust config → save → see toast.
9. Switch tabs: Dashboard (main), Analytics (charts), History (full table), Settings (config view).
10. Use timeframe filter (1H/24H/etc.) – metrics and chart should update.
11. Resize sidebar – collapses below 1024px width.

## 📝 Notes

- The external trading engine (WebSocket) that reads `bots` table and writes to `trades` is **not** in this repo; it is managed separately (as noted in the project brief).
- All API routes are protected by Clerk middleware (`middleware.ts`) – only signed-in users can access `/dashboard` and its subroutes.
- The `/api/bot/control` route is the **single source of truth** for bot state changes; the old `/api/bots/start` and `/api/bots/stop` are deprecated but left intact to avoid breaking changes.
- UI follows the premium dark/gold theme defined in `tailwind.config.js` and used throughout.

## 📞 Support

For issues or questions, refer to the inline code comments or open an issue in this repository.

--- 

*This README documents all frontend changes made to transform the base dashboard into a production-ready, feature-rich trading platform. Backend (Supabase) must be provisioned as described above for full functionality.*