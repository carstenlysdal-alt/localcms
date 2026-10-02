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
export const session: { userId: string | null; staleJwtPermissions: string[] } = { userId: null, staleJwtPermissions: [] };

export function installNextMocks() {
  mock.module("next-auth", {
    defaultExport: () => ({
      handlers: {},
      auth: async () => (session.userId ? { user: { id: session.userId, permissions: session.staleJwtPermissions } } : null),
      signIn: async () => undefined,
      signOut: async () => undefined,
    }),
  });
  mock.module("next/cache", { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  mock.module("next/navigation", {
    namedExports: {
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
