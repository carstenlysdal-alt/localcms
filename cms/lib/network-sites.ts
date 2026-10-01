export type NetworkSiteSummary = {
  navn: string;
  domaene: string;
  by: string;
  accent: string;
};

export const ALL_NETWORK_SITES: NetworkSiteSummary[] = [
  { navn: "SlagelseLokalt", domaene: "slagelselokalt.dk", by: "Slagelse", accent: "#9E3D1B" },
  { navn: "NæstvedLokalt", domaene: "naestvedlokalt.dk", by: "Næstved", accent: "#1F5663" },
  { navn: "HolbækLokalt", domaene: "holbaeklokalt.dk", by: "Holbæk", accent: "#4F5B1E" },
  { navn: "RingstedLokalt", domaene: "ringstedlokalt.dk", by: "Ringsted", accent: "#8A5A00" },
  { navn: "KøgeLokalt", domaene: "koegelokalt.dk", by: "Køge", accent: "#24533A" },
  { navn: "RoskildeLokalt", domaene: "roskildelokalt.dk", by: "Roskilde", accent: "#6A3553" },
];

export const DEFAULT_TAGLINES: Record<string, string> = {
  "slagelselokalt.dk": "Uafhængig lokaljournalistik, der sætter fællesskabet først",
  "naestvedlokalt.dk": "Din uafhængige stemme i Næstved, Karrebæksminde og omegn",
  "holbaeklokalt.dk": "Uafhængig lokaljournalistik fra Isefjorden til det åbne Vestsjælland",
  "ringstedlokalt.dk": "Nyheder fra hjertet af Sjælland — lokalt, uafhængigt og tæt på dig",
  "koegelokalt.dk": "Lokaljournalistik med blik for Køges vækst, havn og stærke fællesskaber",
  "roskildelokalt.dk": "Kultur, viden og byens puls — uafhængig lokaljournalistik i Roskilde",
};
