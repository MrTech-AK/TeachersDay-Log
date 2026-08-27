# Teachers' Day 2026 — Fund Ledger Project Specification

## Architecture Overview
The application follows a traditional Client-Server architecture:
- **Frontend**: Plain HTML, CSS, and Vanilla JS served as static files by the Express server.
- **Backend**: Node.js and Express RESTful API.
- **Database**: PostgreSQL (Neon serverless) with `pg` driver.
- **Deployment**: Heroku container/dyno.

## Database Schema
The database is normalized to ensure data integrity and avoid redundancy:
- **users**: Stores administrators and collectors. Includes bcrypt password hashes.
- **session**: Maintained by `connect-pg-simple` for session storage.
- **contributors**: Details of students from classes 9-12.
- **contributions**: Financial records of money collected (references contributors and users). Amount is stored as `NUMERIC(10,2)`.
- **expenses**: Tracks expenditures.
- **reconciliation_records**: Audit logs of expected vs actual funds.
- **audit_logs**: Immutable trail of changes (e.g., login events, data mutations).

## Security Architecture
### Authentication
- **Session Based**: Uses server-side sessions (`express-session` + `connect-pg-simple`). No JWTs in LocalStorage.
- **Cookies**: HttpOnly, SameSite=Lax, and Secure (in production).
- **Passwords**: Hashed with `bcrypt`. Never stored in plaintext.

### Authorization
- Implemented via custom Express middleware (`requireAuth`, `requireRole`).
- Identity is inferred strictly from `req.session.userId`, preventing privilege escalation/impersonation.

### Data Protection
- **No Secrets in Frontend**: The browser JS never receives database credentials.
- **Parameterized Queries**: All SQL uses `$1, $2` parameters via `pg` to prevent SQL injection.
- **Rate Limiting**: `express-rate-limit` prevents brute force against `/login` and API endpoints.
- **Security Headers**: `helmet` manages CSP, X-Frame-Options, X-XSS-Protection.

## Deployment Requirements (Heroku)
- Needs `DATABASE_URL` (Neon Postgres string) in Heroku config vars.
- Needs `SESSION_SECRET` config var.
- Uses standard `Procfile` mapping `web` process to `npm start`.
- `PORT` is dynamically injected by Heroku.
