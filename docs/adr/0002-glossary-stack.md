# ADR 0002: Glossary — stack terms

- **Status**: Accepted
- **Date**: 2026-06-30

A short vocabulary for the TypeScript monorepo, so domain docs and code stay consistent.

| Term | Meaning |
|------|---------|
| **Workspace** | A pnpm workspace package — `apps/web`, `apps/mobile`, `packages/database`, `packages/shared`, `packages/ui`. Referenced by `@agrimarket/<name>`. |
| **`@agrimarket/database`** | The Prisma package: `schema.prisma`, generated client, migrations. Imported by both apps for typed DB access. |
| **`@agrimarket/shared`** | Stack-agnostic shared code: zod schemas, plain types, business logic (e.g. the Bounded Knapsack best-offer solver), pure functions. No React, no Prisma. |
| **App Router** | Next.js 15 file-based router under `apps/web/app/`. Routes = folders; `page.tsx`, `layout.tsx`, `route.ts` (API). |
| **RSC** | React Server Component — the default in App Router. Client interactivity opts in with `"use client"`. |
| **API Route** | A `route.ts` file under `app/` exposing REST endpoints (GET/POST/...). The backend lives here for MVP. |
| **Prisma schema** | Single source of truth for the data model (`packages/database/prisma/schema.prisma`). `prisma migrate dev` generates SQL migrations + the typed client. |
| **Auth.js provider** | A custom NextAuth credentials provider implementing phone-OTP: `requestOtp` + `verifyOtp` callbacks. |
| **Expo app** | `apps/mobile` — React Native via Expo (managed workflow). Deferred until web is stable. |
| **Turborepo task** | A named build/test/lint pipeline in `turbo.json`, run across workspaces with caching (`turbo build`, `turbo dev`, etc.). |

## Naming conventions

- **Domain types** (Demand, Offer, KYC, Follow...): keep the **English** names from `CONTEXT.md` in code and API paths (`/api/demands`, `POST /offers`).
- **User-facing strings**: **Thai** (UI labels, error messages, notifications).
- **DB tables**: snake_case, plural (`demands`, `offers`, `kyc_submissions`). Set via Prisma `@@map`.
- **API paths**: kebab-case, plural resources (`/api/product-suggestions`).
