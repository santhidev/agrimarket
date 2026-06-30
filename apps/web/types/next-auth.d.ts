import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

// Augment Auth.js types with AgriMarket-specific user fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    phone?: string;
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    phone?: string;
    isAdmin?: boolean;
  }
}
