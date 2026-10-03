import { mock } from "node:test";
import { db } from "../../lib/db";

/**
 * Hjælper til tests af server actions og redaktionssider uden en rigtig Next.js-request.
 *
 * `installNextMocks()` erstatter `next-auth` (så `auth()` returnerer den bruger testen vælger), `next/cache` og
 * `next/navigation`. Selve `lib/auth.ts` (getAuthorizedUser/getFreshSession) er den RIGTIGE kode og slår bruger og
 * rettigheder op i test-databasen — så testene dækker præcis den DB-baserede autorisation (ikke JWT'en).
 * Kald den FØR modulet under test importeres (dynamisk import), og kun én gang pr. testfil (hver fil er egen proces).
 * Kræver `--experimental-test-module-mocks` (sat af scripts/test-runner.ts).
 */
export const session: {
  userId: string | null;
  staleJwtPermissions: string[];
  authTime: number | null;
  signInProviders: string[];
  activeInstansId: string | null;
  /** callbacks fra lib/auth.ts' NextAuth-konfiguration (de rigtige jwt/session-callbacks), så tests kan køre dem. */
  callbacks: { jwt: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>; session: (args: Record<string, unknown>) => unknown } | null;
} = {
  userId: null,
  staleJwtPermissions: [],
  /** ms-tidspunkt for login i JWT'en (lib/session-validity.ts); null = token uden authTime (som før funktionen fandtes). */
  authTime: null,
  /** Hvilke providers signIn() er kaldt med (kun navnet — aldrig credentials). */
  signInProviders: [],
  /** Aktiv instans som JWT-claim (token.activeInstansId); null = token udstedt før netværksadgang fandtes (ingen claim → hjemmeinstans). */
  activeInstansId: null,
  callbacks: null,
};

export function installNextMocks() {
  // AuthError hænger på default-eksporten (node:test kan ikke blande defaultExport og namedExports for CJS).
  mock.module("next-auth", {
    defaultExport: Object.assign((config?: { callbacks?: typeof session.callbacks }) => {
      session.callbacks = config?.callbacks ?? null;
      return {
      handlers: {},
      auth: async () => (session.userId ? { user: { id: session.userId, permissions: session.staleJwtPermissions, ...(session.authTime !== null ? { authTime: session.authTime } : {}), ...(session.activeInstansId !== null ? { activeInstansId: session.activeInstansId } : {}) } } : null),
      // Som Auth.js' unstable_update: kører den RIGTIGE jwt-callback med trigger "update" og gemmer den genvaliderede claim.
      unstable_update: async (data: Record<string, unknown>) => {
        if (!session.userId || !session.callbacks) return null;
        const token = await session.callbacks.jwt({
          token: { sub: session.userId, ...(session.authTime !== null ? { authTime: session.authTime } : {}), ...(session.activeInstansId !== null ? { activeInstansId: session.activeInstansId } : {}) },
          trigger: "update",
          session: data,
        });
        if (!token) return null;
        session.activeInstansId = typeof token.activeInstansId === "string" ? token.activeInstansId : null;
        return { user: { id: session.userId } };
      },
      signIn: async (provider: string) => {
        session.signInProviders.push(provider);
        return undefined;
      },
      signOut: async () => undefined,
      };
    }, { AuthError: class AuthError extends Error {} }),
  });
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  mock.module("next/navigation", {
    namedExports: {
      usePathname: () => "/redaktion/artikler",
      redirect: (url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
      },
      notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
      },
    },
  });
}

let counter = 0;
export function uniq(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
}

/** Opretter en testinstans (og returnerer id). Ryd op med deleteInstance. */
export async function createInstance(tag = "T") {
  const id = uniq(tag);
  return db.instance.create({ data: { navn: `${tag}Lokalt ${id}`, domaene: `${id}.test`, geografiskDækning: [], kategoriTaksonomi: [], markingTekster: {} } });
}

export async function createUser(instansId: string, roleName: string, extra: { authorId?: string } = {}) {
  const role = await db.role.findUniqueOrThrow({ where: { navn: roleName } });
  return db.user.create({
    data: { email: `${uniq("u")}@test.local`, passwordHash: "x", navn: `${roleName} Testbruger`, roleId: role.id, instansId, ...extra },
    include: { role: true },
  });
}

/** Finder første React-element af en given type i et (server)komponent-resultat. */
export function findElement(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, type);
      if (hit) return hit;
    }
    return null;
  }
  const el = node as { type?: unknown; props?: Record<string, unknown> };
  if (el.type === type) return el as { props: Record<string, unknown> };
  return el.props ? findElement(el.props.children, type) : null;
}
