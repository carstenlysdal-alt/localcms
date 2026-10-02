import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";

/** Fælles "Ingen adgang"-visning for redaktionssider (rettighed slås op server-side før data hentes). */
export function NoAccess({ area }: { area: string }) {
  return (
    <Page width="narrow">
      <Card tone="warn" title="Ingen adgang" icon={<ShieldAlert size={18} />} headingLevel={1} id="no-access">
        <div role="alert" className="ui-stack ui-gap-md">
          <p className="ui-section-text">Din rolle har ikke adgang til {area}. Kontakt en redaktør, hvis du mener, det er en fejl.</p>
          <div><Link className="btn btn-secondary" href="/redaktion/artikler">Til artikler</Link></div>
        </div>
      </Card>
    </Page>
  );
}
