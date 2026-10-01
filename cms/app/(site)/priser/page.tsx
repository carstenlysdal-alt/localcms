import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import { JsonLd } from "@/components/site/JsonLd";
import { offerCatalog } from "@/lib/seo/jsonld";
import { PRISER_OFFERS } from "@/lib/seo/priser";
import { siteBase } from "@/lib/seo/url";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import {
  Calendar,
  FileText,
  Store,
  Share2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SponsorBriefForm } from "../sponsor/SponsorBriefForm";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/priser", (site) => ({
    title: `Priser og annoncering i ${site.kommune}`,
    description: `Annoncering i ${site.kommune} fra 125 kr.: kalenderannoncer, sponsorerede artikler med distribution på Facebook og faste partnerskaber.`,
  }));
}

type Product = {
  key: string;
  icon: LucideIcon;
  name: string;
  price: string;
  unit: string;
  note?: string;
  badge?: string;
  featured?: boolean;
  description: string;
  features: string[];
  cta: { label: string; href: string };
};

const PRODUCTS: Product[] = [
  {
    key: "event",
    icon: Calendar,
    name: "Event i kalenderen",
    price: "125 kr.",
    unit: "pr. arrangement, ex. moms",
    description:
      "Få koncert, foreningsmøde, loppemarked eller sportsbegivenhed vist i kommunens kalender.",
    features: [
      "Dato, starttidspunkt og sted",
      "Billede og programbeskrivelse",
      "Link til billetsalg eller hjemmeside",
      "Gratis for ikke-kommercielle foreninger",
    ],
    cta: { label: "Opret event", href: "/bliv-en-del-af-journalistikken?spor=borger" },
  },
  {
    key: "artikel",
    icon: FileText,
    name: "Sponsoreret artikel",
    price: "4.995 kr.",
    unit: "samlet pakke, ex. moms",
    badge: "Mest valgt",
    featured: true,
    description:
      "En redaktionelt skrevet artikel om din virksomhed, et nyt tiltag, lærlinge eller et jubilæum. Mærket Sponsoreret.",
    features: [
      "Interview og vinkling ved en journalist",
      "Fotoserie af medarbejdere og virksomhed",
      "Fast placering på forsiden og i Erhverv",
      "Delt på mediets Facebook-side",
      "Omtale i nyhedsbrevet",
      "Fuld brugsret til artiklen i egne kanaler",
    ],
    cta: { label: "Bestil artikel", href: "#bestil" },
  },
  {
    key: "guide",
    icon: Store,
    name: "Profil i Lokalguiden",
    price: "249 kr.",
    unit: "pr. måned, ex. moms",
    description:
      "For restauranter, caféer, butikker og oplevelsessteder, der vil findes, når lokale og gæster søger.",
    features: [
      "Egen profilside med logo og fotos",
      "Åbningstider, adresse og kort",
      "Knap til bordbestilling eller webshop",
      "Kan opsiges måned for måned",
    ],
    cta: { label: "Få en profil", href: "#bestil" },
  },
];

const PARTNER_PACKAGES: Product[] = [
  {
    key: "naboskab",
    icon: Store,
    name: "Naboskab",
    price: "795 kr.",
    unit: "pr. måned, eller 7.995 kr. pr. år",
    note: "Mindre virksomheder og lokale håndværkere",
    description: "",
    features: [
      "2 sponsorerede artikler om året",
      "4 delinger på sociale medier",
      "Logo i partnerlisten i bunden af siden",
      "Omtale i kvartalets erhvervsoverblik",
      "Fuld brugsret til artiklerne i egen markedsføring",
    ],
    cta: { label: "Vælg Naboskab", href: "#bestil" },
  },
  {
    key: "faellesskab",
    icon: Store,
    name: "Fællesskab",
    price: "1.995 kr.",
    unit: "pr. måned, eller 19.995 kr. pr. år",
    note: "Mellemstore virksomheder, mæglere og advokater",
    badge: "Anbefalet",
    featured: true,
    description: "",
    features: [
      "4 sponsorerede artikler om året",
      "1 videoproduktion til sociale medier",
      "8 målrettede delinger på Facebook og LinkedIn",
      "Roterende logo på forsiden under Lokale partnere",
      "1 indslag i nyhedsbrevet pr. kvartal",
      "Statusmøde med redaktionen hvert kvartal",
    ],
    cta: { label: "Vælg Fællesskab", href: "#bestil" },
  },
  {
    key: "fyrtaarn",
    icon: Store,
    name: "Fyrtårn",
    price: "4.495 kr.",
    unit: "pr. måned, eller 45.000 kr. pr. år",
    note: "Pengeinstitutter, energiselskaber og store aktører",
    description: "",
    features: [
      "8 sponsorerede artikler og reportager om året",
      "2 professionelle videoproduktioner",
      "Permanent logo på forsiden som Fyrtårnspartner",
      "Månedlig omtale i nyhedsbrevet",
      "Prioriteret distribution og betalt boost af historier",
      "Mulighed for tilstedeværelse i hele [By]Lokalt-netværket",
    ],
    cta: { label: "Vælg Fyrtårn", href: "#bestil" },
  },
];

function PriceCard({ product, headingLevel }: { product: Product; headingLevel: 2 | 3 }) {
  const Icon = product.icon;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={`site-priser-card ${product.featured ? "is-featured" : ""}`}>
      {product.badge && <span className="site-priser-card-badge">{product.badge}</span>}
      <Heading className="site-priser-card-title">
        <Icon size={20} aria-hidden="true" />
        {product.name}
      </Heading>
      {product.note && <p className="site-priser-card-note">{product.note}</p>}
      <p className="site-priser-price">
        <span className="site-priser-price-amount">{product.price}</span>
        <span className="site-priser-price-unit">{product.unit}</span>
      </p>
      {product.description && <p className="site-priser-card-desc">{product.description}</p>}
      <ul className="site-priser-features">
        {product.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <Link
        href={product.cta.href}
        className={product.featured ? "site-btn-support site-priser-cta" : "site-btn-submit site-priser-cta"}
      >
        {product.cta.label}
      </Link>
    </article>
  );
}

export default async function PriserPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-page-container site-priser-page">
      <JsonLd
        data={offerCatalog({ name: `Annoncering og sponsoreret indhold – ${site.navn}`, offers: PRISER_OFFERS }, site, siteBase(site))}
      />
      <div className="site-container site-priser-container">
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Priser og annoncering" },
          ]}
        />

        <header className="site-priser-header">
          <p className="site-priser-eyebrow">Opstartspriser, ex. moms</p>
          <h1 className="site-priser-title">Annoncer og partnerskaber i {site.kommune}</h1>
          <p className="site-priser-lead">
            {site.navn} er for alle, der vil nå lokale læsere: den lille forening, kaffebaren, håndværkeren og
            de større arbejdspladser. Alt betalt indhold er tydeligt mærket, og du ser altid prisen, før du bestiller.
          </p>
        </header>

        <ul className="site-priser-benefits" aria-label="Det får du">
          <li>
            <Share2 size={20} aria-hidden="true" />
            <div>
              <strong>Distribution inkluderet</strong>
              <span>Sponsorerede artikler deles på mediets Facebook-side og i nyhedsbrevet uden merpris.</span>
            </div>
          </li>
          <li>
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>Journalistisk håndværk</strong>
              <span>En journalist hjælper med vinklen, tager interviewet og sikrer et klart sprog.</span>
            </div>
          </li>
          <li>
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>Åben mærkning</strong>
              <span>
                Betalt indhold bærer altid mærket Finansieret af eller Sponsoreret. Læs{" "}
                <Link href="/om-mediet/redaktionelle-principper">vores principper</Link>.
              </span>
            </div>
          </li>
        </ul>

        <section className="site-priser-section" aria-labelledby="priser-enkelt">
          <div className="site-priser-section-head">
            <h2 id="priser-enkelt">Enkeltstående formater</h2>
            <p>Vælg det, der passer til dit behov. Ingen binding.</p>
          </div>
          <div className="site-priser-grid">
            {PRODUCTS.map((p) => (
              <PriceCard key={p.key} product={p} headingLevel={3} />
            ))}
          </div>
        </section>

        <section className="site-priser-section" aria-labelledby="priser-partner">
          <div className="site-priser-section-head">
            <h2 id="priser-partner">Faste partnerskaber</h2>
            <p>Til virksomheder, der vil bakke op om byens journalistik hele året og være synlige undervejs.</p>
          </div>
          <div className="site-priser-grid">
            {PARTNER_PACKAGES.map((p) => (
              <PriceCard key={p.key} product={p} headingLevel={3} />
            ))}
          </div>
        </section>

        <section id="bestil" className="site-priser-section" aria-labelledby="priser-bestil">
          <div className="site-priser-section-head">
            <h2 id="priser-bestil">Bestil eller kontakt redaktionen</h2>
            <p>Send dine oplysninger, så kontakter vi dig for at aftale detaljer, dato og vinkel.</p>
          </div>
          <SponsorBriefForm siteNavn={site.navn} />
        </section>
      </div>
    </div>
  );
}
