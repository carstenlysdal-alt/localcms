import Link from "next/link";
import Image from "next/image";
import { formatFullDate } from "@/lib/site-queries";

type BylineProps = {
  forfatter?: {
    navn: string;
    slug?: string | null;
    bio?: string | null;
    profilbilledeUrl?: string | null;
  } | null;
  publiceretTid: Date | string;
  opdateretTid?: Date | string | null;
};

export function Byline({ forfatter, publiceretTid, opdateretTid }: BylineProps) {
  const pubDate = typeof publiceretTid === "string" ? new Date(publiceretTid) : publiceretTid;
  const updDate = opdateretTid
    ? typeof opdateretTid === "string"
      ? new Date(opdateretTid)
      : opdateretTid
    : null;

  const isUpdated = updDate && Math.abs(updDate.getTime() - pubDate.getTime()) > 5 * 60 * 1000;

  return (
    <div className="site-byline">
      {forfatter?.profilbilledeUrl && (
        <div className="site-byline-avatar">
          <Image
            src={forfatter.profilbilledeUrl}
            alt={forfatter.navn}
            width={44}
            height={44}
            className="site-byline-avatar-img"
          />
        </div>
      )}

      <div className="site-byline-info">
        <div className="site-byline-author">
          {forfatter ? (
            forfatter.slug ? (
              <Link href={`/forfatter/${forfatter.slug}`} className="site-byline-link">
                {forfatter.navn}
              </Link>
            ) : (
              <span>{forfatter.navn}</span>
            )
          ) : (
            <span>Redaktionen</span>
          )}
        </div>

        <div className="site-byline-time">
          <span>Publiceret {formatFullDate(pubDate)}</span>
          {isUpdated && (
            <>
              <span className="site-byline-dot">·</span>
              <span>Opdateret {formatFullDate(updDate)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
