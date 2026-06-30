import { redirect } from "next/navigation";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { signOutAction } from "@/app/login/actions";

// Protected page — proves the auth flow works end-to-end.
export default async function DashboardPage() {
  const client = await createInsForgeServerClient();
  const { data } = await client.auth.getCurrentUser();

  if (!data?.user) {
    redirect("/login");
  }

  const user = data.user;
  const profile = user.user_metadata ?? {};

  return (
    <main>
      <h1>แดชบอร์ด</h1>
      <p>เข้าสู่ระบบสำเร็จ 🎉</p>
      <ul>
        <li>ID: {user.id}</li>
        <li>เบอร์โทร: {profile.phone ?? user.email}</li>
        <li>Admin: {profile.is_admin ? "ใช่" : "ไม่ใช่"}</li>
      </ul>
      <form action={signOutAction}>
        <button type="submit" className="login__link">
          ออกจากระบบ
        </button>
      </form>
    </main>
  );
}
