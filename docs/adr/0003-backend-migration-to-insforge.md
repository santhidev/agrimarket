# ADR 0003: Backend migration from Prisma/Auth.js to InsForge BaaS

- **Status**: Accepted
- **Date**: 2026-06-30
- **Supersedes**: the data + auth layers described in [ADR 0001](0001-stack-migration-to-nextjs-expo.md) (the monorepo structure is retained; only the backend implementation changes)

## Context

ADR 0001 established a TypeScript monorepo (Next.js 15 + Prisma 6 + PostgreSQL via docker-compose + Auth.js v5 + Redis for OTP). Issues 01–02 shipped a working scaffold + phone OTP auth on top of that stack.

The project was then linked to **InsForge** — an all-in-one Postgres-based BaaS (database, auth, storage, edge functions, realtime, payments). The decision was made to replace the self-hosted Prisma + Auth.js + Redis backend with InsForge so the team doesn't run/maintain database infrastructure and gains managed storage (needed for KYC/offer photos), realtime, and deploy tooling.

## Decision

Migrate the **entire backend** to InsForge, keeping the Next.js App Router + Turborepo monorepo shell.

| Layer | Before (ADR 0001) | After (this ADR) |
|-------|-------------------|------------------|
| **Database** | Prisma 6 + PrismaPg + docker-compose Postgres | `@insforge/sdk` `database` module (`.from().select()/insert()/update()`) against managed Postgres |
| **Auth** | Auth.js v5 Credentials + JWT | **Custom phone-OTP via an InsForge edge function** (request-otp → store code → verify-otp → issue JWT). InsForge's built-in auth (email/password + OAuth) does not cover phone OTP, so we implement it as an edge function that still issues an InsForge-compatible session. |
| **OTP store** | Redis (ioredis) | InsForge table or edge-function in-memory store (TTL) — no Redis dependency for OTP |
| **Storage** | (not yet built) | `@insforge/sdk` `storage` module (buckets, RLS) for KYC + offer photos |
| **Realtime** | (planned, Socket.io/SSE) | `@insforge/sdk` `realtime` module |
| **Background jobs** | (planned, BullMQ + Redis) | InsForge schedules (if available) or edge functions |
| **Monorepo** | Turborepo + pnpm workspaces | **Unchanged** — `apps/web`, `packages/shared`, `packages/database` (renamed/repurposed to hold InsForge client helpers) |

**What is removed:** Prisma (schema, client, migrations), `@prisma/adapter-pg`, `pg`, Auth.js (`next-auth`), `ioredis`, the Redis OTP service, the docker-compose Postgres/Redis dependency for runtime (containers remain only for local dev tooling if needed).

**What is kept:** Next.js 15 App Router, Turborepo, pnpm workspaces, the shared zod schemas, the domain glossary (`CONTEXT.md`), the PRD user stories, and the 19-issue breakdown (their "Implementation Decisions" sections get revised).

## Rationale

- **No infra to run:** managed Postgres + storage + auth remove the docker-compose Postgres/Redis from the critical path (the exact "brittle environment" pain ADR 0001 cited for .NET).
- **Storage for photos:** KYC (ID card + selfie) and offer photos were coming in Issues 06/10; InsForge Storage gives this for free with RLS.
- **Realtime + edge functions** replace planned custom Socket.io/SSE + BullMQ work (Issues 17/09).
- **Phone OTP gap:** InsForge auth lacks phone OTP, so we implement it as an edge function — preserving the PRD's phone-as-primary-identifier + `000000` test mode requirement.

## Consequences

- **Positive:** no DB/auth/storage infra to maintain; one SDK for all backend concerns; storage + realtime arrive without extra work; the PRD's domain model (Demand, Offer, KYC, Follow) translates directly to InsForge tables.
- **Negative:** the work in Issues 01–02 (Prisma schema, Auth.js OTP, Redis) is discarded. The `users` table + admin seed are re-created on InsForge.
- **Risk:** custom OTP in an edge function must correctly issue InsForge-compatible sessions; mitigated by following the InsForge auth skill's JWT/session guidance.
- **Secrets:** `.insforge/project.json` (with API key) and `.env.local` (with anon key + URL) are local-only and gitignored.

## What is kept vs discarded

- **Kept (re-expressed):** `CONTEXT.md` domain glossary + state machines; PRD user stories; the 19-issue breakdown (revised backend decisions); Turborepo + Next.js shell; shared zod schemas; the 29 installed agent skills.
- **Discarded:** `packages/database/prisma/` (schema + migrations + generated client), `packages/database/src/otp.ts` + `redis.ts`, `apps/web/auth.ts` + `auth.config.ts` + `middleware.ts` (Auth.js), the Auth.js route handlers, the `seed.ts` script, docker-compose Postgres/Redis from the runtime path.
