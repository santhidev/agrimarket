# Architecture Decision Records

Decisions that shape AgriMarket, in chronological order. Each ADR is immutable once Accepted — supersession is recorded in a new ADR that references the old one.

| # | Title | Status |
|---|-------|--------|
| [0001](0001-stack-migration-to-nextjs-expo.md) | Stack migration from .NET/ABP to Next.js + Expo | Accepted |
| [0002](0002-glossary-stack.md) | Glossary — stack terms | Accepted |

## How to write an ADR

- One file per decision: `NNNN-short-slug.md` (zero-padded number).
- Sections: **Context**, **Decision**, **Rationale**, **Consequences**.
- Keep it short and opinionated — an ADR records *why*, not *how to use*.
- If a decision is overturned, write a new ADR that `Supersedes` the old one; do not edit the old ADR's decision.
