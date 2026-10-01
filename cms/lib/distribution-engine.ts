export interface ArticleDistributionInput {
  id: string;
  titel: string;
  publiceretTid: Date;
  indholdstype: "Uafhængig" | "Partner" | "Sponsoreret" | "Brugerindsendt" | "AI-assisteret" | "PR";
  breaking: boolean;
  pinned: boolean;
  sektionSlug: string;
  omraadeSlug?: string | null;
  kategoriNavn?: string;
  forfatterNavn?: string;
  omraadeNavn?: string | null;
  visninger: number;
  laesninger: number;
  totalLaesetidSek: number;
}

export interface DistributionScoreResult {
  articleId: string;
  baseEditorialScore: number;
  decayMultiplier: number;
  velocityScore: number;
  daypartBonus: number;
  geoBonus: number;
  totalScore: number;
}

/**
 * Beregner tidshenfald (exponential decay) ud fra timer siden publicering.
 * Hårde nyheder forældes hurtigere end dybdegående kultur/baggrundsartikler.
 */
export function calculateDecay(hoursAgo: number, isBreaking: boolean, sektionSlug: string): number {
  if (isBreaking) {
    // Breaking er ultra-frisk de første 3 timer, herefter falder det
    return hoursAgo <= 3 ? 1.0 : Math.max(0.2, Math.exp(-0.15 * (hoursAgo - 3)));
  }

  // Halveringstid:
  // Nyheder/Sport = 12 timer
  // Erhverv/Kultur/Debat = 36 timer
  const halfLifeHours = (sektionSlug === "nyheder" || sektionSlug === "sport") ? 12 : 36;
  const lambda = Math.LN2 / halfLifeHours;
  return Math.max(0.05, Math.exp(-lambda * hoursAgo));
}

/**
 * Beregner Daypart-bonus ud fra det aktuelle klokkeslæt og sektion.
 * Morgen (06-09): Nyheder, trafik, kort nyt
 * Middag (11-14): Erhverv, debat
 * Eftermiddag/Aften (16-22): Kultur, sport, fordybelse
 */
export function calculateDaypartBonus(hourOfDay: number, sektionSlug: string): number {
  if (hourOfDay >= 6 && hourOfDay < 10) {
    if (sektionSlug === "nyheder") return 25;
    return 0;
  }
  if (hourOfDay >= 11 && hourOfDay < 15) {
    if (sektionSlug === "erhverv" || sektionSlug === "debat") return 20;
    return 0;
  }
  if (hourOfDay >= 16 && hourOfDay <= 22) {
    if (sektionSlug === "kultur" || sektionSlug === "sport") return 25;
    return 0;
  }
  return 0;
}

/**
 * Beregner en samlet fordelingsscore for en artikel.
 */
export function calculateArticleScore(
  article: ArticleDistributionInput,
  options: { now?: Date; currentHour?: number } = {}
): DistributionScoreResult {
  const now = options.now ?? new Date();
  const currentHour = options.currentHour ?? now.getHours();

  const diffMs = Math.max(0, now.getTime() - new Date(article.publiceretTid).getTime());
  const hoursAgo = diffMs / (1000 * 60 * 60);

  // 1. Redaktionel basis-score
  let baseEditorialScore = 50;
  if (article.breaking) baseEditorialScore += 300;
  if (article.pinned) baseEditorialScore += 150;

  // 2. Decay
  const decayMultiplier = calculateDecay(hoursAgo, article.breaking, article.sektionSlug);

  // 3. Velocity / Læseradfærd
  // Gennemlæsningsrate (0-1) og gennemsnitlig læsetid
  const readRate = article.visninger > 0 ? Math.min(1, article.laesninger / article.visninger) : 0.5;
  const avgReadSec = article.laesninger > 0 ? Math.min(180, article.totalLaesetidSek / article.laesninger) : 45;
  const velocityScore = parseFloat(((article.visninger / 50) + (readRate * 40) + (avgReadSec / 5)).toFixed(1));

  // 4. Daypart bonus
  const daypartBonus = calculateDaypartBonus(currentHour, article.sektionSlug);

  // 5. Geografisk bonus for områder uden for Slagelse By (Korsør, Skælskør, osv.)
  let geoBonus = 0;
  if (article.omraadeSlug && article.omraadeSlug !== "slagelse-by") {
    geoBonus = 15; // Sikrer regional dækning
  }

  // Samlet score formel:
  // (Base * Decay) + (Velocity * Decay) + DaypartBonus + GeoBonus
  const rawTotal = (baseEditorialScore * decayMultiplier) + (velocityScore * decayMultiplier) + daypartBonus + geoBonus;
  const totalScore = parseFloat(rawTotal.toFixed(1));

  return {
    articleId: article.id,
    baseEditorialScore,
    decayMultiplier: parseFloat(decayMultiplier.toFixed(3)),
    velocityScore,
    daypartBonus,
    geoBonus,
    totalScore,
  };
}

/**
 * Rangerer og fordeler artikler med håndhævelse af kvoteloft for betalt indhold (maks 25%).
 */
export function distributeArticles(
  articles: ArticleDistributionInput[],
  maxQuotaPercent = 25
): {
  ranked: Array<ArticleDistributionInput & { scoreResult: DistributionScoreResult }>;
  topArticle: (ArticleDistributionInput & { scoreResult: DistributionScoreResult }) | null;
  secondaryArticles: Array<ArticleDistributionInput & { scoreResult: DistributionScoreResult }>;
  quotaAlert: boolean;
  commercialRatioPercent: number;
} {
  const scored = articles.map((art) => ({
    ...art,
    scoreResult: calculateArticleScore(art),
  }));

  // Sorter faldende efter score
  scored.sort((a, b) => b.scoreResult.totalScore - a.scoreResult.totalScore);

  // Håndhæv kvoteloft for topzonen (f.eks. top 5 artikler)
  const topSlice = scored.slice(0, 5);
  const commercialCount = topSlice.filter((a) => a.indholdstype === "Partner" || a.indholdstype === "Sponsoreret").length;
  const commercialRatioPercent = topSlice.length > 0 ? Math.round((commercialCount / topSlice.length) * 100) : 0;
  const quotaAlert = commercialRatioPercent > maxQuotaPercent;

  const topArticle = scored.length > 0 ? scored[0] : null;
  const secondaryArticles = scored.slice(1, 4);

  return {
    ranked: scored,
    topArticle,
    secondaryArticles,
    quotaAlert,
    commercialRatioPercent,
  };
}
