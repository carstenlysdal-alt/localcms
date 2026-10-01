import { can, PERMISSIONS, type PermissionUser } from "@/lib/permissions";

/** Adgangs- og parameterlogik for /redaktion/forside/preview (rent, testbart). */
const ID = /^[A-Za-z0-9_-]{8,40}$/;

export type PreviewTarget = { kind: "live" } | { kind: "draft"; id: string } | { kind: "snapshot"; id: string } | { kind: "invalid" };

type Param = string | string[] | undefined;

/** `?draft=<id>` | `?draft=live` | `?snapshot=<id>`. Alt andet er ugyldigt (aldrig stille fallback). */
export function parsePreviewTarget(sp: { draft?: Param; snapshot?: Param }): PreviewTarget {
  const one = (p: Param) => (Array.isArray(p) ? p[0] : p);
  const draft = one(sp.draft);
  const snapshot = one(sp.snapshot);
  if (draft && snapshot) return { kind: "invalid" };
  if (draft === "live") return { kind: "live" };
  if (draft) return ID.test(draft) ? { kind: "draft", id: draft } : { kind: "invalid" };
  if (snapshot) return ID.test(snapshot) ? { kind: "snapshot", id: snapshot } : { kind: "invalid" };
  return { kind: "live" };
}

export function canPreview(user: (PermissionUser & { instansId?: string }) | null | undefined): boolean {
  return (
    can(user, PERMISSIONS.FRONTPAGE_EDIT) || can(user, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE) || can(user, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE)
  );
}

export type PreviewDecision = { allow: true; target: Exclude<PreviewTarget, { kind: "invalid" }> } | { allow: false; reason: "login" | "forbidden" | "invalid" };

export function previewDecision(user: (PermissionUser & { instansId?: string }) | null | undefined, sp: { draft?: Param; snapshot?: Param }): PreviewDecision {
  if (!user) return { allow: false, reason: "login" };
  if (!canPreview(user)) return { allow: false, reason: "forbidden" };
  const target = parsePreviewTarget(sp);
  if (target.kind === "invalid") return { allow: false, reason: "invalid" };
  return { allow: true, target };
}
