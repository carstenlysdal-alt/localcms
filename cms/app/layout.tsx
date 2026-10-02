import type { Metadata } from "next";
import { Inter, Newsreader, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Offentlig serif: bruges af det offentlige site og forside-preview (de indlæser selv deres egen kopi) og af ældre
// overskrifts-regler. Ikke preloadet i redaktionen — browseren henter den kun, hvis en side faktisk bruger den.
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

// Redaktionens display-/UI-font (overskrifter, knapper, tal i KPI-kort). Variabel font: én fil for alle vægte.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-display-var",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lysdals CMS",
  description: "Generisk, AI-understøttet redaktionelt CMS",
  // Standard for alt uden for det offentlige site (login, redaktion). (site)/layout.tsx
  // sætter sine egne robots-regler, så offentlige sider ikke påvirkes.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" className={`${inter.variable} ${newsreader.variable} ${jakarta.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
