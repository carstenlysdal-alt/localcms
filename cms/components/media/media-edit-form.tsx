"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateMedia, type MediaFormState } from "@/app/redaktion/medier/actions";
import { MediaMetadataFields } from "./media-create-form";
import { Notice } from "@/components/ui/Layout";

export function MediaEditForm({ media }: { media: { id: string; filtype: string; altTekst: string | null; billedtekst: string | null; ophavsperson: string | null; rettighedsstatus: string | null; licensType: string | null; rettighedsUdlob: Date | null } }) {
  const [state, action, pending] = useActionState<MediaFormState, FormData>(updateMedia.bind(null, media.id), {});
  return <form action={action} className="media-form card">
    {state.error && <Notice tone="danger" title="Kunne ikke gemme">{state.error}</Notice>}
    {state.success && <Notice tone="success">{state.success}</Notice>}
    <MediaMetadataFields isImage={media.filtype === "billede"} values={{ ...media, rettighedsUdlob: media.rettighedsUdlob?.toISOString().slice(0, 10) }} />
    <button className="btn btn-primary" disabled={pending}><Save size={16} /> {pending ? "Gemmer…" : "Gem metadata"}</button>
  </form>;
}
