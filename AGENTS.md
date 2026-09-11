# AGENTS.md

Context for AI coding agents (Claude Code, Cursor, Codex, Opencode, etc.) working
on the StellarSplit monorepo. If you're a human contributor, `CONTRIBUTING.md` and
`docs/repository-map.md` cover the same ground in more detail — this file is the
condensed version an agent needs before touching code.

## What this project is

StellarSplit is a mobile-first bill-splitting app. Users photograph a receipt,
an ML service extracts line items via OCR, the backend computes the split, and
settlement happens on Stellar (XLM/USDC) via Soroban smart contracts for
on-chain escrow and payouts.

## Monorepo layout

```
StellarSplit/
├── frontend/     React 19 + TypeScript + Vite + TailwindCSS v4 dashboard
├── backend/      NestJS + TypeORM + PostgreSQL REST/WebSocket API
├── contracts/    Soroban smart contracts (Rust)
├── ml-service/   Python + TensorFlow receipt OCR service
├── docs/         Architecture, API, and deployment docs
└── test/         Integration and e2e tests (root-level jest config)
```

Each package has its own `package.json` / build — this is not a single
top-level app. See `docs/repository-map.md` for a directory-by-directory
breakdown of what lives where inside `frontend/src` and `backend/src`.

## Before you start

1. Read the linked GitHub issue fully, including comments — maintainers may
   have scoped or clarified the ask there.
2. Check `docs/` for an existing architecture doc relevant to what you're
   touching (`docs/API.md`, `docs/STELLAR_INTEGRATION.md`,
   `docs/RECEIPT_FLOW.md`, `docs/COMPONENTS.md`, `backend/architecture.md`)
   before assuming how a subsystem works.
3. For contract work, check `docs/contracts-status.md` /
   `contracts/README.md` first — contracts are either **Production** (must
   pass CI), **Experimental** (CI-excluded, expect rough edges), or
   **Archived** (do not build on these).

## Commands

**Backend** (`cd backend`)
```bash
npm install
npm run start:dev       # dev server, watch mode, http://localhost:3001
npm run lint
npm test                # jest
npm run test:coverage
npm run migration:run   # run pending TypeORM migrations
```

**Frontend** (`cd frontend`)
```bash
npm install
npm run dev              # vite dev server, http://localhost:5173
npm run lint
npm test                 # vitest
npm run build
```

**Contracts** (`cd contracts`)
```bash
rustup target add wasm32-unknown-unknown
bash scripts/ci-contracts.sh fmt
bash scripts/ci-contracts.sh test
bash scripts/ci-contracts.sh build
```

**ML service** (`cd ml-service`)
```bash
pip install -r requirements.txt
python -m app
```

**Everything via Docker** (Postgres + shared services):
```bash
docker-compose up
```

## Conventions

- **TypeScript** everywhere in `frontend`/`backend` — no new `.js` files.
  Functional components + hooks in React, not classes.
- **Branch names**: `feature/…`, `fix/…`, `docs/…`, `refactor/…`, `test/…`,
  `chore/…`, `ui/…`.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat(scope): …`, `fix(scope): …`, etc.).
- **PRs**: title format `[Type] Brief description (#issue-number)`; use
  `.github/pull_request_template.md` (auto-filled when you open a PR).
- Backend errors use NestJS's built-in exceptions (`BadRequestException`,
  `NotFoundException`, etc.) — don't throw raw `Error`.
- Never commit real Stellar keys, `.env` files, or webhook secrets. Use
  `STELLAR_NETWORK=testnet` for all development and test work.
- Mobile-first: any UI change should be checked at small screen widths
  (320px+) before it's considered done.

## Testing expectations

Every code PR needs tests, not just a passing build. Aim for >80% coverage on
new code. Contract PRs must pass all three `ci-contracts.sh` checks before
they're considered for merge, not just `build`.

## Where things commonly go wrong

- `contracts/` fails to compile if the `wasm32-unknown-unknown` target isn't
  installed — that's an environment issue, not a code issue, on a fresh
  setup.
- OCR/`ml-service` changes should be tested against a few real receipt
  photos, not just synthetic fixtures — lighting and skew break naive
  parsers.
- Webhook and payment code must handle Stellar network errors explicitly
  (`INSUFFICIENT_BALANCE`, `INVALID_ADDRESS`, timeouts) — don't let these
  bubble up as unhandled exceptions.

## GrantFox contributions

Issues tagged `GrantFox OSS` are tracked for campaign rewards. Maintainers
review and merge before deciding what to submit for a reward at the end of a
campaign — so a mergeable, tested, reviewed PR is what actually counts, not
just an opened one. Link the issue with `Closes #N` in your PR so it's
traceable.

## Getting unstuck

Ask in [Discord](https://discord.gg/mpzbyTY6) rather than spending an hour
stuck on environment setup — most blockers here are quick to answer live.