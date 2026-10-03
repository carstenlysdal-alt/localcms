import "next-auth";

declare module "next-auth" {
  interface User {
    roleId: string;
    roleName: string;
    /** AKTIV instans (den by der redigeres) — hjemmeinstansen indtil brugeren skifter by (lib/instance-access.ts). */
    instansId: string;
    /** Brugerens hjemmeinstans (User.instansId), uafhængigt af den aktive. */
    homeInstansId?: string;
    /** Samme som `instansId` (aktiv); bruges af getSessionState, som altid genvalidérer den mod databasen. */
    activeInstansId?: string;
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
    /** Hjemmeinstans (sat ved login og genlæst fra databasen). */
    instansId?: string;
    /** Aktiv instans: sættes kun ved login (= hjem) og af switchInstance via update-triggeren; valideres mod DB ved hver læsning. */
    activeInstansId?: string;
    authorId?: string | null;
    permissions?: string[];
    authTime?: number;
  }
}
