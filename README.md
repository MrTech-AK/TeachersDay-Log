# Teachers' Day 2026 — Fund Ledger

A private internal financial tracking system for the school council.

## Phase 1 Completeness
- [x] Project structure
- [x] Express server
- [x] DB Connection module
- [x] SQL Schema & Migrations
- [x] Authentication & Authorization foundations
- [x] Security headers & rate limiting
- [x] Heroku configurations

## Phase 2 Completeness (Collector UX & Contribution Collection)
- [x] Collector Mobile-First Dashboard (HTML/CSS/JS)
- [x] Secure API Routes (`/api/contributions`, `/api/contributors`)
- [x] Server-side robust input validation
- [x] Anti-duplicate submission mechanism
- [x] Immutable transaction codes (e.g. `CON-000001`)
- [x] Audit logs generation
- [x] Session-derived collector identity (preventing spoofing)

## Local Development
1. Run `npm install`
2. Set up Neon PostgreSQL and copy connection string to `.env` as `DATABASE_URL`.
3. Set `SESSION_SECRET`.
4. Run `npm run dev` for nodemon or `npm start`.

## Remaining Phases (To-Do)
- API endpoint implementations for Contributions, Expenses, and Admin actions.
- Frontend HTML/CSS interfaces for Collectors (Varuni, Sakshi) and Admin (Akshat).
- Client-side fetch logic corresponding to the endpoints.
