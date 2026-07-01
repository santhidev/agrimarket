# ADR 0001: Stack migration from .NET/ABP to Next.js + Expo

- **Status**: Accepted
- **Date**: 2026-06-30
- **Supersedes**: the original .NET/ABP/Blazor/MAUI stack (PROJECT-BOOTSTRAP.md, Issues 01–02)

## Context

AgriMarket was originally scaffolded on **.NET 10 + ABP Framework 10.4 + Blazor WASM + .NET MAUI**. Issues 01 (Scaffolding) and 02 (Phone OTP auth) were implemented, but accumulating pain surfaced four **systemic** problems (not one-off bugs):

1. **ABP "magic" hidden everywhere** — convention-based routing, ObjectExtensionManager, dynamic claims, Redis config-key conventions. Each required hours of discovery because the docs didn't cover the edge cases (EF migration gap, Redis `Redis:Configuration` vs `ConnectionStrings:Redis`, `AppUser : IdentityUser` table-sharing breaking the EF model).

2. **Brittle environment** — .NET MAUI workload band mismatch (`10.0.100` vs `10.0.300`) consumed hours with no resolution; Android tooling on Windows is fragile.

3. **Blazor/MAUI not the team's strength** — smaller ecosystem, harder to hire, slower to find answers.

4. **ABP too heavy for MVP** — 27-project scaffold, deep module system, opinionated conventions that fight rapid iteration.

The primary goal is **shipping the MVP as fast as possible**. The .NET/ABP stack actively worked against that goal.

## Decision

Migrate the **entire stack** (backend + web + mobile) to a **TypeScript monorepo**:

| Layer | Choice |
|-------|--------|
| **Monorepo** | Turborepo + pnpm workspaces (`apps/` + `packages/`) |
| **Web + API** | Next.js 15 (App Router, React Server Components, API Routes) |
| **ORM** | Prisma + PostgreSQL (existing container reused) |
| **Auth** | NextAuth (Auth.js) with a phone-OTP custom provider |
| **Mobile** | Expo (React Native) — **deferred** until web is stable |
| **Runtime** | Node.js |

Structure:
```
apps/web/        # Next.js full-stack
apps/mobile/     # Expo (later)
packages/database/  # Prisma schema + client + migrations
packages/shared/    # zod schemas, types, business logic (knapsack)
packages/ui/        # shared RNW components (later)
```

## Rationale (how it resolves each pain point)

| Pain point | How the new stack resolves it |
|------------|-------------------------------|
| ABP magic | Next.js App Router has conventions, but Prisma (schema-first, transparent migrations) and NextAuth are far less "magical" than ABP's module/extension system. No hidden config keys. |
| Brittle env | Expo: `npx create-expo-app` + scan QR. No SDK bands, no workloads, no OpenJDK. Next.js: `npx create-next-app`. |
| Team/ecosystem | TS/React is the largest ecosystem; answers are abundant. |
| ABP too heavy | Turborepo scaffold is tiny; each package does one thing. |

Code sharing (DTOs, zod schemas, knapsack logic, Prisma types) across web + mobile is the deciding factor for monorepo — it eliminates drift that two repos would suffer.

## Consequences

- **Positive**: faster setup, larger ecosystem, end-to-end type safety, single language (TS), code sharing web↔mobile.
- **Negative**: the work done in Issues 01–02 (.NET scaffolding, ABP auth) is discarded. Domain knowledge (CONTEXT.md glossary, state machines, PRD user stories) is **kept** and re-expressed for the new stack.
- **Risk**: Next.js App Router + RSC has its own learning curve; mitigated by starting with mostly client components where RSC adds no value.
- **Mobile deferred**: Expo is out of initial scope (web + API first), same approach as the original plan.

## What is kept vs discarded

- **Kept (re-expressed, not copied)**: domain glossary (Demand, Offer, KYC, Follow, state machines), user stories, business rules, the docker-compose for Postgres+Redis (containers reset).
- **Discarded**: all `.NET/ABP/Blazor/MAUI` source (`src/`, `test/`), the old PRD/issues files, git history of the .NET work.
