import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createTopic } from "@/lib/topics";
import { Page, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Layout";

async function createTopicAction(data: FormData) {
  "use server";
  // Server-side autorisation uafhængig af proxy.ts: rettigheden slås op i databasen.
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return;
  const created = await createTopic(user, {
    titel: data.get("titel"),
    beskrivelse: data.get("beskrivelse"),
    coverUrl: data.get("coverUrl"),
    kategorier: data.get("kategorier"),
  });
  if (!created) return;
  redirect("/redaktion/emner");
}

export default async function NytEmnePage() {
  const session = await auth();
  if (!session?.user) return null;
  return (
    <Page width="narrow">
      <PageHeader title="Nyt emne" subtitle="Definer et emne du vil overvåge." />
      <Card>
        <form action={createTopicAction} className="ui-stack ui-gap-md">
          <Field label="Emnetitel" htmlFor="titel" required>
            <input className="input" id="titel" name="titel" required placeholder="fx Kommunalvalg" />
          </Field>
          <Field label="Beskrivelse" htmlFor="beskrivelse">
            <textarea className="input" id="beskrivelse" name="beskrivelse" rows={3} placeholder="Hvad skal overvåges?" />
          </Field>
          <Field label="Kategorier (kommasepareret)" htmlFor="kategorier">
            <input className="input" id="kategorier" name="kategorier" placeholder="fx Politik, Økonomi, Lokalt" />
          </Field>
          <Field label="Cover-URL (valgfrit)" htmlFor="coverUrl">
            <input className="input" id="coverUrl" name="coverUrl" type="url" placeholder="https://…" />
          </Field>
          <div className="ui-actions">
            <button className="btn btn-primary" type="submit">Opret emne</button>
            <Link className="btn btn-secondary" href="/redaktion/emner">Annullér</Link>
          </div>
        </form>
      </Card>
    </Page>
  );
}
