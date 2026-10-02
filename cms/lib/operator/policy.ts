/**
 * Udførelsespolitik for AI-operatøren. Alt der kan justeres uden at røre UI eller værktøjer, ligger her.
 *
 *  - read        udføres direkte (ingen skrivning).
 *  - safe-write  udføres direkte + AuditLog + (hvor muligt) en fortryd-recept som UI'et viser som "Fortryd".
 *  - confirm     modellen FORESLÅR; først når brugeren trykker "Anvend" (engangs-token) udføres handlingen.
 *  - blocked     findes ikke som værktøj. Se BLOCKED_TOOLS: modellen henvises til siden, hvor brugeren selv gør det.
 */
export type Risk = "read" | "safe-write" | "confirm";

export type RiskMode = "execute" | "execute-undo" | "confirm";

export const RISK_POLICY: Record<Risk, RiskMode> = {
  read: "execute",
  "safe-write": "execute-undo",
  confirm: "confirm",
};

export const MAX_TOOL_CALLS_PER_TURN = 8;
export const TURN_TIMEOUT_MS = 60_000;
export const TOOL_TIMEOUT_MS = 20_000;
export const MAX_ITEMS_PER_CALL = 20;
export const CONFIRM_TTL_MS = 10 * 60_000;
export const UNDO_TTL_MS = 24 * 60 * 60_000;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_TOOL_OUTPUT_CHARS = 6000;
export const MAX_MODEL_TOKENS = 1500;

/** Pr. bruger: 30 ture / 10 min (hver tur kan give op til 9 modelkald, så grænsen er bevidst lav). */
export const RATE_LIMIT = { bucket: "operator", limit: 30, windowMs: 10 * 60_000 } as const;
export const RATE_LIMIT_CONFIRM = { bucket: "operator-confirm", limit: 40, windowMs: 10 * 60_000 } as const;

export interface BlockedTool {
  /** Navne en model kan finde på at kalde. De findes IKKE i registret, og afvises før noget udføres. */
  names: readonly string[];
  label: string;
  href: string;
  why: string;
}

/**
 * Handlinger der aldrig udføres via AI. Brugeren skal gøre det selv i den relevante side.
 * Teksten bruges både i afvisningen til modellen og i den danske forklaring i UI'et.
 */
export const BLOCKED_TOOLS: readonly BlockedTool[] = [
  { names: ["publish_article", "publicer_artikel", "publish", "unpublish_article", "schedule_article"], label: "Publicering af artikler", href: "/redaktion/artikler", why: "Publicering kræver en redaktørs bevidste godkendelse (rettighed, mærkning, AI-registrering)." },
  { names: ["send_newsletter", "afsend_nyhedsbrev", "send_email"], label: "Afsendelse af nyhedsbrev", href: "/redaktion/nyhedsbrev", why: "Afsendelse kan ikke fortrydes og når læserne direkte." },
  { names: ["publish_frontpage", "publish_layout", "approve_snapshot", "rollback_layout"], label: "Publicering af forsiden", href: "/redaktion/forside", why: "AI foreslår forsiden; redaktøren godkender og publicerer selv." },
  { names: ["create_payment", "charge", "refund", "manage_support_agreement", "stoette_aftale", "payments"], label: "Betalinger og støtteaftaler", href: "/redaktion/sponsor", why: "Betalinger og aftaler håndteres kun af ansvarlige personer i systemet." },
  { names: ["delete_user", "slet_bruger"], label: "Sletning af brugere", href: "/redaktion/brugere", why: "Brugere deaktiveres i brugeradministrationen, aldrig via AI." },
  { names: ["change_own_role", "set_own_role", "change_role", "set_role", "grant_permission", "update_role"], label: "Ændring af roller og rettigheder", href: "/redaktion/brugere", why: "Roller og rettigheder ændres kun af en administrator i brugeradministrationen." },
  { names: ["delete_correction", "remove_correction", "slet_rettelse"], label: "Sletning af rettelser", href: "/redaktion/artikler", why: "Rettelser er et offentligt, sporbart register og må ikke fjernes via AI." },
  { names: ["reset_password", "change_password", "set_password", "nulstil_adgangskode"], label: "Skift eller nulstilling af adgangskoder", href: "/redaktion/brugere", why: "Adgangskoder håndteres kun af brugeren selv eller en administrator." },
  { names: ["get_secret", "read_env", "get_api_key", "show_token", "hent_hemmelighed"], label: "Hemmeligheder og nøgler", href: "/redaktion/konto", why: "AI har aldrig adgang til nøgler, adgangskoder eller tokens." },
];

const BLOCKED_INDEX = new Map<string, BlockedTool>();
for (const entry of BLOCKED_TOOLS) for (const name of entry.names) BLOCKED_INDEX.set(name, entry);

export function findBlockedTool(name: string): BlockedTool | null {
  return BLOCKED_INDEX.get(name.trim().toLowerCase()) ?? null;
}
