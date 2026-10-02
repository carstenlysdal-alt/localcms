import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { clearLoginFailures, getClientIp, isLoginLocked, recordLoginFailure } from "./ratelimit";
import { can, type Permission } from "./permissions";
import { hashPassword } from "./password";
import { isSessionStale } from "./session-validity";

// Dummy-hash så svartiden er ens, uanset om e-mailen findes (forhindrer bruger-enumerering via timing).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("dummy-password-for-timing"));

export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60;

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT'en bærer rettigheder fra login-tidspunktet; derfor kort levetid (T5 P2-3) + databaseopslag i alle actions
  // (getAuthorizedUser / getFreshSession). 12 t dækker en arbejdsdag; updateAge fornyer ved aktivitet.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS, updateAge: SESSION_UPDATE_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Adgangskode", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const ip = getClientIp(request?.headers ?? new Headers());
        // Lockout: 5 fejl pr. e-mail / 20 pr. IP i 15 min. (proces-lokal; se lib/ratelimit for produktionsnote).
        if (await isLoginLocked(parsed.data.email, ip)) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: { role: true },
        });
        const passwordOk = await compare(parsed.data.password.slice(0, 200), user?.passwordHash ?? (await getDummyHash()));
        // Deaktiverede brugere afvises med samme fejl som forkert kode (røber ikke kontoens tilstand).
        if (!user || !passwordOk || user.deaktiveretTid) {
          await recordLoginFailure(parsed.data.email, ip);
          return null;
        }
        await clearLoginFailures(parsed.data.email);
        return {
          id: user.id,
          email: user.email,
          name: user.navn,
          roleId: user.roleId,
          roleName: user.role.navn,
          instansId: user.instansId,
          authorId: user.authorId,
          permissions: Array.isArray(user.role.permissions) ? user.role.permissions as string[] : [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // authTime sættes kun ved login (ikke ved forlængelse) — se lib/session-validity.ts.
        token.authTime = Date.now();
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.instansId = user.instansId;
        token.authorId = user.authorId;
        token.permissions = user.permissions;
        return token;
      }
      // Eksisterende session: afvis (return null → ingen session) hvis brugeren er slettet/deaktiveret, eller hvis
      // adgangskoden er skiftet/nulstillet efter at sessionen blev udstedt. Fejler opslaget, ender sessionen også (fail-closed).
      if (!token.sub) return null;
      const row = await db.user.findUnique({ where: { id: token.sub }, select: { passwordChangedAt: true, deaktiveretTid: true } });
      if (!row || row.deaktiveretTid || isSessionStale(token.authTime, row.passwordChangedAt)) return null;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roleId = token.roleId as string;
        session.user.roleName = token.roleName as string;
        session.user.instansId = token.instansId as string;
        session.user.authorId = token.authorId as string | null;
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.authTime = typeof token.authTime === "number" ? token.authTime : undefined;
      }
      return session;
    },
  },
});

export type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  instansId: string;
  authorId: string | null;
  roleName: string;
  permissions: string[];
  /** True indtil brugeren har skiftet en midlertidig adgangskode. */
  mustChangePassword: boolean;
};

export type AuthorizeOptions = {
  /** Kun "Min konto"-kodeskiftet må sætte denne: lader en bruger med midlertidig adgangskode igennem. */
  allowPasswordChange?: boolean;
};

export type SessionState =
  | { status: "anonymous" }
  | { status: "must-change-password"; user: AuthorizedUser }
  | { status: "ok"; user: AuthorizedUser };

/**
 * Slår den indloggede bruger op i DATABASEN og afviser: ukendt/deaktiveret bruger, og session udstedt før
 * seneste kodeskift (stjålen/gammel session). Tvungen kodeskift afgøres af kalderen (se getAuthorizedUser).
 */
export async function getSessionState(): Promise<SessionState> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { status: "anonymous" };
  const user = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!user || user.deaktiveretTid || isSessionStale(session.user.authTime, user.passwordChangedAt)) return { status: "anonymous" };
  const authorized: AuthorizedUser = {
    id: user.id,
    name: user.navn,
    email: user.email,
    instansId: user.instansId,
    authorId: user.authorId,
    roleName: user.role.navn,
    permissions: Array.isArray(user.role.permissions) ? (user.role.permissions as string[]) : [],
    mustChangePassword: user.mustChangePassword,
  };
  return { status: user.mustChangePassword ? "must-change-password" : "ok", user: authorized };
}

/**
 * Server-side autorisation uafhængig af proxy.ts og af JWT-indholdet.
 * auth() verificerer JWT-signaturen (en cookie alene er aldrig nok); herefter slås brugeren op
 * i databasen, så slettede brugere og ændrede roller/rettigheder får effekt med det samme
 * (JWT'en bærer ellers rettighederne fra login-tidspunktet).
 * Returnerer null hvis ikke logget ind, bruger ikke findes, eller `permission` mangler.
 */
export async function getAuthorizedUser(permission?: Permission | Permission[], options: AuthorizeOptions = {}): Promise<AuthorizedUser | null> {
  const state = await getSessionState();
  if (state.status === "anonymous") return null;
  // Tvungen kodeskift: ALLE sider og actions nægtes, indtil der er valgt en ny adgangskode (kun kodeskiftet selv slipper igennem).
  if (state.status === "must-change-password" && !options.allowPasswordChange) return null;
  const result = state.user;
  if (permission) {
    const needed = Array.isArray(permission) ? permission : [permission];
    // Kræver mindst ÉN af de angivne rettigheder (OR) — bruges til fallback-roller.
    if (!needed.some((p) => can(result, p))) return null;
  }
  return result;
}

/**
 * Drop-in-erstatning for `auth()` i server actions: returnerer `{ user }` hvor brugeren og rettighederne er slået op i
 * DATABASEN (ikke læst fra den op til 12 timer gamle JWT). null hvis ikke logget ind eller brugeren er slettet.
 * Kald stadig `can(session.user, …)` for den konkrete rettighed.
 */
export async function getFreshSession(): Promise<{ user: AuthorizedUser } | null> {
  const user = await getAuthorizedUser();
  return user ? { user } : null;
}
