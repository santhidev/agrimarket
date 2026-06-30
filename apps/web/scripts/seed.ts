// Seed the bootstrap admin from the ADMIN_PHONE env var.
// Run with: pnpm db:seed (from repo root) — delegates to `node scripts/seed.ts`.
import { seedAdmin } from "@agrimarket/database";

async function main() {
  const phone = process.env.ADMIN_PHONE;
  if (!phone) {
    console.error("ADMIN_PHONE is not set. Nothing to seed.");
    process.exit(1);
  }

  await seedAdmin(phone);
  console.log(`✓ Admin user ensured for phone ${phone}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
