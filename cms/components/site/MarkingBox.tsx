import Link from "next/link";
import { Handshake, AlertCircle, MessageSquare, Bot, Megaphone } from "lucide-react";

type MarkingBoxProps = {
  indholdstype: "Uafhængig" | "Partner" | "Sponsoreret" | "Brugerindsendt" | "AI-assisteret" | "PR" | string;
  marking?: {
    sponsor?: string;
    labelTekst?: string;
    afsender?: string;
    godkendtAf?: string;
    kilder?: string[];
  } | null;
};

export function MarkingBox({ indholdstype, marking }: MarkingBoxProps) {
  if (indholdstype === "Uafhængig" || !indholdstype) {
    return null;
  }

  const sponsor = marking?.sponsor || "en lokal partner";
  const afsender = marking?.afsender || "en ekstern afsender";
  const godkendtAf = marking?.godkendtAf || "redaktionen";
  const kilder = Array.isArray(marking?.kilder) ? marking.kilder : [];

  return (
    <aside className={`site-marking-box site-marking-box-${indholdstype.toLowerCase()}`} role="note">
      <div className="site-marking-box-header">
        {indholdstype === "Partner" && <Handshake size={18} aria-hidden="true" />}
        {indholdstype === "Sponsoreret" && <AlertCircle size={18} aria-hidden="true" />}
        {indholdstype === "Brugerindsendt" && <MessageSquare size={18} aria-hidden="true" />}
        {indholdstype === "AI-assisteret" && <Bot size={18} aria-hidden="true" />}
        {indholdstype === "PR" && <Megaphone size={18} aria-hidden="true" />}
        <strong className="site-marking-box-title">
          {indholdstype === "Partner" && `Finansieret af ${sponsor}`}
          {indholdstype === "Sponsoreret" && `Annonce fra ${sponsor}`}
          {indholdstype === "Brugerindsendt" && `Indsendt indhold`}
          {indholdstype === "AI-assisteret" && `AI-assisteret artikel`}
          {indholdstype === "PR" && `Pressemeddelelse`}
        </strong>
      </div>

      <div className="site-marking-box-body">
        {indholdstype === "Partner" && (
          <p>
            Historien er finansieret af <strong>{sponsor}</strong> som en del af en støtteaftale.
            Redaktionen har haft fuld redaktionel kontrol med vinkling, indhold og kildevalg.
          </p>
        )}

        {indholdstype === "Sponsoreret" && (
          <p>
            Dette indhold er en betalt annonce produceret i samarbejde med <strong>{sponsor}</strong>.
            Indholdet er ikke omfattet af mediets redaktionelle dækning.
          </p>
        )}

        {indholdstype === "Brugerindsendt" && (
          <p>
            Indsendt af <strong>{afsender}</strong> som en del af vores åbne borgerjournalistik.
            Teksten er gennemlæst og redigeret af redaktionen før publicering.
          </p>
        )}

        {indholdstype === "AI-assisteret" && (
          <div>
            <p>
              Artiklen er udarbejdet med bistand fra sprogmodeller på baggrund af verificerede kilder,
              og er efterfølgende faktatjekket, redigeret og godkendt af <strong>{godkendtAf}</strong>.
            </p>
            {kilder.length > 0 && (
              <div className="site-marking-box-sources">
                <span className="site-marking-box-sources-label">Anvendte kilder:</span>
                <ul>
                  {kilder.map((kilde, idx) => (
                    <li key={idx}>
                      {kilde.startsWith("http") ? (
                        <a href={kilde} target="_blank" rel="noopener noreferrer">
                          {kilde}
                        </a>
                      ) : (
                        <span>{kilde}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {indholdstype === "PR" && (
          <p>
            Pressemeddelelse modtaget fra <strong>{afsender}</strong>, tilpasset og bragt til offentlig orientering.
          </p>
        )}

        <div className="site-marking-box-footer">
          <Link href="/om-mediet/redaktionelle-principper" className="site-marking-link">
            Læs vores redaktionelle principper →
          </Link>
        </div>
      </div>
    </aside>
  );
}
