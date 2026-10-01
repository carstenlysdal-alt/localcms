import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSite } from "@/lib/site";
import { getClientIp } from "@/lib/ratelimit";
import { rejectOversize } from "@/lib/http";
import { TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";
import {
  newsletterInputFromFormData,
  subscribeToNewsletterCore,
  type NewsletterInput,
} from "@/lib/newsletter";

/**
 * POST /api/newsletter/subscribe
 * - formular (application/x-www-form-urlencoded / multipart): 303-redirect til /nyhedsbrev?tilmelding=ok|fejl
 *   (kun relativ sti, ingen åben redirect) – virker uden JavaScript.
 * - JSON: { email, samtykke, navn?, omraadeSlug?, sektionSlug? } -> JSON-svar.
 * By (instansId) bestemmes ALTID ud fra værten, aldrig fra klienten.
 */
export async function POST(request: NextRequest) {
  const tooBig = rejectOversize(request, 16 * 1024);
  if (tooBig) return tooBig;
  const isJson = (request.headers.get("content-type") ?? "").includes("application/json");

  let input: NewsletterInput;
  let captcha: unknown;
  try {
    if (isJson) {
      const body = (await request.json()) as Record<string, unknown>;
      captcha = body[TURNSTILE_FIELD];
      input = {
        email: String(body.email ?? ""),
        navn: body.navn ? String(body.navn) : null,
        omraadeSlug: body.omraadeSlug ? String(body.omraadeSlug) : null,
        sektionSlug: body.sektionSlug ? String(body.sektionSlug) : null,
        samtykke: body.samtykke === true || body.samtykke === "true" || body.samtykke === "on",
        website: body.website ? String(body.website) : null,
      };
    } else {
      const fd = await request.formData();
      captcha = fd.get(TURNSTILE_FIELD);
      input = newsletterInputFromFormData(fd);
    }
  } catch {
    return respond(isJson, request, false, "Ugyldig forespørgsel.", 400);
  }

  // Turnstile (no-op uden TURNSTILE_SECRET_KEY)
  const human = await verifyTurnstile(captcha, getClientIp(request.headers));
  if (!human.ok) return respond(isJson, request, false, "Vi kunne ikke bekræfte at du er et menneske. Genindlæs siden og prøv igen.", 400);

  const site = await getCurrentSite();
  const result = await subscribeToNewsletterCore({
    input,
    instansId: site.id,
    siteNavn: site.navn,
    ip: getClientIp(request.headers),
  });

  if (result.success) return respond(isJson, request, true, result.message, 200);
  const status = result.error.startsWith("For mange") ? 429 : 400;
  return respond(isJson, request, false, result.error, status);
}

function respond(isJson: boolean, _request: NextRequest, ok: boolean, message: string, status: number) {
  if (isJson) {
    return NextResponse.json(ok ? { ok: true, message } : { ok: false, error: message }, { status });
  }
  // Relativ Location: bliver altid på samme vært/by (ingen åben redirect).
  const params = new URLSearchParams({ tilmelding: ok ? "ok" : "fejl" });
  if (!ok) params.set("besked", message.slice(0, 160));
  return new NextResponse(null, { status: 303, headers: { Location: `/nyhedsbrev?${params.toString()}` } });
}
