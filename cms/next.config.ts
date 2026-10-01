import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
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
