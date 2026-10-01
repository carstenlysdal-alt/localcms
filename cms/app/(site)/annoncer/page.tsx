import { permanentRedirect } from "next/navigation";

// /annoncer var en dublet af /priser. Én kanonisk side: /priser.
export default function AnnoncerPage(): never {
  permanentRedirect("/priser");
}
