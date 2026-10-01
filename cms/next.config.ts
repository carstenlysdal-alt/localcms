import type { NextConfig } from "next";
import { UPLOADS_HEADERS } from "./lib/security-headers";

const nextConfig: NextConfig = {
  // Sæt NEXT_DIST_DIR for at bygge/køre en produktionsbuild ved siden af dev-serveren uden at overskrive .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Skjul "X-Powered-By: Next.js".
  poweredByHeader: false,
  // Kompakt serverbuild (Railway/Docker). Har ingen effekt på `next dev`.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    serverActions: {
      // Offentlige formularer er små; 12 MB var kun nødvendigt for medieupload i redaktionen (lib/upload.ts: video ≤ 10 MB).
      // Next.js kan ikke sætte grænsen pr. action, så 12 MB gælder stadig globalt — men kun indloggede brugere når upload-actionen
      // (den kræver session + rate limit), og offentlige actions afviser store felter via validering (lib/validation/public.ts).
      // Sænk til "4mb" (SERVER_ACTIONS_BODY_LIMIT) hvis uploads flyttes til en dedikeret route/objektlager.
      bodySizeLimit: (process.env.SERVER_ACTIONS_BODY_LIMIT || "12mb") as `${number}mb`,
    },
  },
  async headers() {
    return [
      // /uploads/* er brugerleverede filer: aldrig udføres/renderes som sider. PDF'er undtages fra sandbox (Chrome blokerer
      // ellers den indbyggede PDF-fremviser) men får stadig default-src 'none' + nosniff.
      {
        source: "/uploads/:path((?!.*\\.pdf$).*)",
        headers: Object.entries(UPLOADS_HEADERS).map(([key, value]) => ({ key, value })),
      },
      {
        source: "/uploads/:path(.*\\.pdf)",
        headers: Object.entries({ ...UPLOADS_HEADERS, "Content-Security-Policy": "default-src 'none'" }).map(([key, value]) => ({ key, value })),
      },
    ];
  },
  async redirects() {
    return [
      // Host-kanonisering: www.<by>lokalt.dk -> <by>lokalt.dk (308). Apex er det kanoniske domæne
      // (canonical, sitemaps og schema peger alle på apex). Rammer ikke *.localhost.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.(?<domain>.*)" }],
        destination: "https://:domain/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
