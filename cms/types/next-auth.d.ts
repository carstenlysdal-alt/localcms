import "next-auth";

declare module "next-auth" {
  interface User {
    roleId: string;
    roleName: string;
    instansId: string;
    authorId: string | null;
    permissions: string[];
    /** ms siden epoch for login (sættes i jwt-callback); bruges til at afvise sessioner udstedt før et kodeskift. */
    authTime?: number;
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roleId?: string;
    roleName?: string;
    instansId?: string;
    authorId?: string | null;
    permissions?: string[];
    authTime?: number;
  }
}
