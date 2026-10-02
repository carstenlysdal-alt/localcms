import Link from "next/link";
import { CheckCheck, ExternalLink, PenLine, Plus, Radio } from "lucide-react";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { createSignal, markAllRead, toggleSignalApprovalAction } from "./actions";
import { Page, PageHeader } from "@/components/ui/Page";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterBar";
import { Field, Notice } from "@/components/ui/Layout";

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}t`;
  return `${Math.floor(hrs / 24)}d`;
}

const KILDER = ["Alle", "Ritzau", "Reuters", "AP", "Intern"];

export default async function SignalerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthorizedUser();
  if (!user) return null;
  const params = await searchParams;
  const kilde = typeof params.kilde === "string" ? params.kilde : "";
  const visLaeste = params.laest === "1";

  const signals = await db.signal.findMany({
    where: {
      instansId: user.instansId,
      ...(kilde && kilde !== "Alle" ? { kilde } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const ulaeste = signals.filter((s) => !s.laest).length;
  const visninger = visLaeste ? signals : signals.filter((s) => !s.laest);
  const canManage = can(user, PERMISSIONS.ARTICLE_CREATE);
  const canApprove = can(user, PERMISSIONS.SIGNAL_APPROVE);

  const href = (extra: { kilde?: string; laest?: boolean }) => {
    const p = new URLSearchParams();
    const k = extra.kilde ?? kilde;
    if (k && k !== "Alle") p.set("kilde", k);
    if (extra.laest ?? visLaeste) p.set("laest", "1");
    const s = p.toString();
    return `/redaktion/signaler${s ? `?${s}` : ""}`;
  };

  return (
    <Page>
      <PageHeader
        icon={<Radio size={22} />}
        title="Signaler"
        badge={ulaeste > 0 ? <Badge tone="primary" variant="solid">{ulaeste} ulæste</Badge> : undefined}
        subtitle="Alt din live-overvågning fanger, nyeste først, på tværs af alle kilder."
        actions={
          <form action={markAllRead}>
            <button className="btn btn-secondary" type="submit"><CheckCheck size={16} aria-hidden="true" /> Markér alle læst</button>
          </form>
        }
      />

      <Notice tone="warn" title="Godkend før visning på forsiden">
        Maskinindsamlede signaler vises først på forsiden, når en redaktør har godkendt dem. Gennemlæs overskriften for personoplysninger og sigtede, før du godkender, især fra politi og 112. Ændres et signal fra kilden, skal det godkendes igen.
      </Notice>

      <div className="signal-toolbar">
        <FilterChips
          label="Filtrér på kilde"
          chips={KILDER.map((k) => ({
            href: href({ kilde: k }),
            label: k,
            count: k === "Alle" ? signals.length : undefined,
            active: (k === "Alle" && !kilde) || kilde === k,
          }))}
        />
        <FilterChips label="Læste signaler" chips={[{ href: href({ laest: !visLaeste }), label: visLaeste ? "Skjul læste" : "Vis læste", active: visLaeste }]} />
      </div>

      {canManage ? (
        <div className="signal-new">
          <Accordion
            items={[
              {
                id: "new-signal",
                title: "Tilføj signal manuelt",
                icon: <Plus size={16} />,
                children: (
                  <form action={createSignal} className="ui-stack ui-gap-md signal-form">
                    <Field label="Overskrift" htmlFor="overskrift" required>
                      <input className="input" id="overskrift" name="overskrift" required />
                    </Field>
                    <Field label="Brødtekst" htmlFor="brødtekst">
                      <textarea className="input" id="brødtekst" name="brødtekst" rows={2} />
                    </Field>
                    <div className="ui-form-grid">
                      <Field label="Kilde" htmlFor="kilde">
                        <select className="input" id="kilde" name="kilde">{["Intern", "Ritzau", "Reuters", "AP"].map((k) => <option key={k}>{k}</option>)}</select>
                      </Field>
                      <Field label="Kilde-URL" htmlFor="kildeUrl">
                        <input className="input" id="kildeUrl" name="kildeUrl" type="url" />
                      </Field>
                    </div>
                    <div className="ui-actions">
                      <label className="check-row"><input type="checkbox" name="notable" /> Notable</label>
                      <label className="check-row"><input type="checkbox" name="breaking" /> Hastenyhed</label>
                    </div>
                    <div><button className="btn btn-primary" type="submit">Tilføj signal</button></div>
                  </form>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {visninger.length === 0 ? (
        <EmptyState
          icon={<Radio size={22} />}
          title={visLaeste ? "Ingen signaler" : "Ingen ulæste signaler"}
          description={visLaeste ? "Der er ikke indsamlet signaler endnu." : "Alt er læst. Du kan se de læste signaler igen."}
          action={!visLaeste ? <Link className="btn btn-secondary" href={href({ laest: true })}>Vis læste</Link> : undefined}
        />
      ) : (
        <ul className="signal-feed ui-list-reset" aria-label="Signaler">
          {visninger.map((signal) => (
            <li key={signal.id} className={`signal-item ${signal.laest ? "signal-read" : ""}`}>
              <div className="signal-source">
                <span className="signal-source-label">{signal.kilde}</span>
                {!signal.laest ? <span className="signal-live-dot signal-live-dot-sm" role="img" aria-label="Ulæst" /> : null}
              </div>
              <div className="signal-content">
                <div className="signal-badges">
                  {signal.breaking ? <Badge tone="danger" variant="solid">Hastenyhed</Badge> : null}
                  {signal.notable ? <Badge tone="success">Notable</Badge> : null}
                  {signal.maskinindsamlet && !signal.godkendtTid ? (
                    <Badge tone="review" dot title="Indsamlet automatisk af en agent — ikke redaktionelt vurderet">
                      Maskinindsamlet · ikke vurderet{signal.sourceType ? ` · ${signal.sourceType.replace(/_/g, " ")}` : ""}
                    </Badge>
                  ) : null}
                  {signal.maskinindsamlet && signal.godkendtTid ? (
                    <Badge tone="success" dot title="En redaktør har godkendt signalet til visning på forsiden">
                      Godkendt til forsiden{signal.sourceType ? ` · ${signal.sourceType.replace(/_/g, " ")}` : ""}
                    </Badge>
                  ) : null}
                </div>
                <p className="signal-headline">{signal.overskrift}</p>
                {signal.brødtekst ? <p className="signal-body">{signal.brødtekst}</p> : null}
                {signal.kildeUrl && /^https?:\/\//i.test(signal.kildeUrl) ? (
                  <a href={signal.kildeUrl} target="_blank" rel="noopener noreferrer" className="signal-link">
                    {signal.kilde} <ExternalLink size={12} aria-hidden="true" /><span className="sr-only"> (åbner i ny fane)</span>
                  </a>
                ) : null}
              </div>
              <div className="signal-meta">
                <span className="signal-time">{relativeTime(signal.createdAt)}</span>
                <Link className="btn btn-secondary btn-sm" href={`/redaktion/chat?signal=${encodeURIComponent(signal.overskrift)}`}>
                  <PenLine size={14} aria-hidden="true" /> Skriv
                </Link>
                {canApprove && signal.maskinindsamlet ? (
                  <form action={toggleSignalApprovalAction.bind(null, signal.id, Boolean(signal.godkendtTid))}>
                    <button className={`btn btn-sm ${signal.godkendtTid ? "btn-secondary" : "btn-primary"}`} type="submit">
                      {signal.godkendtTid ? "Træk godkendelse tilbage" : "Godkend til forsiden"}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
