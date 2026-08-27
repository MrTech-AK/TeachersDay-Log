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

## Phase 3 Completeness (Admin Dashboard)
- [x] Admin financial overview (Total Expected, Collected, Pending, Verified Expenses, Balance)
- [x] Contributor Management (CRUD operations with derived statuses: PENDING, PARTIAL, PAID)
- [x] Contributions Table (With live client-side filtering)
- [x] Collector Summary (Aggregated totals per collector directly from database)
- [x] Derived Financial Calculations (Zero manual calculation stored)

## Local Development
1. Run `npm install`
2. Set up Neon PostgreSQL and copy connection string to `.env` as `DATABASE_URL`.
3. Set `SESSION_SECRET`.
4. Run `npm run dev` for nodemon or `npm start`.

## Remaining Phases (To-Do)
- API endpoint implementations for Contributions, Expenses, and Admin actions.
- Frontend HTML/CSS interfaces for Collectors (Varuni, Sakshi) and Admin (Akshat).
- Client-side fetch logic corresponding to the endpoints.

## Heroku Deployment Checklist

1. **Environment Setup**:
   Create a new app on Heroku and provision a Postgres database (or link Neon Postgres).

2. **Config Variables (Secrets)**:
   Set the following Config Vars in the Heroku dashboard (`Settings` -> `Reveal Config Vars`):
   - `NODE_ENV=production`
   - `DATABASE_URL` : Your secure PostgreSQL connection string.
   - `SESSION_SECRET` : A strong, randomly generated string for secure cookies.
   - `APP_URL` : The public URL of your Heroku app (e.g., `https://my-app.herokuapp.com`).

3. **Deploying**:
   - Push your code to Heroku: `git push heroku main`
   - Heroku will automatically install dependencies, build the Next.js app, and start the server using `node server.js` bound to the assigned `process.env.PORT`.

4. **Database Migrations**:
   Run the schema setup script via Heroku CLI:
   `heroku run node src/db/schema.sql --app <your-app-name>`

5. **Security Features Enabled**:
   - Helmet HTTP headers enabled.
   - Trust proxy enabled for secure cookies over Heroku's router.
   - API rate limiters installed on authentication & general routes.
   - Database secrets and internal stack traces are suppressed in production.
