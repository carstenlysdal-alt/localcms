import { existsSync } from "node:fs";
import { chromium, test, type Page, type Response } from "@playwright/test";

export const PORT = process.env.E2E_PORT ?? "3000";
export const cityUrl = (key: string, path = "/") => `http://${key}.localhost:${PORT}${path}`;

export const CITIES = [
  { key: "naestvedlokalt", name: "NæstvedLokalt", place: "Næstved" },
  { key: "slagelselokalt", name: "SlagelseLokalt", place: "Slagelse" },
  { key: "holbaeklokalt", name: "HolbækLokalt", place: "Holbæk" },
  { key: "ringstedlokalt", name: "RingstedLokalt", place: "Ringsted" },
  { key: "koegelokalt", name: "KøgeLokalt", place: "Køge" },
  { key: "roskildelokalt", name: "RoskildeLokalt", place: "Roskilde" },
];

let serverUp: boolean | null = null;
async function isServerUp(): Promise<boolean> {
  if (serverUp !== null) return serverUp;
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(5000) });
    serverUp = r.ok;
  } catch {
    serverUp = false;
  }
  return serverUp;
}

/** Kald øverst i hver spec: springer over hvis Chromium ikke er hentet eller serveren ikke kører. */
export function skipUnlessRunnable() {
  let browserInstalled = false;
  try {
    browserInstalled = existsSync(chromium.executablePath());
  } catch {
    browserInstalled = false;
  }
  test.skip(!browserInstalled, "Chromium er ikke installeret (kør: npx playwright install chromium)");
  test.beforeAll(async () => {
    test.skip(!(await isServerUp()), `Ingen server svarer på http://127.0.0.1:${PORT}/api/health (start npm run dev / next start)`);
  });
}

/**
 * page.goto med genforsøg ved 429. proxy.ts' sidegrænse pr. IP tæller også Next.js' RSC-prefetch-kald, så en browser kan
 * ramme grænsen efter få sidevisninger (sæt PAGE_RATE_LIMIT_PER_MIN højt på serveren under e2e, se docs/ops/CI.md).
 */
export async function visit(page: Page, url: string): Promise<Response | null> {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await page.goto(url);
    if (res?.status() !== 429) return res;
    const wait = Math.min(65, Number(res.headers()["retry-after"]) || 10);
    await page.waitForTimeout(wait * 1000);
  }
  return res;
}
