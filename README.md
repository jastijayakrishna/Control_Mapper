# Control Mapper

**Live demo → [control-mapper.vercel.app](https://control-mapper.vercel.app)**

Real-time SOC 2 compliance coverage engine. Describe your infrastructure, instantly see which controls are covered, which have gaps, and exactly *why* — with a full provenance trace auditors can trust.

Built for GRC teams, security engineers, and compliance leads who are tired of managing coverage in spreadsheets.

---

## The Problem

Every company preparing for SOC 2 faces the same question: *"Which controls actually apply to us, and how covered are we?"*

The standard answer is a 200-row spreadsheet maintained by hand. Requirements change, infrastructure evolves, and the spreadsheet rots. When the auditor asks "why is this control marked as covered?", nobody has a traceable answer.

## What This Does

You toggle what your company uses — AWS, Okta SSO, MFA, encryption — and the engine evaluates every SOC 2 requirement against your actual setup in real time:

```
┌─────────────┐    ┌───────────────┐    ┌─────────────────────┐
│ Scope Panel │ →  │ Control List  │ →  │ Explanation Panel    │
│             │    │               │    │                      │
│ 14 toggles  │    │ 9 controls    │    │ Per-requirement      │
│ (AWS, MFA,  │    │ with live     │    │ provenance trace:    │
│  Okta...)   │    │ coverage bars │    │ condition + why      │
└─────────────┘    └───────────────┘    └─────────────────────┘
```

**Key design decision:** Coverage is *computed*, not stored. It's a pure function — `f(Control, Scope, CatalogVersion) → MappingResult`. No static join tables. Change your scope, and coverage recalculates in <100ms with a full audit trail.

---

## Architecture

```
Frontend (React 19 + Vite + Tailwind v4)
    │
    │  REST — /api/customers/:id/mapping
    ▼
Backend (Express + TypeScript)
    │
    ├── engine/mapper.ts    ← Pure function, zero side effects
    │     │
    │     ├── jsonLogic evaluation of appliesWhen conditions
    │     ├── Compensating group resolution (MAX, not SUM)
    │     ├── Weight capping at 1.0
    │     └── Full provenance trace generation
    │
    ├── db/database.ts      ← sql.js (asm.js build, zero WASM)
    └── db/seed-fn.ts       ← 15 requirements, 9 controls, 1 demo customer

Deployment: Vercel (frontend static + API as serverless function)
```

### Why These Choices

| Decision | Rationale |
|----------|-----------|
| **Pure mapping function** | Testable, cacheable, no hidden state. Same inputs always produce same output. |
| **jsonLogic for conditions** | Requirements have complex boolean conditions (`hasAws AND hasProduction AND hasOkta`). jsonLogic is a proven JSON-serializable rule engine. |
| **Compensating groups** | Real-world compliance: root MFA *or* root SSO-only satisfy the same control. Engine takes the MAX weight, not the sum. |
| **sql.js (asm.js)** | In-memory SQLite without native dependencies. Runs identically in dev, CI, and serverless. |
| **Provenance traces** | Every mapping result includes *why* — which condition clause matched, which scope fact failed, what the effective weight was. Auditors need this. |

---

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

Open **http://localhost:5173**. Toggle AWS, Production, Admin Users — watch coverage update instantly.

## Tests

```bash
cd backend
npm test            # 14 engine unit tests (mapper + provenance)
```

Test coverage includes: empty scope, full scope, compensating groups (both & one applicable), partial coverage, weight capping, missing requirements, condition summary formatting, and per-fact evaluation traces.

---

## How the Engine Works

1. Each **requirement** has a jsonLogic `appliesWhen` condition (e.g., `hasAws AND hasProduction`)
2. Each **control** references requirements with **weights** (e.g., 0.40 + 0.30 + 0.30 = 1.0)
3. Engine evaluates conditions against your scope, sums weights of applicable requirements
4. Coverage = total applicable weight, capped at 100%

### Compensating Groups

Some requirements are alternatives — root MFA *or* root SSO-only both satisfy the same security objective. When requirements share a `compensatingGroup`:
- Only the **highest-weight applicable** entry contributes
- Others are marked `contributed: false` in the provenance trace
- This prevents double-counting while preserving the audit trail

### Provenance Traces

Every requirement in the explanation includes:

```json
{
  "requirementId": "REQ-LA-003",
  "statement": "SSO enforced as sole authentication...",
  "applicable": false,
  "conditionSummary": "hasOkta AND (hasAws OR hasAzure OR hasGcp) AND hasProduction",
  "scopeEvaluation": [
    { "fact": "hasOkta", "label": "Okta SSO", "required": true, "actual": false, "satisfied": false },
    { "fact": "hasAws",  "label": "AWS",      "required": true, "actual": true,  "satisfied": true }
  ],
  "excludedBy": ["hasOkta"],
  "weight": 0.25,
  "contributed": false,
  "effectiveWeight": 0
}
```

A VP or auditor can look at this and immediately understand: *"This requirement was excluded because Okta SSO is not enabled in the customer's environment."*

---

## Demo Catalog

| | Count | Examples |
|---|---|---|
| **Requirements** | 15 | MFA enforcement, encryption at rest, network segmentation, incident response |
| **Controls** | 9 | CC6.1–CC6.8 (Logical Access, Boundaries, Crypto), CC7.1–CC7.3 (Monitoring, Detection, IR) |
| **Scope Facts** | 14 | Cloud providers (AWS/Azure/GCP), identity (Okta, MFA), security, operations |

## API

```
GET  /api/customers/:id/mapping           # full computed mapping with provenance
GET  /api/customers/:id/coverage-summary  # aggregate coverage stats
GET  /api/customers/:id/scope             # current scope facts
POST /api/customers/:id/scope             # update scope facts (merge)
GET  /api/catalog/versions                # catalog versions
GET  /api/catalog/:v/requirements         # requirements for a catalog version
GET  /api/catalog/:v/controls             # controls for a catalog version
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| **Frontend** | React 19, Vite, Tailwind CSS v4 |
| **Backend** | Node.js, TypeScript, Express |
| **Database** | sql.js (in-memory SQLite, asm.js build) |
| **Engine** | json-logic-js for condition evaluation |
| **Testing** | Vitest (14 unit tests) |
| **Deployment** | Vercel (static frontend + serverless API) |

---

## Roadmap — What Would Make This Production-Grade

This is a working MVP. Below is what it would take to turn this into something a real GRC team would pay for — ordered by impact.

### Phase 1: Multi-Tenancy & Persistence (Week 1–2)

**What's missing:** Right now the database is in-memory — every serverless cold start re-seeds from scratch. Scope changes don't persist across deploys. There's only one hardcoded customer.

**What to build:**
- **Postgres on Supabase/Neon** — Replace sql.js with a real database. Prisma ORM for migrations.
- **Auth (Clerk or NextAuth)** — Multi-tenant login. Each org sees only their own scope and mappings.
- **Scope history** — Store every scope change with a timestamp. `customer_scope_history` table enables "show me coverage as of March 1st."

**Why it matters:** No enterprise will use a tool where their data vanishes on refresh. Persistence + auth is table stakes.

---

### Phase 2: Real Framework Coverage (Week 2–3)

**What's missing:** The demo has 15 requirements and 9 controls. A real SOC 2 Type II catalog has 60+ controls across all Trust Services Criteria. And customers want ISO 27001, HIPAA, PCI-DSS — not just SOC 2.

**What to build:**
- **Full SOC 2 TSC catalog** — All CC-series controls with proper requirement mappings and authoritative sources.
- **Multi-framework support** — Add `framework` field to the catalog. The engine already supports this — the `Control.framework` field exists. Build a framework selector in the UI.
- **Cross-framework mapping** — "CC6.1 maps to ISO 27001 A.9.1.1" — show which controls satisfy multiple frameworks simultaneously. This is the killer feature for companies doing SOC 2 + ISO together.

**Why it matters:** Every competitor (Drata, Vanta, Tugboat Logic) charges $15k+/year for this. A free, open-source version with transparent mapping logic is a real market gap.

---

### Phase 3: Evidence Linking (Week 3–4)

**What's missing:** The engine says "CC6.1 is 100% covered" but there's no proof. An auditor will ask: *"Show me the evidence that MFA is actually enforced."*

**What to build:**
- **Evidence model** — `evidence` table linking to requirements: `{ requirementId, type: 'screenshot'|'policy'|'config_export', url, uploadedAt, reviewedBy }`.
- **Evidence status per requirement** — Extend the provenance trace: `applicable: true, evidenceStatus: 'uploaded' | 'pending' | 'expired'`.
- **Coverage = applicable AND evidenced** — Change the coverage formula: a requirement without evidence is a gap, not a pass.

**Why it matters:** This is the difference between "compliance dashboard" and "audit-ready platform." Without evidence linking, the tool is informational. With it, it replaces Drata.

---

### Phase 4: API Integrations (Week 4–6)

**What's missing:** Scope facts are toggled manually. In reality, you can *detect* most of these programmatically.

**What to build:**
- **AWS integration** — Call `sts:GetCallerIdentity` + `iam:GetAccountSummary` to auto-detect: hasAws, hasAdminUsers, hasRootAccountMfa.
- **Okta integration** — Check if SAML apps exist → hasOkta. Check if MFA policies are enforced → hasMfa.
- **GitHub integration** — Check branch protection rules → hasGithub, hasBranchProtection.
- **Drift detection** — Periodically re-check integrations. If MFA gets disabled, the scope auto-updates and coverage drops. Alert the user.

**Why it matters:** Manual toggles don't scale. Automated scope detection is what separates a toy from a tool. It also enables continuous compliance — the VP dashboard shows real-time drift, not quarterly snapshots.

---

### Phase 5: Export & Reporting (Week 5–6)

**What to build:**
- **PDF export** — Generate a "Compliance Posture Report" with current scope, coverage breakdown, and provenance traces. Branded, timestamped, ready to hand to an auditor.
- **CSV/JSON export** — Bulk export for integration with GRC platforms (ServiceNow, OneTrust).
- **Slack/email alerts** — Notify when coverage drops below a threshold or when evidence expires.
- **Changelog** — "On April 15, Okta SSO was disabled. Coverage for CC6.1 dropped from 100% to 75%."

---

### Phase 6: The Differentiator — Open Catalog

**What to build:**
- **Public catalog API** — Let anyone query the requirement ↔ control mappings via API. Open-source the catalog itself.
- **Community contributions** — Let users submit new frameworks, requirements, and mappings via PR. Version them like software.
- **Catalog diffing** — "Between v2024.1 and v2024.2, 3 requirements were added and 1 was deprecated."

**Why this wins:** Drata and Vanta treat their control catalogs as proprietary. An open, versionable, forkable compliance catalog is infrastructure that doesn't exist yet. This is the moat.

---

## License

MIT
