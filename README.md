# Control Mapper

Real-time SOC 2 control coverage engine. Toggle what your company uses, instantly see what's covered and what's not.

## What It Does

You describe your environment (AWS? Okta? MFA enabled?) by flipping toggles. The engine evaluates every SOC 2 requirement against your setup and computes coverage per control — live, with a full explanation of *why* each requirement applies or doesn't.

```
┌─────────────┐    ┌───────────────┐    ┌────────────────────┐
│ Scope Panel │ -> │ Control List  │ -> │ Explanation Panel   │
│             │    │               │    │                     │
│ 14 toggles  │    │ 9 controls    │    │ Per-requirement     │
│ (AWS, MFA,  │    │ with live     │    │ provenance trace:   │
│  Okta...)   │    │ coverage bars │    │ which facts matched │
└─────────────┘    └───────────────┘    └────────────────────┘
```

**Key concept:** Mapping is computed, not stored. It's a pure function — same inputs always produce the same output. No static join tables.

## Quick Start

Requires **Node.js 18+**.

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run seed        # seeds SQLite with 15 requirements + 9 controls
npm run dev         # starts API on localhost:3001

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev         # starts UI on localhost:5173
```

Open **http://localhost:5173**. Try toggling AWS, Production, Admin Users — watch coverage update instantly.

## Run Tests

```bash
cd backend
npm test            # 14 engine unit tests
```

## How the Engine Works

1. Each **requirement** has a jsonLogic condition (e.g. `hasAws AND hasProduction`)
2. Each **control** references requirements with **weights** (e.g. 0.4, 0.3, 0.3)
3. Engine evaluates conditions against your scope, sums weights of applicable requirements
4. Coverage = total weight, capped at 100%

**Compensating groups:** Some requirements are alternatives (root MFA *or* root SSO-only). Only the best weight in a group counts — not both.

## Demo Catalog

| | Count | Examples |
|---|---|---|
| **Requirements** | 15 | MFA enforcement, encryption at rest, incident response |
| **Controls** | 9 | CC6.1–CC6.8, CC7.1–CC7.3 |
| **Scope Facts** | 14 | Cloud providers, identity, security, operations |

## API

```
GET  /api/customers/:id/mapping           # full computed mapping
GET  /api/customers/:id/coverage-summary   # aggregate stats
GET  /api/customers/:id/scope              # current scope
POST /api/customers/:id/scope              # update scope facts
GET  /api/catalog/versions                 # catalog versions
GET  /api/catalog/:v/requirements          # requirements list
GET  /api/catalog/:v/controls              # controls list
```

## Tech

React 19 + Vite + Tailwind v4 | Node + TypeScript + Express | SQLite | json-logic-js | Vitest
