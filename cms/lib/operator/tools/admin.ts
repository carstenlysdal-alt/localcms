import { z } from "zod";
import { db } from "../../db";
import { getSlotMetrics } from "../../frontpage/service";
import { PERMISSIONS } from "../../permissions";
import { createUserAction } from "@/app/redaktion/brugere/actions";
import { defineTool } from "../types";
import { formData, text } from "./shared";

export const getNewsletterStatus = defineTool({
  name: "get_newsletter_status",
  description: "Viser nyhedsbrevets status: antal aktive og afmeldte abonnenter. Viser ingen e-mailadresser. Der kan ikke afsendes nyhedsbreve via AI.",
  input: z.strictObject({}),
  category: "Nyhedsbrev",
  risk: "read",
  permissions: [PERMISSIONS.NEWSLETTER_MANAGE],
  summarize: () => "Henter nyhedsbrevets status",
  async execute(ctx) {
    const [aktive, afmeldte] = await Promise.all([db.newsletterSubscriber.count({ where: { instansId: ctx.instansId, aktiv: true } }), db.newsletterSubscriber.count({ where: { instansId: ctx.instansId, aktiv: false } })]);
    return { ok: true, summary: `${aktive} aktive abonnenter, ${afmeldte} afmeldte`, data: { aktive, afmeldte } };
  },
});

export const getMetrics = defineTool({
  name: "get_metrics",
  description: "Viser de mest sete artikler (visninger, læsninger) og forsidens slotmåling for de seneste dage.",
  input: z.strictObject({ dage: z.number().int().min(1).max(30).optional(), antal: z.number().int().min(1).max(10).optional() }),
  category: "Metrikker",
  risk: "read",
  permissions: [PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.ARTICLE_EDIT_ALL],
  summarize: () => "Henter metrikker",
  async execute(ctx, input) {
    const top = await db.articleMetric.findMany({ where: { instansId: ctx.instansId }, orderBy: { visninger: "desc" }, take: input.antal ?? 5, include: { article: { select: { titel: true, status: true } } } });
    const slots = await getSlotMetrics(ctx.user, { days: input.dage ?? 7, now: ctx.now });
    return { ok: true, summary: `${top.length} artikler og ${slots.length} slots`, data: { topArtikler: top.map((m) => ({ artikelId: m.articleId, titel: m.article.titel, status: m.article.status, visninger: m.visninger, laesninger: m.laesninger })), slots: slots.slice(0, 20) } };
  },
});

export const listUsers = defineTool({
  name: "list_users",
  description: "Viser brugere (navn, rolle, aktiv/deaktiveret) og de tilgængelige roller. Viser ingen e-mailadresser, adgangskoder eller tokens.",
  input: z.strictObject({}),
  category: "Brugere",
  risk: "read",
  permissions: [PERMISSIONS.USERS_MANAGE],
  audit: true,
  summarize: () => "Henter brugerne",
  async execute(ctx) {
    const [users, roles] = await Promise.all([
      db.user.findMany({ where: { instansId: ctx.instansId }, orderBy: { navn: "asc" }, take: 100, select: { id: true, navn: true, deaktiveretTid: true, role: { select: { navn: true } } } }),
      db.role.findMany({ select: { navn: true, permissions: true } }),
    ]);
    const own = new Set(ctx.user.permissions);
    const assignable = roles.filter((r) => (Array.isArray(r.permissions) ? (r.permissions as string[]) : []).every((p) => own.has(p))).map((r) => r.navn);
    return { ok: true, summary: `${users.length} brugere`, data: { brugere: users.map((u) => ({ id: u.id, navn: u.navn, rolle: u.role.navn, aktiv: !u.deaktiveretTid })), roller: assignable } };
  },
});

export const createUser = defineTool({
  name: "create_user",
  description: "Opretter en ny bruger med en eksisterende rolle (kun roller med højst dine egne rettigheder). Kræver rettigheden users.manage og brugerens bekræftelse. Den midlertidige adgangskode vises KUN for brugeren i bekræftelsen, og du får den aldrig at se. Brugere kan ikke slettes, få nulstillet kode eller få ændret rolle via AI.",
  input: z.strictObject({ navn: text(120, 2), email: z.string().email().max(254).transform((v) => v.trim().toLowerCase()), rolle: text(80).describe("Navn på en eksisterende rolle") }),
  category: "Brugere",
  risk: "confirm",
  permissions: [PERMISSIONS.USERS_MANAGE],
  audit: true,
  summarize: (input) => `Opretter brugeren ${input.navn} med rollen ${input.rolle}`,
  async details(ctx, input) {
    const role = await db.role.findUnique({ where: { navn: input.rolle }, select: { permissions: true } });
    const perms = role && Array.isArray(role.permissions) ? (role.permissions as string[]) : null;
    const lines = [`Navn: ${input.navn}`, `E-mail: ${input.email}`, `Rolle: ${input.rolle}${perms ? ` (${perms.length} rettigheder)` : ""}`];
    lines.push("Brugeren får en midlertidig adgangskode, som vises én gang for dig og skal skiftes ved første login.");
    if (!role) lines.push("Rollen findes ikke; oprettelsen vil mislykkes.");
    return lines;
  },
  async execute(ctx, input) {
    const role = await db.role.findUnique({ where: { navn: input.rolle }, select: { id: true } });
    if (!role) return { ok: false, summary: `Rollen '${input.rolle}' findes ikke.` };
    const res = await createUserAction(formData({ navn: input.navn, email: input.email, roleId: role.id }));
    if (!res.ok) return { ok: false, summary: res.fieldErrors ? `${res.message} ${Object.values(res.fieldErrors).join(" ")}` : res.message };
    const created = await db.user.findFirst({ where: { instansId: ctx.instansId, email: input.email }, select: { id: true } });
    return {
      ok: true,
      summary: `Oprettede brugeren ${input.navn} (${input.rolle}). Giv vedkommende den midlertidige adgangskode, som kun vises her`,
      resultIds: created ? [created.id] : [],
      clientSecret: res.tempPassword ? { label: `Midlertidig adgangskode til ${input.navn}`, value: res.tempPassword } : null,
    };
  },
});
