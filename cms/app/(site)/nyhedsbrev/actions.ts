"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { guardPublicAction } from "@/lib/ratelimit/guard";
import { generateToken } from "@/lib/validation/tokens";
import { cleanText } from "@/lib/validation/text";
import { getCurrentSite } from "@/lib/site";
import { getClientIp } from "@/lib/ratelimit";
import { turnstileTokenFrom, verifyTurnstile } from "@/lib/turnstile";
import {
  newsletterInputFromFormData,
  subscribeToNewsletterCore,
  type SubscribeResult,
} from "@/lib/newsletter";

export type SubscribeActionResult = SubscribeResult;

export async function subscribeToNewsletter(
  _prevState: SubscribeActionResult | null,
  formData: FormData,
): Promise<SubscribeActionResult> {
  try {
    const [site, h] = await Promise.all([getCurrentSite(), headers()]);
    // Turnstile (no-op uden TURNSTILE_SECRET_KEY)
    const human = await verifyTurnstile(turnstileTokenFrom(formData), getClientIp(h));
    if (!human.ok) return { success: false, error: "Vi kunne ikke bekræfte at du er et menneske. Genindlæs siden og prøv igen." };
    const result = await subscribeToNewsletterCore({
      input: newsletterInputFromFormData(formData),
      instansId: site.id,
      siteNavn: site.navn,
      ip: getClientIp(h),
    });
    if (result.success) revalidatePath("/redaktion/nyhedsbrev");
    return result;
  } catch (error) {
    console.error("Fejl ved nyhedsbrevstilmelding:", error);
    return { success: false, error: "Der opstod en fejl ved tilmeldingen. Prøv venligst igen senere." };
  }
}
