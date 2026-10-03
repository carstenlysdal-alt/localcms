import { getNetworkLinks } from "@/lib/site";
import { networkHref } from "@/lib/network-sites";
import { listAccessibleInstances } from "@/lib/instance-access";
import type { AuthorizedUser } from "@/lib/auth";
import type { NavCity } from "@/components/admin/city-switcher";

/**
 * Byerne i skallens skifter/faner: alle netværkets byer, hvor kun byer brugeren HAR adgang til (hjem + adgangsrækker, slået op i
 * databasen nu) får et instans-id og kan vælges. Den aktive by er `user.instansId` (valideret). "Se siden" peger på byens
 * offentlige side — på preview-værten `/?by=<nøgle>` (samme by som den der redigeres), ellers byens eget domæne.
 */
export async function loadNavCities(user: Pick<AuthorizedUser, "id" | "instansId" | "homeInstansId">): Promise<NavCity[]> {
  const [accessible, network] = await Promise.all([listAccessibleInstances(user.id, user.homeInstansId), getNetworkLinks().catch(() => [])]);
  const byKey = new Map(accessible.map((i) => [i.key, i]));
  const cities: NavCity[] = network.map((site) => {
    const inst = site.key ? byKey.get(site.key) : undefined;
    return { by: site.by, instansId: inst?.id ?? null, current: inst?.id === user.instansId, home: inst?.home, publicHref: networkHref(site) };
  });
  // Tilgængelige instanser uden for netværkslisten (fx testdata) skal stadig kunne vælges og vises.
  const listed = new Set(network.map((s) => s.key));
  for (const inst of accessible) {
    if (!listed.has(inst.key)) cities.push({ by: inst.navn.replace(/Lokalt$/i, ""), instansId: inst.id, current: inst.id === user.instansId, home: inst.home, publicHref: null });
  }
  return cities;
}

/** Antal byer brugeren kan vælge (>= 2 betyder, at "Alle byer"-oversigter giver mening). */
export const switchableCount = (cities: readonly NavCity[]): number => cities.filter((c) => c.instansId).length;
