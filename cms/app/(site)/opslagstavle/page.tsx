import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import {
  MessageSquare,
  Plus,
  MapPin,
  Clock,
  HeartHandshake,
  Search,
  Tag,
  ShieldCheck,
  User,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Den Lokale Opslagstavle — ${site.navn}`,
    description: `Fællesskabets opslagstavle for ${site.kommune}. Frivillige søges, foreningsnyt, efterlysninger og lokale initiativer.`,
  };
}

export default async function OpslagstavlePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const query = searchParams ? await searchParams : {};
  const filter = typeof query.kategori === "string" ? query.kategori : "alle";

  // Lokale opslagstavle opslag
  const posts = [
    {
      id: "op-1",
      category: "Frivillige",
      catColor: "#2563eb",
      catBg: "#dbeafe",
      title: "Korsør Bylaug søger 5 frivillige til naturstien ved Norstien",
      date: "I dag, 11:20",
      area: "Korsør",
      author: "Korsør Bylaug v/ Jens P.",
      desc: "Vi mangler et par ekstra hænder til at opsætte nye fuglekasser og reparere træbroen over bækken. Vi mødes lørdag kl. 9.30 ved Noret. Der serveres kaffe og rundstykker.",
      contact: "Kontakt Jens på tlf. 40 12 34 56",
    },
    {
      id: "op-2",
      category: "Efterlysning",
      catColor: "#dc2626",
      catBg: "#fee2e2",
      title: "Lille stribet hunkat savnet ved Skælskør Lystbådehavn",
      date: "I går, 18:45",
      area: "Skælskør",
      author: "Familien Møller",
      desc: "Vores 1-årige gråstribede kat 'Mille' er ikke kommet hjem siden tirsdag aften. Hun er øremærket og bærer rødt halsbånd med klokke. Har du set hende omkring havnen eller Havnegade?",
      contact: "Dusør gives — kontakt tlf. 21 88 99 00",
    },
    {
      id: "op-3",
      category: "Foreningsliv",
      catColor: "#16a34a",
      catBg: "#dcfce7",
      title: "Slagelse Skakklub starter begynderhold for børn og voksne",
      date: "28. sep",
      area: "Slagelse By",
      author: "Slagelse Skakklub",
      desc: "Kunne du tænke dig at lære skak fra bunden? Vi starter nyt introforløb hver tirsdag aften i Medborgerhuset. Det er ganske uforpligtende og alle kan være med.",
      contact: "Tilmelding på slagelse-skak.dk",
    },
    {
      id: "op-4",
      category: "Nabolag",
      catColor: "#d97706",
      catBg: "#fef3c7",
      title: "Vejfest og gadekridt for alle på Rosenvej & Liljevej",
      date: "26. sep",
      area: "Slagelse Syd",
      author: "Vejlavet Rosenvej",
      desc: "Vi fejrer efteråret med fælles grill og lege for børnene lørdag d. 10. oktober. Medbring egen madkurv og en stol — vejlavet sørger for telt og grillkul.",
      contact: "Meld gerne til i vejens Facebook-gruppe",
    },
    {
      id: "op-5",
      category: "Initiativ",
      catColor: "#7c3aed",
      catBg: "#f3e8ff",
      title: "Borgere vil starte delebil-ordning i Boeslunde: Hvem vil være med?",
      date: "25. sep",
      area: "Boeslunde",
      author: "Mikkel H.",
      desc: "Vi undersøger muligheden for at oprette et lokalt elbils-fællesskab i Boeslunde for at nedsætte behovet for bil nummer to. Skriv hvis du vil med til et uformelt orienteringsmøde.",
      contact: "E-mail: mikkel.boeslunde@gmail.com",
    },
    {
      id: "op-6",
      category: "Frivillige",
      catColor: "#2563eb",
      catBg: "#dbeafe",
      title: "Røde Kors Genbrugsbutik i Korsør mangler en chauffør til lørdage",
      date: "24. sep",
      area: "Korsør",
      author: "Røde Kors Korsør",
      desc: "Har du kørekort B og lyst til at køre vores lille varevogn med donationer og møbler et par timer hver anden lørdag? Du bliver del af et varmt og hyggeligt frivillighold.",
      contact: "Henvendelse i butikken på Nygade",
    },
  ];

  const filteredPosts = posts.filter((p) => {
    if (filter === "alle") return true;
    return p.category.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "880px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Den Lokale Opslagstavle" },
          ]}
        />

        {/* Hero header */}
        <header className="opslag-header">
          <div className="opslag-header-top">
            <div className="opslag-badge">
              <MessageSquare size={14} />
              <span>BORGERTAVLEN I {site.kommune.toUpperCase()}</span>
            </div>

            <Link
              href="/indsend?kategori=opslagstavle"
              className="opslag-submit-btn"
            >
              <Plus size={16} />
              <span>Opret opslag på tavlen</span>
            </Link>
          </div>

          <h1 className="opslag-title">Den Lokale Opslagstavle</h1>
          <p className="opslag-desc">
            Lokalsamfundets fælles opslagstavle. Her kan borgere, foreninger, bylaug og klubber efterlyse, informere, finde frivillige hænder eller dele gode lokale initiativer.
          </p>
        </header>

        {/* Kategori filtre */}
        <div className="kalender-filters-scroll">
          <div className="kalender-filters">
            <Link
              href="/opslagstavle"
              className={`kalender-filter-pill ${filter === "alle" ? "is-active" : ""}`}
            >
              Alle opslag ({posts.length})
            </Link>
            <Link
              href="/opslagstavle?kategori=frivillige"
              className={`kalender-filter-pill ${filter === "frivillige" ? "is-active" : ""}`}
            >
              Frivillige søges
            </Link>
            <Link
              href="/opslagstavle?kategori=forening"
              className={`kalender-filter-pill ${filter === "forening" ? "is-active" : ""}`}
            >
              Foreningsliv
            </Link>
            <Link
              href="/opslagstavle?kategori=efterlysning"
              className={`kalender-filter-pill ${filter === "efterlysning" ? "is-active" : ""}`}
            >
              Efterlysning & Fundet
            </Link>
            <Link
              href="/opslagstavle?kategori=nabolag"
              className={`kalender-filter-pill ${filter === "nabolag" ? "is-active" : ""}`}
            >
              Nabolag & By
            </Link>
            <Link
              href="/opslagstavle?kategori=initiativ"
              className={`kalender-filter-pill ${filter === "initiativ" ? "is-active" : ""}`}
            >
              Lokale Initiativer
            </Link>
          </div>
        </div>

        {/* Grid med opslag */}
        <div className="opslag-grid">
          {filteredPosts.map((post) => (
            <article key={post.id} className="opslag-card">
              <div className="opslag-card-top">
                <span
                  className="opslag-card-category"
                  style={{ backgroundColor: post.catBg, color: post.catColor }}
                >
                  {post.category}
                </span>

                <div className="opslag-card-location">
                  <MapPin size={12} />
                  <span>{post.area}</span>
                </div>
              </div>

              <h2 className="opslag-card-title">{post.title}</h2>
              <p className="opslag-card-desc">{post.desc}</p>

              <div className="opslag-card-footer">
                <div className="opslag-card-author">
                  <User size={13} />
                  <span>{post.author}</span>
                  <span className="opslag-card-dot">·</span>
                  <span className="opslag-card-time">{post.date}</span>
                </div>

                <div className="opslag-card-contact">
                  {post.contact}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Info om opslagstavlen */}
        <div className="opslag-info-box">
          <ShieldCheck size={20} className="opslag-info-icon" />
          <div className="opslag-info-text">
            <strong>Et trygt og lokalt fællesskab:</strong> Alle opslag på opslagstavlen gennemgås af redaktionen for at sikre en god tone og modvirke spam. Opslagstavlen er gratis for borgere og almennyttige foreninger.
          </div>
        </div>
      </div>
    </div>
  );
}
