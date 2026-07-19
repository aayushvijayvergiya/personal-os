# Personal OS 🖥️

A single-user, retro Windows-95-styled personal operating system for life:
tasks, projects, goals, habits with streaks, daily/weekly journals, calendar,
quick notes, a reading list and a corkboard vision board.

Built with Next.js 15 + Supabase. Spec: `docs/superpowers/specs/2026-07-19-personal-os-design.md`.

## Local development

1. `npm install`
2. Create a Supabase project (free tier) at https://supabase.com
3. In the Supabase SQL Editor, run `supabase/migrations/001_init.sql`
4. (Recommended) Auth → Providers → Email → disable "Confirm email"
5. `cp .env.local.example .env.local` and fill in the project URL + anon key
6. `npm run dev` → http://localhost:3000 → Create Account → sign in

## Deploying to Vercel

1. Push this repo to GitHub
2. Import into Vercel (framework auto-detected: Next.js)
3. Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_ALLOW_SIGNUP=true`
4. Deploy, open the URL, create your account, sign in
5. **Lock the door:** set `NEXT_PUBLIC_ALLOW_SIGNUP=false` and redeploy.
   Also disable signups in Supabase: Auth → Sign In / Up → "Allow new users to sign up" → off.

## Tests

`npm test` — unit tests for date, streak and horizon logic.

## v2 ideas

- Boot-splash vision rotation, time-locked letters to future self, screensaver mode
- Image upload to Supabase Storage for vision board (URL-only today)
- Weekly/monthly habit schedules
