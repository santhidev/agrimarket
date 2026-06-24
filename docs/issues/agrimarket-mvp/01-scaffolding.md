Status: ready-for-human

## What to build

ABP Framework solution structure with 27 projects (7 host + 10 deep modules + 5 frontend + 5 test). PostgreSQL + Redis connection. Admin bootstrap via ABP IDataSeeder from ADMIN_PHONE env. Test OTP mode 000000. Solution structure: AgriMarket.sln with src/ (Domain, Domain.Shared, Application, Application.Contracts, EntityFrameworkCore, HttpApi.Host, DbMigrator), modules/ (Optimization, Escrow — 5 projects each), shared/, web/, admin/, mobile/, rider/, test/.

## Acceptance criteria

- [ ] ABP solution compiles with all 27 projects
- [ ] PostgreSQL connection works (EF Core DbContext)
- [ ] Redis cache connection works
- [ ] Admin bootstrap creates admin user from ADMIN_PHONE env
- [ ] Hangfire dashboard accessible
- [ ] Test OTP mode 000000 returns success

## Blocked by

None - can start immediately