import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma, OtpService } from "@agrimarket/database";
import { verifyOtpSchema } from "@agrimarket/shared";

// Full Auth.js v5 config (Node runtime — uses Prisma + Redis).
// The Credentials provider implements the phone-OTP flow:
//   request-otp (separate route) → user enters code → signIn("credentials")
//   → this authorize() verifies the code against Redis + find-or-create user.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "phone-otp",
      credentials: {
        phone: { label: "เบอร์โทรศัพท์", type: "text" },
        code: { label: "รหัสยืนยัน", type: "text" },
      },
      async authorize(raw) {
        const parsed = verifyOtpSchema.safeParse({
          phone: raw?.phone,
          code: raw?.code,
        });
        if (!parsed.success) {
          return null;
        }
        const { phone } = parsed.data;

        const ok = await OtpService.verify(phone, parsed.data.code);
        if (!ok) {
          return null;
        }

        // Find-or-create the user (auto-register on first login).
        const user = await prisma.user.upsert({
          where: { phone },
          update: {},
          create: { phone },
          select: { id: true, phone: true, isAdmin: true },
        });

        return {
          id: user.id,
          phone: user.phone,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.phone = token.phone as string;
        session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
  },
});
