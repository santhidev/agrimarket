import { prisma } from "@agrimarket/database";
import Link from "next/link";

// Server Component — exercises the DB on the server to prove the wiring works.
export default async function HomePage() {
  let userCount = 0;
  try {
    userCount = await prisma.user.count();
  } catch {
    userCount = -1; // DB not reachable; health route will report details.
  }

  return (
    <main>
      <h1>AgriMarket</h1>
      <p>ตลาดขายตรง ตัดพ่อค้าคนกลาง</p>
      <p>
        Users in DB: <strong>{userCount >= 0 ? userCount : "unreachable"}</strong>
      </p>
      <p>
        <Link href="/api/health">/api/health</Link>
      </p>
    </main>
  );
}
