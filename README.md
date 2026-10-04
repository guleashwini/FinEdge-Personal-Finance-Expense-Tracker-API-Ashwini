# FinEdge – Personal Finance & Expense Tracker API

A REST API for tracking income and expenses, setting monthly budgets, and viewing summaries. Built with Node.js and Express (ES modules), with JSON-file persistence and JWT-based login.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env     # then edit .env, see "Configuration"
npm run dev              # auto-restart on changes (or: npm start)
npm test                 # run the test suite
```

Check it is running: `GET http://localhost:3000/health`

## Configuration

Settings are read from environment variables (loaded from `.env`) in [src/config.js](src/config.js).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `CACHE_TTL_MS` | `30000` | How long a `/summary` result stays cached |
| `JWT_SECRET` | dev-only value | Key used to sign login tokens. **Required when `NODE_ENV=production`** |
| `JWT_EXPIRES_IN_SECONDS` | `3600` | Token lifetime |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Authentication

1. Register with `POST /users`.
2. Log in with `POST /auth/login` to get a token.
3. Send it on every protected request: `Authorization: Bearer <token>`.

Transactions, budgets and the summary are **private to each user**. Another user's record returns `404`.

```bash
curl -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com","password":"safe-password-123"}'

curl -X POST localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"safe-password-123"}'
# => { "token": "...", "user": { ... } }

curl -X POST localhost:3000/transactions -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","category":"food","amount":45.5,"date":"2026-10-03"}'
```

## Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | no | Server status |
| POST | `/users` | no | Register (`name`, `email`, `password` ≥ 8 chars) |
| POST | `/auth/login` | no | Returns `{ token, user }` |
| POST | `/transactions` | yes | Add income/expense (`type`, `category`, `amount` > 0, `date`) |
| GET | `/transactions` | yes | List yours. Filters: `?category=food&from=2026-10-01&to=2026-10-31` |
| GET | `/transactions/:id` | yes | View one |
| PATCH | `/transactions/:id` | yes | Update any of the four fields |
| DELETE | `/transactions/:id` | yes | Delete |
| GET | `/summary` | yes | Total income, expenses, balance and `monthlyTrend` (cached) |
| POST | `/budgets` | yes | Create (`month` as `YYYY-MM`, `monthlyGoal` > 0, `savingsTarget` ≥ 0) |
| GET | `/budgets` | yes | List yours |
| GET | `/budgets/:id` | yes | View one, plus `progress` (spent, remaining, savings) |
| PATCH | `/budgets/:id` | yes | Update `monthlyGoal` / `savingsTarget` (month cannot change) |
| DELETE | `/budgets/:id` | yes | Delete |

Only one budget is allowed per user per month (`409` otherwise).

Errors always look like `{ "error": { "message": "..." } }` with an appropriate status code (400 validation, 401 auth, 404 not found, 409 conflict).

## Project structure

```
src/
  app.js            builds the Express app (dependencies injectable for tests)
  server.js         starts the HTTP server
  config.js         environment configuration
  routes/           URL -> controller wiring
  controllers/      HTTP layer: read request, call a service, send response
  services/         business logic and persistence (JSON files via fs/promises),
                    token signing, in-memory TTL cache
  middleware/       request logger, input validation, authentication, error handling
  utils/            AppError (custom error class)
data/               JSON files created at runtime (git-ignored)
tests/              node:test + supertest
```

## Design notes

- **JWT:** HS256 tokens are signed and verified with Node's built-in `crypto`, with no extra dependency. Passwords are stored only as bcrypt hashes.
- **Per-user data:** the user id always comes from the verified token, never from the request body.
- **Caching:** `/summary` results are cached per user for `CACHE_TTL_MS` and invalidated whenever that user changes a transaction.
- **Persistence:** each resource is one JSON array file, rewritten on every change. This is fine for a small single-process app but is not safe for concurrent writers or large data. A database would be the next step.
- **Out of scope:** token refresh/revocation, rate limiting and CORS.
