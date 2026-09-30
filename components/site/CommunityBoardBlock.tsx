import Link from "next/link";
import { MessageSquare, Plus, ArrowRight, MapPin, User } from "lucide-react";

interface CommunityBoardBlockProps {
  siteNavn: string;
  kommuneNavn: string;
}

export function CommunityBoardBlock({
  siteNavn,
  kommuneNavn,
}: CommunityBoardBlockProps) {
  const samplePosts = [
    {
      id: "cb-1",
      category: "Frivillige søges",
      catColor: "#2563eb",
      catBg: "#dbeafe",
      title: "Korsør Bylaug søger 5 frivillige til naturstien ved Norstien",
      area: "Korsør",
      author: "Korsør Bylaug",
      desc: "Vi mangler et par ekstra hænder til at opsætte nye fuglekasser og reparere træbroen over bækken på lørdag.",
    },
    {
      id: "cb-2",
      category: "Foreningsliv",
      catColor: "#16a34a",
      catBg: "#dcfce7",
      title: "Slagelse Skakklub starter begynderhold for børn og voksne",
      area: "Slagelse By",
      author: "Slagelse Skakklub",
      desc: "Kunne du tænke dig at lære skak fra bunden? Vi starter nyt introforløb hver tirsdag aften i Medborgerhuset.",
    },
    {
      id: "cb-3",
      category: "Nabolag & By",
      catColor: "#d97706",
      catBg: "#fef3c7",
      title: "Vejfest og gadekridt for alle på Rosenvej & Liljevej",
      area: "Slagelse Syd",
      author: "Vejlavet Rosenvej",
      desc: "Vi fejrer efteråret med fælles grill og lege for børnene lørdag d. 10. oktober. Medbring egen madkurv!",
    },
  ];

  return (
    <section className="community-board-section" aria-label="Den lokale opslagstavle">
      <div className="community-board-inner">
        <div className="community-board-header">
          <div>
            <div className="community-board-badge">
              <MessageSquare size={13} />
              <span>FÆLLESSKABETS OPSLAGSTAVLE</span>
            </div>
            <h2 className="community-board-title">Den Lokale Opslagstavle</h2>
            <p className="community-board-desc">
              Har din forening brug for frivillige hænder, har du mistet noget, eller planlægger I en vejfest i nabolaget?
              Del det gratis med hele {kommuneNavn}.
            </p>
          </div>

          <div className="community-board-header-actions">
            <Link
              href="/indsend?kategori=opslagstavle"
              className="community-board-btn-create"
            >
              <Plus size={15} />
              <span>Opret opslag på tavlen</span>
            </Link>
            <Link
              href="/opslagstavle"
              className="community-board-btn-view"
            >
              <span>Se alle opslag</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="community-board-grid">
          {samplePosts.map((post) => (
            <Link
              key={post.id}
              href="/opslagstavle"
              className="community-board-card"
            >
              <div className="community-board-card-top">
                <span
                  className="community-board-card-cat"
                  style={{ backgroundColor: post.catBg, color: post.catColor }}
                >
                  {post.category}
                </span>
                <span className="community-board-card-area">
                  <MapPin size={12} />
                  {post.area}
                </span>
              </div>

              <h3 className="community-board-card-title">{post.title}</h3>
              <p className="community-board-card-desc">{post.desc}</p>

              <div className="community-board-card-author">
                <User size={13} />
                <span>{post.author}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
