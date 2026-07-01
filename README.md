# AgriMarket

ตลาดขายตรง ตัดพ่อค้าคนกลาง — ผู้ซื้อประกาศรับซื้อตรง เกษตรกรเสนอขายแข่งราคา

## Stack

TypeScript monorepo. See [CONTEXT.md](CONTEXT.md) for the domain and [docs/adr/](docs/adr/) for decisions.

- **Monorepo**: Turborepo + pnpm workspaces
- **Web + API**: Next.js 15 (App Router)
- **ORM**: Prisma + PostgreSQL
- **Auth**: Auth.js (NextAuth) — phone OTP
- **Mobile**: Expo (deferred)

## Quick start

```bash
# Start Postgres + Redis
docker compose up -d

# Install + run the web app (once scaffolded)
pnpm install
pnpm dev
```

## Docs

- [CONTEXT.md](CONTEXT.md) — domain glossary, state machines, business rules
- [docs/adr/](docs/adr/) — architecture decisions
- [docs/agents/](docs/agents/) — how agent skills consume this repo
