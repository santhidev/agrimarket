import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

// Protected page — proves the auth flow works end-to-end. Middleware redirects
// unauthenticated users to /login; this is a server-side double-check.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>แดชบอร์ด</h1>
      <p>เข้าสู่ระบบสำเร็จ 🎉</p>
      <ul>
        <li>ID: {session.user.id}</li>
        <li>เบอร์โทร: {session.user.phone}</li>
        <li>Admin: {session.user.isAdmin ? "ใช่" : "ไม่ใช่"}</li>
      </ul>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="login__link">
          ออกจากระบบ
        </button>
      </form>
    </main>
  );
}
