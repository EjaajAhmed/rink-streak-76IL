# Supabase setup (Phase 2 — accounts + stats)

The app ships **inert**: with no Supabase env vars it runs exactly like Phase 1
(guest-only, no auth UI). Follow this once to light up optional accounts.

## 1. Create the project
1. Create a free project at https://supabase.com → **New project**.
2. Project Settings → **API**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Both are client-safe. The service-role key is NOT needed in Phase 2.)

## 2. Run the schema
Open **SQL Editor** → paste the contents of [`supabase/schema.sql`](../supabase/schema.sql)
→ Run. This creates `profiles`, `runs`, `best_streaks`, their RLS policies
(owner-only), and the `handle_new_user` trigger.

## 3. Enable auth providers
Authentication → **Providers**:
- **Email** → enable (magic link / OTP is on by default).
- **Google** → enable, and paste a Google OAuth client ID + secret
  (Google Cloud Console → Credentials → OAuth client → *Web application*).
  In Google, add this Authorized redirect URI:
  `https://<your-project-ref>.supabase.co/auth/v1/callback`.

Authentication → **URL Configuration**:
- **Site URL**: your app origin (e.g. `http://localhost:3000` for dev, then your
  Vercel URL / custom domain in prod).
- **Redirect URLs**: add `http://localhost:3000/auth/callback` and your
  production `https://<domain>/auth/callback`. (The app sends users to
  `/auth/callback?next=<page>` and exchanges the code there.)

## 4. Set env vars
Local: copy `web/.env.local.example` → `web/.env.local` and fill both values.
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
Vercel: Project → Settings → Environment Variables → add the same two (Production
+ Preview). Redeploy.

## 5. Verify
Run `cd web && npm run dev`, then:
- The header shows **Sign in to save** → sign in with Google and with a magic link.
- Play a run: a row appears in `runs`, and a new best upserts into `best_streaks`
  (check Table Editor).
- If you played as a guest first, the game offers to **import** your local bests.
- `/me` shows per-team + overall best / games / average, and saves your display
  name + favourite team.
- Sign in on a second browser → your best streaks are already there.

## Notes
- Stats here are **client-reported** (each user writes only their own rows via
  RLS). That's fine for personal stats. Public competitive leaderboards need
  server-authoritative validation — that's Phase 3, and only then do any of these
  tables become public-readable.
