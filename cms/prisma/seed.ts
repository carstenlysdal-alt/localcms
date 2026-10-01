import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { PERMISSIONS } from "../lib/permissions";
import { NETWORK_SITES, ALL_NETWORK_SITES_INFO } from "./network-seed-data";

const db = new PrismaClient();

const areas = [
  { navn: "Slagelse By", slug: "slagelse-by", lat: 55.4038, lng: 11.3544 },
  { navn: "Korsør", slug: "korsoer", lat: 55.3292, lng: 11.1378 },
  { navn: "Skælskør", slug: "skaelskoer", lat: 55.2536, lng: 11.2947 },
  { navn: "Dalmose", slug: "dalmose", lat: 55.2936, lng: 11.4192 },
  { navn: "Vemmelev", slug: "vemmelev", lat: 55.3528, lng: 11.2361 },
  { navn: "Boeslunde", slug: "boeslunde", lat: 55.3022, lng: 11.2783 },
  { navn: "Agersø", slug: "agersoe", lat: 55.2158, lng: 11.1969 },
  { navn: "Omø", slug: "omoe", lat: 55.1583, lng: 11.1611 },
];

const categoryTree = [
  {
    navn: "Nyheder",
    slug: "nyheder",
    beskrivelse: "Nyheder fra hele kommunen",
    sortering: 1,
    children: [
      { navn: "Politik", slug: "politik", sortering: 1 },
      { navn: "Krimi og retsvæsen", slug: "krimi-og-retsvaesen", sortering: 2 },
      { navn: "Trafik", slug: "trafik", sortering: 3 },
      { navn: "Skole og børn", slug: "skole-og-boern", sortering: 4 },
      { navn: "Sundhed", slug: "sundhed", sortering: 5 },
      { navn: "Bolig og byudvikling", slug: "bolig-og-byudvikling", sortering: 6 },
      { navn: "Natur og klima", slug: "natur-og-klima", sortering: 7 },
    ],
  },
  {
    navn: "Erhverv",
    slug: "erhverv",
    beskrivelse: "Erhvervsliv og arbejdsmarked",
    sortering: 2,
    children: [
      { navn: "Handel", slug: "handel", sortering: 1 },
      { navn: "Job og arbejdsmarked", slug: "job-og-arbejdsmarked", sortering: 2 },
      { navn: "Iværksættere", slug: "ivaerksaettere", sortering: 3 },
      { navn: "Landbrug", slug: "landbrug", sortering: 4 },
      { navn: "Byggeri og ejendomme", slug: "byggeri-og-ejendomme", sortering: 5 },
    ],
  },
  {
    navn: "Sport",
    slug: "sport",
    beskrivelse: "Lokalsport og motion",
    sortering: 3,
    children: [
      { navn: "Fodbold", slug: "fodbold", sortering: 1 },
      { navn: "Håndbold", slug: "haandbold", sortering: 2 },
      { navn: "Motion og løb", slug: "motion-og-loeb", sortering: 3 },
      { navn: "Anden sport", slug: "anden-sport", sortering: 4 },
    ],
  },
  {
    navn: "Kultur",
    slug: "kultur",
    beskrivelse: "Kultur, musik og oplevelser",
    sortering: 4,
    children: [
      { navn: "Musik", slug: "musik", sortering: 1 },
      { navn: "Scene og film", slug: "scene-og-film", sortering: 2 },
      { navn: "Kunst og museer", slug: "kunst-og-museer", sortering: 3 },
      { navn: "Mad og drikke", slug: "mad-og-drikke", sortering: 4 },
    ],
  },
  {
    navn: "Foreningsliv",
    slug: "foreningsliv",
    beskrivelse: "Frivillige og foreninger",
    sortering: 5,
    children: [
      { navn: "Frivillige", slug: "frivillige", sortering: 1 },
      { navn: "Idrætsforeninger", slug: "idraetsforeninger", sortering: 2 },
      { navn: "Kulturforeninger", slug: "kulturforeninger", sortering: 3 },
      { navn: "Lokalråd", slug: "lokalraad", sortering: 4 },
    ],
  },
  {
    navn: "Debat",
    slug: "debat",
    beskrivelse: "Meninger, debat og læserbreve",
    sortering: 6,
    children: [
      { navn: "Leder", slug: "leder", sortering: 1 },
      { navn: "Kommentarer", slug: "kommentarer", sortering: 2 },
      { navn: "Læserbreve", slug: "laeserbreve", sortering: 3 },
    ],
  },
];

const mediaItems = [
  { id: "media-byraad", url: "/media/byraad.svg", filnavn: "byraad.svg", altTekst: "Slagelse Rådhus set fra forpladsen", billedtekst: "Slagelse Byråd i samling på rådhuset.", filtype: "billede" },
  { id: "media-havn", url: "/media/havn.svg", filnavn: "havn.svg", altTekst: "Korsør Havn med Storebæltsbroen i baggrunden", billedtekst: "Udsigt over Korsør Havn en tidlig formiddag.", filtype: "billede" },
  { id: "media-erhverv", url: "/media/erhverv.svg", filnavn: "erhverv.svg", altTekst: "Erhvervsbygninger og kontorer", billedtekst: "Det lokale erhvervsliv oplever vækst.", filtype: "billede" },
  { id: "media-sport", url: "/media/sport.svg", filnavn: "sport.svg", altTekst: "Slagelse Stadion med løbebane", billedtekst: "Sportsanlægget klar til aftenens kamp.", filtype: "billede" },
  { id: "media-kultur", url: "/media/kultur.svg", filnavn: "kultur.svg", altTekst: "Kulturhuset i aftensol", billedtekst: "Kulturnat samler borgere i alle aldre.", filtype: "billede" },
  { id: "media-forening", url: "/media/forening.svg", filnavn: "forening.svg", altTekst: "Frivillige borgere samlet til arbejdsdag", billedtekst: "Foreningslivet er grundpillen i lokalsamfundet.", filtype: "billede" },
  { id: "media-natur", url: "/media/natur.svg", filnavn: "natur.svg", altTekst: "Kystlinje og strandeng ved Skælskør", billedtekst: "Vestsjællands natur indbyder til gåture.", filtype: "billede" },
  { id: "media-skole", url: "/media/skole.svg", filnavn: "skole.svg", altTekst: "Moderne folkeskolebygning", billedtekst: "Ny teknologi og fællesskaber på folkeskolerne.", filtype: "billede" },
  { id: "media-trafik", url: "/media/trafik.svg", filnavn: "trafik.svg", altTekst: "Hovedfærdselsåre og cykelsti", billedtekst: "Trafiksikkerheden opgraderes i flere kryds.", filtype: "billede" },
  { id: "media-debat", url: "/media/debat.svg", filnavn: "debat.svg", altTekst: "Talebobler der symboliserer debat", billedtekst: "Borgernes stemme og debatindlæg.", filtype: "billede" },
];

const roles = [
  { navn: "Ansvarshavende redaktør", permissions: Object.values(PERMISSIONS) },
  { navn: "Redaktionsleder", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.ARTICLE_EDIT_ALL, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL, PERMISSIONS.SUPPORT_READ, PERMISSIONS.HONORAR_VIEW, PERMISSIONS.HONOR_MANAGE, PERMISSIONS.TASK_MANAGE, PERMISSIONS.TASK_VIEW_ALL, PERMISSIONS.FRONTPAGE_EDIT] },
  { navn: "Freelancejournalist", permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.SOURCE_VIEW_CONFIDENTIAL, PERMISSIONS.HONOR_VIEW_OWN] },
  { navn: "Medieproducent", permissions: [PERMISSIONS.MEDIA_MANAGE, PERMISSIONS.HONOR_VIEW_OWN] },
  { navn: "Community manager", permissions: [PERMISSIONS.ARTICLE_CREATE] },
  { navn: "Salgs- og partnerskabsansvarlig", permissions: [PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_MANAGE] },
  { navn: "Teknisk produktansvarlig", permissions: [PERMISSIONS.USERS_MANAGE] },
  { navn: "Støtte", permissions: [PERMISSIONS.SUPPORT_READ] },
] as const;

async function main() {
  const instance = await db.instance.upsert({
    where: { id: "slagelse-reference" },
    update: {
      navn: "SlagelseLokalt",
      domaene: "slagelselokalt.dk",
      farver: { accent: "#9E3D1B", accentStrong: "#7F2F13", accentSoft: "#F6E3D8", onAccent: "#FFFFFF" },
      typografi: { heading: "Bricolage Grotesque", body: "Literata" },
      geografiskDækning: areas.map((a) => a.navn),
      kategoriTaksonomi: categoryTree.map((c) => c.navn),
      kvoteloftProcent: 25,
      markingTekster: {
        sponsorLabel: "Sponsoreret indhold",
        partnerLabel: "Finansieret af",
        principperUrl: "/om-mediet/redaktionelle-principper",
      },
      sideTekster: {
        omMediet: "SlagelseLokalt er et lokalt nyhedsmedie med fuld journalistisk uafhængighed.",
        principper: "Vi følger god presseskik og mærker alt betalt og assisteret indhold tydeligt.",
        kontakt: "Kontakt redaktionen på redaktion@slagelselokalt.dk eller telefon 58 50 00 00.",
      },
      netvaerk: ALL_NETWORK_SITES_INFO.filter((s) => s.domaene !== "slagelselokalt.dk"),
    },
    create: {
      id: "slagelse-reference",
      navn: "SlagelseLokalt",
      domaene: "slagelselokalt.dk",
      farver: { accent: "#9E3D1B", accentStrong: "#7F2F13", accentSoft: "#F6E3D8", onAccent: "#FFFFFF" },
      typografi: { heading: "Bricolage Grotesque", body: "Literata" },
      geografiskDækning: areas.map((a) => a.navn),
      kategoriTaksonomi: categoryTree.map((c) => c.navn),
      kvoteloftProcent: 25,
      markingTekster: {
        sponsorLabel: "Sponsoreret indhold",
        partnerLabel: "Finansieret af",
        principperUrl: "/om-mediet/redaktionelle-principper",
      },
      sideTekster: {
        omMediet: "SlagelseLokalt er et lokalt nyhedsmedie med fuld journalistisk uafhængighed.",
        principper: "Vi følger god presseskik og mærker alt betalt og assisteret indhold tydeligt.",
        kontakt: "Kontakt redaktionen på redaktion@slagelselokalt.dk eller telefon 58 50 00 00.",
      },
      netvaerk: ALL_NETWORK_SITES_INFO.filter((s) => s.domaene !== "slagelselokalt.dk"),
    },
  });

  // Roller
  const roleMap = new Map<string, string>();
  for (const role of roles) {
    const saved = await db.role.upsert({
      where: { navn: role.navn },
      update: { permissions: [...role.permissions] },
      create: { navn: role.navn, permissions: [...role.permissions] },
    });
    roleMap.set(role.navn, saved.id);
  }

  // Mediebibliotek
  const mediaMap = new Map<string, string>();
  for (const item of mediaItems) {
    const m = await db.media.upsert({
      where: { id: item.id },
      update: { url: item.url, filnavn: item.filnavn, altTekst: item.altTekst, billedtekst: item.billedtekst, filtype: item.filtype, instansId: instance.id },
      create: { id: item.id, url: item.url, filnavn: item.filnavn, altTekst: item.altTekst, billedtekst: item.billedtekst, filtype: item.filtype, kildeType: "Lokal", instansId: instance.id },
    });
    mediaMap.set(item.id, m.id);
  }

  // Forfattere
  const authorsData = [
    { id: "author-carsten", navn: "Carsten Lysdal", slug: "carsten-lysdal", type: "Fast", bio: "Ansvarshavende redaktør på SlagelseLokalt.", avatar: "/avatars/carsten.svg" },
    { id: "author-rikke", navn: "Rikke Møller", slug: "rikke-moeller", type: "Fast", bio: "Nyhedsredaktør med fokus på kommunalpolitik og erhverv.", avatar: "/avatars/rikke.svg" },
    { id: "author-jonas", navn: "Jonas Vestergaard", slug: "jonas-vestergaard", type: "Freelance", bio: "Freelancejournalist med base i Korsør, dækker kultur og sport.", avatar: "/avatars/jonas.svg" },
    { id: "author-mette", navn: "Mette Lind", slug: "mette-lind", type: "Freelance", bio: "Lokalreporter med særligt kendskab til foreningsliv og natur.", avatar: "/avatars/mette.svg" },
  ];
  const authorMap = new Map<string, string>();
  for (const a of authorsData) {
    const saved = await db.author.upsert({
      where: { id: a.id },
      update: { navn: a.navn, slug: a.slug, forfatterType: a.type, bio: a.bio, profilbilledeUrl: a.avatar, instansId: instance.id },
      create: { id: a.id, navn: a.navn, slug: a.slug, forfatterType: a.type, bio: a.bio, profilbilledeUrl: a.avatar, instansId: instance.id },
    });
    authorMap.set(a.id, saved.id);
  }

  // Brugere
  const passwordHash = await hash("cms-demo-2026", 12);
  await db.user.upsert({
    where: { email: "redaktoer@slagelse.test" },
    update: { passwordHash, roleId: roleMap.get("Ansvarshavende redaktør")!, authorId: authorMap.get("author-rikke")! },
    create: { email: "redaktoer@slagelse.test", navn: "Rikke Møller", passwordHash, roleId: roleMap.get("Ansvarshavende redaktør")!, instansId: instance.id, authorId: authorMap.get("author-rikke")! },
  });
  await db.user.upsert({
    where: { email: "journalist@slagelse.test" },
    update: { passwordHash, roleId: roleMap.get("Freelancejournalist")!, authorId: authorMap.get("author-jonas")! },
    create: { email: "journalist@slagelse.test", navn: "Jonas Vestergaard", passwordHash, roleId: roleMap.get("Freelancejournalist")!, instansId: instance.id, authorId: authorMap.get("author-jonas")! },
  });
  await db.user.upsert({
    where: { email: "carsten@slagelse.test" },
    update: { passwordHash, roleId: roleMap.get("Ansvarshavende redaktør")!, authorId: authorMap.get("author-carsten")! },
    create: { email: "carsten@slagelse.test", navn: "Carsten Lysdal", passwordHash, roleId: roleMap.get("Ansvarshavende redaktør")!, instansId: instance.id, authorId: authorMap.get("author-carsten")! },
  });

  // Kategoritræ
  const categoryMap = new Map<string, string>();
  for (const parent of categoryTree) {
    const p = await db.category.upsert({
      where: { instansId_slug: { instansId: instance.id, slug: parent.slug } },
      update: { navn: parent.navn, beskrivelse: parent.beskrivelse, sortering: parent.sortering, parentId: null },
      create: { navn: parent.navn, slug: parent.slug, beskrivelse: parent.beskrivelse, sortering: parent.sortering, instansId: instance.id },
    });
    categoryMap.set(parent.slug, p.id);

    for (const child of parent.children) {
      const c = await db.category.upsert({
        where: { instansId_slug: { instansId: instance.id, slug: child.slug } },
        update: { navn: child.navn, sortering: child.sortering, parentId: p.id },
        create: { navn: child.navn, slug: child.slug, sortering: child.sortering, parentId: p.id, instansId: instance.id },
      });
      categoryMap.set(child.slug, c.id);
    }
  }

  // Områder (GeoTags)
  const areaMap = new Map<string, string>();
  for (const area of areas) {
    const g = await db.geoTag.upsert({
      where: { instansId_slug: { instansId: instance.id, slug: area.slug } },
      update: { navn: area.navn, lat: area.lat, lng: area.lng },
      create: { navn: area.navn, slug: area.slug, lat: area.lat, lng: area.lng, instansId: instance.id },
    });
    areaMap.set(area.slug, g.id);
  }

  // Tags
  const tagList = ["Kommunalpolitik", "Storebælt", "Handelsliv", "Børnefamilier", "Bæredygtighed", "Frivillighed", "Kulturarv", "Lokalsport"];
  const tagMap = new Map<string, string>();
  for (const navn of tagList) {
    const slug = navn.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa");
    const t = await db.tag.upsert({
      where: { instansId_navn: { instansId: instance.id, navn } },
      update: { slug },
      create: { navn, slug, instansId: instance.id },
    });
    tagMap.set(slug, t.id);
  }

  // Støtteaftaler og organisationer
  const org1 = await db.organization.upsert({
    where: { id: "org-sparekassen" },
    update: {},
    create: { id: "org-sparekassen", navn: "Sparekassen Sjælland-Fyn", branche: "Finans", kontakt: "erhverv@spks.dk", instansId: instance.id },
  });
  await db.organization.upsert({
    where: { id: "org-bilcenter" },
    update: {},
    create: { id: "org-bilcenter", navn: "Vestsjællands Bilcenter", branche: "Autoforhandler", kontakt: "salg@vestbil.dk", instansId: instance.id },
  });
  await db.supportAgreement.upsert({
    where: { id: "sa-sparekassen" },
    update: {},
    create: {
      id: "sa-sparekassen",
      organisationNavn: "Sparekassen Sjælland-Fyn",
      pakkeNiveau: "Fællesskab",
      startDato: new Date("2026-01-01"),
      arligKvote: 10,
      forbrugtKvote: 2,
      kontaktperson: "Klaus Mortensen",
      pris: 30000,
      organizationId: org1.id,
      instansId: instance.id,
    },
  });

  // Takster for opgaver
  const rates = [
    ["Kort nyhedsartikel", 300, 500, 400], ["Standardartikel", 600, 1000, 800],
    ["Dybdegående artikel/reportage", 1500, 2500, 2000], ["Interview", 800, 1400, 1100],
    ["Fotoreportage", 500, 1200, 850], ["Lydreportage/podcast", 1200, 2500, 1800],
    ["Videoproduktion", 2000, 4000, 3000], ["Live-dækning", 400, 600, 500],
    ["Opdatering af artikel", 150, 300, 225], ["Researchopgave", 300, 400, 350],
  ] as const;
  for (const [leverancetype, minimum, maksimum, standard] of rates) {
    await db.honorRate.upsert({
      where: { instansId_leverancetype: { instansId: instance.id, leverancetype } },
      update: { minimum, maksimum, standard, aktiv: true },
      create: { leverancetype, minimum, maksimum, standard, instansId: instance.id },
    });
  }

  // 42 Realistiske artikler fordelt over alle sektioner, undersektioner og områder
  const articlesSeed = [
    // --- NYHEDER (7 undersektioner) ---
    {
      slug: "nyt-flertal-vil-investere-45-millioner-i-bymidten",
      titel: "Nyt flertal på rådhuset vil investere 45 millioner i bymidten",
      manchet: "En bred aftale mellem fem partier skal puste nyt liv i gågaden og torvet med mere grønt og færre tomme butiksvinduer.",
      sectionSlug: "politik",
      areaSlug: "slagelse-by",
      authorId: "author-rikke",
      mediaId: "media-byraad",
      pinned: true,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 0,
      hoursAgo: 2,
    },
    {
      slug: "voldsom-koedannelse-paa-storebaeltsbroen-efter-uheld",
      titel: "Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld",
      manchet: "To biler stødte sammen tidligt tirsdag morgen. Vejhjælp arbejder på stedet, og der meldes om op mod 45 minutters forsinkelse.",
      sectionSlug: "trafik",
      areaSlug: "korsoer",
      authorId: "author-jonas",
      mediaId: "media-trafik",
      pinned: false,
      breaking: true,
      indholdstype: "Uafhængig",
      daysAgo: 0,
      hoursAgo: 1,
    },
    {
      slug: "indbrudsboelge-i-sommerhuse-paa-skaelskoer-naes",
      titel: "Flere sommerhuse udsat for indbrud i weekenden ved Skælskør Næs",
      manchet: "Politiet efterlyser vidner efter fire indbrud, hvor der primært er stjålet havemøbler og designerlamper.",
      sectionSlug: "krimi-og-retsvaesen",
      areaSlug: "skaelskoer",
      authorId: "author-carsten",
      mediaId: "media-byraad",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 1,
    },
    {
      slug: "ny-skoleleder-paa-marievangsskolen-vil-fokusere-paa-trivsel",
      titel: "Ny skoleleder på Marievangsskolen: 'Vi skal have roen og læselysten tilbage'",
      manchet: "Efter en turbulent periode med vikarer tiltræder 48-årige Anne Kirstine Holm som ny leder for Slagelses største folkeskole.",
      sectionSlug: "skole-og-boern",
      areaSlug: "slagelse-by",
      authorId: "author-mette",
      mediaId: "media-skole",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 2,
    },
    {
      slug: "sundhedscenter-i-korsoer-udvider-aabningstiderne",
      titel: "Sundhedscenter i Korsør udvider åbningstider for blodprøvetagning",
      manchet: "Fra næste uge kan pendlere få taget prøver allerede fra klokken 06.30, oplyser Region Sjælland.",
      sectionSlug: "sundhed",
      areaSlug: "korsoer",
      authorId: "author-rikke",
      mediaId: "media-byraad",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 3,
    },
    {
      slug: "planer-om-80-nye-traehuse-ved-dalmose-sendt-i-hoering",
      titel: "Planer om 80 bæredygtige træhuse ved Dalmose sendt i offentlig høring",
      manchet: "Et nyt boligområde med fælleshus og regnvandssøer kan blive virkelighed for Dalmose inden 2028.",
      sectionSlug: "bolig-og-byudvikling",
      areaSlug: "dalmose",
      authorId: "author-jonas",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 4,
    },
    {
      slug: "kystbeskyttelse-ved-skaelskoer-fjord-faar-groent-lys",
      titel: "Kystbeskyttelse ved Skælskør Fjord sikrer lavtliggende huse mod stormflod",
      manchet: "Projektet til 18 millioner kroner kombinerer diger og rekreative stier langs det sårbare kystbælte.",
      sectionSlug: "natur-og-klima",
      areaSlug: "skaelskoer",
      authorId: "author-mette",
      mediaId: "media-natur",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 5,
    },

    // --- ERHVERV (5 undersektioner) ---
    {
      slug: "historisk-koebmandsgaard-i-skaelskoer-genopstaar-som-delikatesse",
      titel: "Historisk købmandsgård i Skælskør genopstår som lokal delikatessebutik",
      manchet: "To barndomsvenner har overtaget den fredede bygning og vil sælge råvarer fra Vestsjællands gårde og mosterier.",
      sectionSlug: "handel",
      areaSlug: "skaelskoer",
      authorId: "author-carsten",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 1,
    },
    {
      slug: "ny-laerepladsgaranti-fra-lokale-haandvaerkere-i-korsoer",
      titel: "Ny lærepladsgaranti fra lokale håndværkere skal sikre flere faglærte",
      manchet: "Ti murere og tømrere i Korsør går sammen for at sikre, at ingen lærlinge må afbryde deres uddannelse.",
      sectionSlug: "job-og-arbejdsmarked",
      areaSlug: "korsoer",
      authorId: "author-jonas",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 2,
    },
    {
      slug: "groen-start-up-i-vemmelev-faar-millioninvestering-til-algedyrkning",
      titel: "Grøn start-up i Vemmelev modtager millioninvestering til algedyrkning",
      manchet: "Virksomheden Algaepac har udviklet en bionedbrydelig emballage og udvider nu produktionen i Vemmelev Erhvervspark.",
      sectionSlug: "ivaerksaettere",
      areaSlug: "vemmelev",
      authorId: "author-rikke",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 3,
    },
    {
      slug: "oekologiske-landmaend-ved-boeslunde-samles-om-faelles-mejeri",
      titel: "Økologiske mælkeproducenter ved Boeslunde stifter fælles gårdmejeri",
      manchet: "Tre landmænd vil producere specialoste og smør med mælk fra græssende køer langs Storebæltkysten.",
      sectionSlug: "landbrug",
      areaSlug: "boeslunde",
      authorId: "author-mette",
      mediaId: "media-natur",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 6,
    },
    {
      slug: "erhvervshavnen-i-korsoer-investerer-i-ny-kran-til-bulkvarer",
      titel: "Korsør Havn investerer 32 millioner kroner i ny mobilkran til bulkvarer",
      manchet: "Investeringen skal halvere lossetiden for korn og råstoffer til sjællandske landbrug og byggepladser.",
      sectionSlug: "byggeri-og-ejendomme",
      areaSlug: "korsoer",
      authorId: "author-jonas",
      mediaId: "media-havn",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 7,
    },

    // --- SPORT (4 undersektioner) ---
    {
      slug: "slagelse-bi-tager-dramatisk-sejr-i-sidste-overtidsminut",
      titel: "Slagelse B&I sikrer tre vigtige point i dramatisk overtidsdrama",
      manchet: "En scoring direkte på hjørnespark i det 94. minut sendte Slagelse til tops i Danmarksserien foran 850 tilskuere.",
      sectionSlug: "fodbold",
      areaSlug: "slagelse-by",
      authorId: "author-jonas",
      mediaId: "media-sport",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 1,
    },
    {
      slug: "korsoer-haandbold-rykker-op-efter-ubesejret-foraarssaeson",
      titel: "Korsør/Tårnborg Håndbold rykker op efter suveræn sæson uden nederlag",
      manchet: "Træner Michael Poulsen roser holdets forsvarsdisciplin efter den afgørende 28-22 sejr mod Nykøbing Falster.",
      sectionSlug: "haandbold",
      areaSlug: "korsoer",
      authorId: "author-jonas",
      mediaId: "media-sport",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 3,
    },
    {
      slug: "rekordmange-tilmeldte-til-storebaelt-halvmaraton",
      titel: "Rekordtilmelding: 3.500 løbere snører skoene til Storebælt Halvmaraton",
      manchet: "Ruten tager løberne hen over broen med udsigt over sundet, og arrangørerne melder alt udsolgt to måneder før tid.",
      sectionSlug: "motion-og-loeb",
      areaSlug: "korsoer",
      authorId: "author-mette",
      mediaId: "media-sport",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 4,
    },
    {
      slug: "skaelskoer-roklub-henter-soelv-ved-nordiske-mesterskaber",
      titel: "Skælskør Amatør-Roklub henter sølvmedalje ved de nordiske mesterskaber",
      manchet: "Ungdomsdobbeltfireren roede sig ind på en flot andenplads på Bagsværd Sø efter en tæt dyst med finske roere.",
      sectionSlug: "anden-sport",
      areaSlug: "skaelskoer",
      authorId: "author-jonas",
      mediaId: "media-sport",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 8,
    },

    // --- KULTUR (4 undersektioner) ---
    {
      slug: "musikhuset-slagelse-praesenterer-stort-efteraarsprogram",
      titel: "Musikhuset Slagelse præsenterer efterårsprogram med internationale navne",
      manchet: "Fra symfonisk rock til intim jazz: over 40 koncerter er på plakaten i den kommende sæson på Vestsjællands hovedscene.",
      sectionSlug: "musik",
      areaSlug: "slagelse-by",
      authorId: "author-carsten",
      mediaId: "media-kultur",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 2,
    },
    {
      slug: "teater-paa-faestningen-i-korsoer-solgt-ud-til-sidste-plads",
      titel: "Friluftsspil på Korsør Fæstning melder alt udsolgt til samtlige opførelser",
      manchet: "Over 4.000 publikummer skal opleve Shakespeares 'En skærsommernatsdrøm' i de historiske rammer ved voldgraven.",
      sectionSlug: "scene-og-film",
      areaSlug: "korsoer",
      authorId: "author-mette",
      mediaId: "media-kultur",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 4,
    },
    {
      slug: "roedt-taarn-i-skaelskoer-aabner-ny-saerudstilling-med-keramik",
      titel: "Guldagergaard i Skælskør åbner særudstilling med 18 internationale keramikere",
      manchet: "Det internationale keramiske center viser værker skabt af kunstnere fra Japan, USA og Danmark under deres residency.",
      sectionSlug: "kunst-og-museer",
      areaSlug: "skaelskoer",
      authorId: "author-rikke",
      mediaId: "media-kultur",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 5,
    },
    {
      slug: "vestsjaellands-foedevaremarked-fylder-torvet-i-slagelse",
      titel: "Torvet dufter af æbler og vildsvin: Fødevaremarked fejrer lokale producenter",
      manchet: "Borgere i Slagelse strømmede til torvet lørdag formiddag for at smage cider, honning og friskbagt rugbrød.",
      sectionSlug: "mad-og-drikke",
      areaSlug: "slagelse-by",
      authorId: "author-mette",
      mediaId: "media-kultur",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 6,
    },

    // --- FORENINGSLIV (4 undersektioner) ---
    {
      slug: "frivillige-i-dalmose-renoverer-forsamlingshus-ved-faelles-hjaelp",
      titel: "Borgere i Dalmose løftede i flok: Forsamlingshuset har fået nyt tag og køkken",
      manchet: "Flere end 60 frivillige har brugt deres weekender på at sætte det 120 år gamle samlingssted i stand.",
      sectionSlug: "frivillige",
      areaSlug: "dalmose",
      authorId: "author-mette",
      mediaId: "media-forening",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 3,
    },
    {
      slug: "gymnastikforening-i-vemmelev-oplever-medlemsboom-blandt-unge",
      titel: "Vemmelev Gymnastikforening melder om ventelister på alle børne- og ungehold",
      manchet: "Succesen skyldes nyt fokus på parkour og springgymnastik, der tiltrækker børn fra både Korsør og Slagelse.",
      sectionSlug: "idraetsforeninger",
      areaSlug: "vemmelev",
      authorId: "author-jonas",
      mediaId: "media-forening",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 5,
    },
    {
      slug: "skaelskoer-bymuseum-forening-fejrer-50-aars-jubilaeum",
      titel: "Foreningen bag Skælskør Bymuseum fejrer 50 år som byens historiske vogtere",
      manchet: "En ny jubilæumsbog kortlægger byens maritime historie og de frivilliges utrættelige arbejde siden 1976.",
      sectionSlug: "kulturforeninger",
      areaSlug: "skaelskoer",
      authorId: "author-carsten",
      mediaId: "media-forening",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 7,
    },
    {
      slug: "lokalraad-paa-agersoe-vil-udvikle-helhedsplan-for-oeen",
      titel: "Lokalrådet på Agersø inviterer øboerne til borgermøde om fremtidens færgefart",
      manchet: "En ny helhedsplan skal sikre flere fastboende børnefamilier og bedre forbindelser til fastlandet.",
      sectionSlug: "lokalraad",
      areaSlug: "agersoe",
      authorId: "author-rikke",
      mediaId: "media-forening",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 9,
    },

    // --- DEBAT (3 undersektioner, Debat-visning) ---
    {
      slug: "leder-vi-har-brug-for-en-mere-aaben-kultur-paa-raadhuset",
      titel: "Vi har brug for en mere åben debat om kommunens budgetprioriteter",
      manchet: "Når millioner flyttes mellem velfærd og anlæg, fortjener borgerne klar besked i tide, ikke lukkede forhandlinger bag rådhusets mure.",
      sectionSlug: "leder",
      areaSlug: "slagelse-by",
      authorId: "author-carsten",
      mediaId: "media-debat",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      debatLabel: "Leder",
      daysAgo: 1,
    },
    {
      slug: "kommentar-hvorfor-skal-det-tage-fire-aar-at-reparere-en-cykelsti",
      titel: "Hvorfor skal det tage fire år at reparere 800 meter cykelsti i Korsør?",
      manchet: "Trafiksikkerheden for vores skolebørn på Tårnborgvej er blevet en bureaukratisk kastebold mellem kommune og entreprenører.",
      sectionSlug: "kommentarer",
      areaSlug: "korsoer",
      authorId: "author-jonas",
      mediaId: "media-debat",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      debatLabel: "Kommentar",
      daysAgo: 3,
    },
    {
      slug: "laeserbrev-bevar-faergeafgangene-til-omoe-og-agersoe",
      titel: "Læserbrev: Beskæring af færgeafgange vil kvæle livet på vores småøer",
      manchet: "Hvis den sene færge aflyses, kan gymnasieelever og pendlere ikke bo på øerne. Kommunalbestyrelsen må tage ansvar.",
      sectionSlug: "laeserbreve",
      areaSlug: "omoe",
      authorId: "author-mette",
      mediaId: "media-debat",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      debatLabel: "Læserbrev",
      daysAgo: 5,
    },

    // --- PARTNER-INDHOLD (Mærkning: Partner) ---
    {
      slug: "lokal-bank-stoetter-fem-nye-ungdomsinitiativer-i-slagelse",
      titel: "Sparekassen Sjælland-Fyn uddeler 250.000 kroner til lokale ungeprojekter",
      manchet: "Blandt modtagerne er et makerspace for teenagere og en skaterbane i Slagelse Syd.",
      sectionSlug: "handel",
      areaSlug: "slagelse-by",
      authorId: "author-rikke",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "Partner",
      marking: {
        sponsor: "Sparekassen Sjælland-Fyn",
        labelTekst: "Finansieret af Sparekassen Sjælland-Fyn",
        aftaleId: "sa-sparekassen",
      },
      daysAgo: 2,
    },
    {
      slug: "groenne-erhvervslaan-hjaelper-smaavirksomheder-paa-vestsjaelland",
      titel: "Nye lånepakker skal sætte fart på grøn omstilling i lokale håndværksfirmaer",
      manchet: "Et nyt partnerskab tilbyder rådgivning og finansiering til varmepumper og solceller på firmadomiciler.",
      sectionSlug: "byggeri-og-ejendomme",
      areaSlug: "korsoer",
      authorId: "author-carsten",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "Partner",
      marking: {
        sponsor: "Sparekassen Sjælland-Fyn",
        labelTekst: "Finansieret af Sparekassen Sjælland-Fyn",
        aftaleId: "sa-sparekassen",
      },
      daysAgo: 6,
    },
    {
      slug: "stoette-til-lokale-idraetsforeninger-sikrer-nyt-traeningsudstyr",
      titel: "Foreningspulje deler ud: Nyt udstyr til badminton og bordtennis i Vemmelev",
      manchet: "Med støtte fra lokal sparekasse kan idrætsforeningen købe nye net og bolde til over 120 aktive spillere.",
      sectionSlug: "idraetsforeninger",
      areaSlug: "vemmelev",
      authorId: "author-mette",
      mediaId: "media-forening",
      pinned: false,
      breaking: false,
      indholdstype: "Partner",
      marking: {
        sponsor: "Sparekassen Sjælland-Fyn",
        labelTekst: "Finansieret af Sparekassen Sjælland-Fyn",
        aftaleId: "sa-sparekassen",
      },
      daysAgo: 8,
    },

    // --- SPONSORERET / ANNONCE (Mærkning: Sponsoreret) ---
    {
      slug: "vestsjaellands-bilcenter-udvider-med-nyt-elbilvaerksted",
      titel: "Vestsjællands Bilcenter åbner topmoderne lade- og servicecenter for elbiler",
      manchet: "Det nye anlæg på Trafikcenter Allé kan servicere op til otte elbiler samtidigt med certificerede teknikere.",
      sectionSlug: "handel",
      areaSlug: "slagelse-by",
      authorId: "author-jonas",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "Sponsoreret",
      marking: {
        sponsor: "Vestsjællands Bilcenter",
        labelTekst: "ANNONCE",
      },
      daysAgo: 1,
    },
    {
      slug: "foraarstjek-af-bilen-her-er-de-tre-vigtigste-raad-til-bilisterne",
      titel: "Forårstjek af bilen: Her er mekanikerens råd efter en hård vinter med salt",
      manchet: "Undervogn, dæktryk og bremser bør gennemgås grundigt, før sommerturen går mod syd.",
      sectionSlug: "trafik",
      areaSlug: "slagelse-by",
      authorId: "author-jonas",
      mediaId: "media-trafik",
      pinned: false,
      breaking: false,
      indholdstype: "Sponsoreret",
      marking: {
        sponsor: "Vestsjællands Bilcenter",
        labelTekst: "ANNONCE",
      },
      daysAgo: 4,
    },
    {
      slug: "erhvervsleasing-af-varevogne-hitter-blandt-vestsjaellandske-haandvaerkere",
      titel: "Erhvervsleasing af el-varevogne oplever markant stigning i Slagelse Kommune",
      manchet: "Lave driftsomkostninger og afgiftsfordele får lokale virksomheder til at skifte flåden ud.",
      sectionSlug: "byggeri-og-ejendomme",
      areaSlug: "slagelse-by",
      authorId: "author-jonas",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "Sponsoreret",
      marking: {
        sponsor: "Vestsjællands Bilcenter",
        labelTekst: "ANNONCE",
      },
      daysAgo: 9,
    },

    // --- BRUGERINDSENDT (Mærkning: Brugerindsendt) ---
    {
      slug: "loebeklub-i-korsoer-inviterer-til-gratis-begyndertraening",
      titel: "Korsør Løbeklub inviterer til gratis løbeskole for nybegyndere",
      manchet: "Har du lyst til at komme i gang med at løbe 5 kilometer? Tirsdag aften starter klubben et nyt hold.",
      sectionSlug: "motion-og-loeb",
      areaSlug: "korsoer",
      authorId: "author-mette",
      mediaId: "media-sport",
      pinned: false,
      breaking: false,
      indholdstype: "Brugerindsendt",
      marking: {
        afsender: "Korsør Løbeklub v/ Jens Hansen",
      },
      daysAgo: 2,
    },
    {
      slug: "havevandring-og-planteskift-i-boeslunde-forsamlingshave",
      titel: "Borgere i Boeslunde bytter stauder og frø til forårets store havedag",
      manchet: "Tag dine overskydende planter med og få inspiration til insektvenlige haver søndag formiddag.",
      sectionSlug: "frivillige",
      areaSlug: "boeslunde",
      authorId: "author-mette",
      mediaId: "media-natur",
      pinned: false,
      breaking: false,
      indholdstype: "Brugerindsendt",
      marking: {
        afsender: "Boeslunde Havegruppe",
      },
      daysAgo: 5,
    },
    {
      slug: "skaelskoer-amatorteater-efterlyser-skuespillere-til-aarets-julespil",
      titel: "Skælskør Amatørteater efterlyser modige voksne og børn til juleforestilling",
      manchet: "Der er audition i Teatersalen den første tirsdag i næste måned for alle interesserede.",
      sectionSlug: "scene-og-film",
      areaSlug: "skaelskoer",
      authorId: "author-jonas",
      mediaId: "media-kultur",
      pinned: false,
      breaking: false,
      indholdstype: "Brugerindsendt",
      marking: {
        afsender: "Skælskør Amatørteater v/ Helle Berg",
      },
      daysAgo: 8,
    },

    // --- AI-ASSISTERET (Mærkning: AI-assisteret, med kilder & verificerede citater) ---
    {
      slug: "overblik-det-besluttede-byraadet-paa-aftenens-moede",
      titel: "Dagens overblik: Det besluttede Slagelse Byråd på mandagens ordinære møde",
      manchet: "Kort gennemgang af mødets 14 punkter fra lokalplaner i Korsør til anlægsbevilling til cykelsti ved Vemmelev.",
      sectionSlug: "politik",
      areaSlug: "slagelse-by",
      authorId: "author-carsten",
      mediaId: "media-byraad",
      pinned: false,
      breaking: false,
      indholdstype: "AI-assisteret",
      marking: {
        godkendtAf: "Carsten Lysdal",
        kilder: [
          "https://slagelse.dk/politik/dagsordener-og-referater/byraad/2026-09-28",
          "Referat godkendt af Slagelse Byrådssekretariat 29. september 2026",
        ],
      },
      hasQuoteWithSource: true,
      daysAgo: 0,
      hoursAgo: 6,
    },
    {
      slug: "døgnrapport-overblik-over-nattens-haendelser-i-sydvestsjaelland",
      titel: "Døgnrapporten: Nattens meldinger fra Midt- og Vestsjællands Politi",
      manchet: "En rolig nat i politikredsen med få henvendelser om musik og et enkelt færdselsuheld uden personskade på Vestmotorvejen.",
      sectionSlug: "trafik",
      areaSlug: "slagelse-by",
      authorId: "author-rikke",
      mediaId: "media-trafik",
      pinned: false,
      breaking: false,
      indholdstype: "AI-assisteret",
      marking: {
        godkendtAf: "Rikke Møller",
        kilder: [
          "https://politi.dk/midt-og-vestsjaellands-politi/doegnrapporter/2026-09-29",
          "Pressevagten, Midt- og Vestsjællands Politi",
        ],
      },
      hasQuoteWithSource: true,
      daysAgo: 0,
      hoursAgo: 10,
    },
    {
      slug: "offentlige-udbud-disse-opgaver-sender-kommunen-i-hoering",
      titel: "Kommende udbud: Kommunen søger entreprenører til renovering af idrætshaller",
      manchet: "Slagelse Kommune udbyder ventilationsarbejde og gulvlægning for anslået 8,4 millioner kroner.",
      sectionSlug: "job-og-arbejdsmarked",
      areaSlug: "slagelse-by",
      authorId: "author-rikke",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "AI-assisteret",
      marking: {
        godkendtAf: "Rikke Møller",
        kilder: [
          "https://udbud.dk/bekendtgoerelser/2026-slagelse-idraet-09",
          "Slagelse Ejendomscenter Udbudskontor",
        ],
      },
      hasQuoteWithSource: false,
      daysAgo: 3,
    },
    {
      slug: "vejret-i-weekend-masser-af-sol-og-svag-vind-over-storebaelt",
      titel: "Weekendvejret: Højt tryk giver flot sensommervejr og svag vind over Storebælt",
      manchet: "DMI varsler op til 20 grader og masser af solskinstimer over Vestsjælland både lørdag og søndag.",
      sectionSlug: "natur-og-klima",
      areaSlug: "korsoer",
      authorId: "author-jonas",
      mediaId: "media-natur",
      pinned: false,
      breaking: false,
      indholdstype: "AI-assisteret",
      marking: {
        godkendtAf: "Jonas Vestergaard",
        kilder: [
          "https://dmi.dk/danmark/vestsjaelland-regionaludsigt-2026",
          "DMI Regional vejrudsigt for Storebælt",
        ],
      },
      hasQuoteWithSource: false,
      daysAgo: 4,
    },

    // --- PRESSEMEDDELELSER (Mærkning: PR) ---
    {
      slug: "slagelse-erhvervsraad-udpeger-aarets-erhvervsleder",
      titel: "Pressemeddelelse: Indstilling åbnet til Årets Erhvervsleder 2026 i Slagelse",
      manchet: "Slagelse Erhvervsråd søger kandidater blandt ledere, der har skabt vækst, innovation og lokale arbejdspladser.",
      sectionSlug: "handel",
      areaSlug: "slagelse-by",
      authorId: "author-rikke",
      mediaId: "media-erhverv",
      pinned: false,
      breaking: false,
      indholdstype: "PR",
      marking: {
        afsender: "Slagelse Erhvervsråd",
      },
      daysAgo: 2,
    },
    {
      slug: "region-sjaelland-indkalder-til-borgermoede-om-fremtidens-sygehuse",
      titel: "Pressemeddelelse: Region Sjælland inviterer til borgermøde om Slagelse Sygehus",
      manchet: "Borgere kan stille spørgsmål til regionsrådspolitikere om nye sengeafsnit og akutmodtagelsens kapacitet.",
      sectionSlug: "politik",
      areaSlug: "slagelse-by",
      authorId: "author-carsten",
      mediaId: "media-byraad",
      pinned: false,
      breaking: false,
      indholdstype: "PR",
      marking: {
        afsender: "Region Sjælland Presseenhed",
      },
      daysAgo: 6,
    },
    {
      slug: "teaterforening-modtager-realdania-stoette-til-renovering",
      titel: "Pressemeddelelse: Korsør Teaterforening tildeles 800.000 kr. fra Realdania",
      manchet: "Midlerne skal anvendes til restaurering af den historiske balkon og moderne lydisolering.",
      sectionSlug: "scene-og-film",
      areaSlug: "korsoer",
      authorId: "author-jonas",
      mediaId: "media-kultur",
      pinned: false,
      breaking: false,
      indholdstype: "PR",
      marking: {
        afsender: "Korsør Teaterforenings bestyrelse",
      },
      daysAgo: 10,
    },

    // --- YDERLIGERE LOKALE ARTIKLER PÅ TVÆRS AF SMÅØER OG LANDOMRÅDER ---
    {
      slug: "omoe-faergen-faar-ny-el-motor-i-2027",
      titel: "Omø-færgen ombygges med grøn batteridrift: Skærer 80 procent af udledningen",
      manchet: "Kommunen har modtaget statstilskud til at udskifte færgedriften med elektrisk fremdrift inden for to år.",
      sectionSlug: "natur-og-klima",
      areaSlug: "omoe",
      authorId: "author-carsten",
      mediaId: "media-havn",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 7,
    },
    {
      slug: "agersoe-moelle-faar-nye-vinger-efter-fem-aars-stilstand",
      titel: "Historisk milepæl: Agersø Mølle drejer igen efter opsætning af nye egetræsvinger",
      manchet: "Det traditionsrige håndværk trak tilskuere til fra nær og fjern, da kranen løftede de ti meter lange vinger på plads.",
      sectionSlug: "kulturforeninger",
      areaSlug: "agersoe",
      authorId: "author-mette",
      mediaId: "media-kultur",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 11,
    },
    {
      slug: "boeslunde-faar-ny-lokalplan-for-solcellepark",
      titel: "Byrådet vedtager lokalplan for solcelleanlæg ved Boeslunde med levende hegn",
      manchet: "Efter borgermøde er projektet tilpasset med 50 meter grøn afskærmning mod nærmeste naboer.",
      sectionSlug: "natur-og-klima",
      areaSlug: "boeslunde",
      authorId: "author-rikke",
      mediaId: "media-natur",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 12,
    },
    {
      slug: "ny-cykelsti-mellem-dalmose-og-slagelse-aabner-til-foraar",
      titel: "Første spadestik taget til 7 kilometer ny asfalteret cykelsti til Dalmose",
      manchet: "Projektet gør skolevejen markant mere sikker for børn og unge i det sydlige opland.",
      sectionSlug: "trafik",
      areaSlug: "dalmose",
      authorId: "author-jonas",
      mediaId: "media-trafik",
      pinned: false,
      breaking: false,
      indholdstype: "Uafhængig",
      daysAgo: 13,
    },
  ];

  for (const art of articlesSeed) {
    const categoryId = categoryMap.get(art.sectionSlug) ?? categoryMap.get("nyheder")!;
    const geoTagId = areaMap.get(art.areaSlug);
    const authorId = authorMap.get(art.authorId) ?? authorMap.get("author-carsten")!;
    const coverMediaId = mediaMap.get(art.mediaId);

    const now = new Date();
    const pubDate = new Date(now.getTime() - (art.daysAgo * 86400000 + (art.hoursAgo || 0) * 3600000));

    const blocks: unknown[] = [
      { id: "b1", type: "manchet", data: { text: art.manchet } },
      {
        id: "b2",
        type: "paragraph",
        data: {
          content: `<p>${art.manchet} Dette er en vigtig udvikling for borgerne i ${areas.find((a) => a.slug === art.areaSlug)?.navn ?? "området"}. Lokalsamfundet følger sagen tæt, og der forventes yderligere tiltag i den kommende tid.</p>`,
        },
      },
      { id: "b3", type: "heading", data: { text: "Baggrund og perspektiver", level: 2 } },
      {
        id: "b4",
        type: "paragraph",
        data: {
          content: `<p>Flere lokale aktører har udtalt sig positivt om initiativet. Redaktionen har talt med berørte parter, der understreger betydningen af gennemskuelighed og lokal forankring.</p>`,
        },
      },
    ];

    if (art.hasQuoteWithSource) {
      blocks.push({
        id: "b5",
        type: "quote",
        data: {
          quote: "Vi har arbejdet målrettet på at finde en balanceret løsning for hele kommunen.",
          attribution: "Kommunal talsmand",
          kildeUrl: "https://slagelse.dk/presse/udtalelser-2026",
          dato: "2026-09-29",
        },
      });
    }

    blocks.push({
      id: "b6",
      type: "paragraph",
      data: {
        content: `<p>Vi følger op på sagen, efterhånden som der fremkommer nyt materiale og beslutninger fra de involverede udvalg.</p>`,
      },
    });

    await db.article.upsert({
      where: { slug: art.slug },
      update: {
        titel: art.titel,
        manchet: art.manchet,
        blocks: blocks as Prisma.InputJsonValue,
        status: "Publiceret",
        indholdstype: art.indholdstype,
        marking: art.marking ? (art.marking as Prisma.InputJsonValue) : Prisma.JsonNull,
        pinned: art.pinned,
        breaking: art.breaking,
        publiceretTid: pubDate,
        kategoriId: categoryId,
        forfatterId: authorId,
        coverMediaId: coverMediaId,
        instansId: instance.id,
        geoTags: geoTagId ? { set: [{ id: geoTagId }] } : undefined,
      },
      create: {
        titel: art.titel,
        slug: art.slug,
        manchet: art.manchet,
        blocks: blocks as Prisma.InputJsonValue,
        status: "Publiceret",
        indholdstype: art.indholdstype,
        aiBrug: art.indholdstype === "AI-assisteret" ? ["Udkast", "Sproglig korrektur"] : ["Ingen"],
        marking: art.marking ? (art.marking as Prisma.InputJsonValue) : Prisma.JsonNull,
        pinned: art.pinned,
        breaking: art.breaking,
        publiceretTid: pubDate,
        kategoriId: categoryId,
        forfatterId: authorId,
        coverMediaId: coverMediaId,
        instansId: instance.id,
        geoTags: geoTagId ? { connect: [{ id: geoTagId }] } : undefined,
      },
    });
  }

  console.log(`Seed: ${articlesSeed.length} artikler oprettet på SlagelseLokalt`);

  // ── Seed ArticleMetric for alle artikler ────────────────────────────────
  const allArticles = await db.article.findMany({ where: { instansId: instance.id } });
  for (const art of allArticles) {
    const isBreakingOrPinned = art.breaking || art.pinned;
    const baseViews = isBreakingOrPinned ? 2400 + Math.floor(Math.random() * 1200) : 150 + Math.floor(Math.random() * 800);
    const readRate = 0.55 + Math.random() * 0.3; // 55% - 85%
    const readings = Math.round(baseViews * readRate);
    const avgSeconds = 50 + Math.floor(Math.random() * 70); // 50-120 sek
    const totalTime = readings * avgSeconds;

    // Generer 24-timers trend (højere midt på dagen)
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const multiplier = (h >= 7 && h <= 22) ? 1.5 : 0.2;
      return Math.round((baseViews / 35) * multiplier * (0.8 + Math.random() * 0.4));
    });

    // Beregn en realistisk fordelingsscore: (læsninger/visninger * 50) + (views / 50)
    const engagementRatio = readings / Math.max(1, baseViews);
    const dynamicScore = parseFloat((engagementRatio * 50 + (baseViews / 100) + (isBreakingOrPinned ? 40 : 0)).toFixed(1));

    await db.articleMetric.upsert({
      where: { articleId: art.id },
      update: {
        visninger: baseViews,
        laesninger: readings,
        totalLaesetidSek: totalTime,
        score: dynamicScore,
        hourlyViews: hourly,
      },
      create: {
        articleId: art.id,
        instansId: instance.id,
        visninger: baseViews,
        laesninger: readings,
        totalLaesetidSek: totalTime,
        score: dynamicScore,
        hourlyViews: hourly,
      },
    });
  }
  console.log(`Seed: ArticleMetric oprettet for ${allArticles.length} artikler`);

  // ── Seed Demo Ad Campaigns ──────────────────────────────────────────────
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const demoCampaigns = [
    {
      titel: "Harboe Fonden - Støtte til lokalsport",
      annoncoer: "Harboe Bryggeri A/S",
      format: "IN_FEED_BANNER",
      status: "Aktiv",
      startDato: now,
      slutDato: nextMonth,
      pris: 3500,
      placeringZone: "feed",
      visninger: 1420,
      klik: 86,
      maksVisninger: 10000,
      kreativData: {
        overskrift: "Støtter det lokale foreningsliv i Skælskør & Slagelse",
        manchet: "Søg Harboe Fonden til jeres næste klubprojekt eller idrætsfacilitet i kommunen.",
        ctaTekst: "Ansøg fonden nu",
        linkUrl: "https://harboe.com/fond",
        badgeTekst: "ANNONCE",
        farve: "#FCE8A6",
      },
    },
    {
      titel: "Slagelse Vinfestival 2026",
      annoncoer: "Slagelse Vin & Madkultur",
      format: "EVENT_POST",
      status: "Aktiv",
      startDato: now,
      slutDato: nextMonth,
      pris: 499,
      placeringZone: "kalender",
      visninger: 890,
      klik: 112,
      maksVisninger: 5000,
      kreativData: {
        overskrift: "Smag på over 120 vine på Schweizerpladsen",
        manchet: "Lørdag den 12. oktober. Billet inkluderer smageglas og adgang til alle stande.",
        ctaTekst: "Køb forsalgsbillet",
        linkUrl: "https://slagelse-vin.dk",
        badgeTekst: "ANNONCE",
      },
    },
    {
      titel: "Munkholm Erhvervspark - Iværksætterhub",
      annoncoer: "Munkholm Erhvervspark A/S",
      format: "NATIVE_PREMIUM",
      status: "Aktiv",
      startDato: now,
      slutDato: nextMonth,
      pris: 14500,
      placeringZone: "top",
      visninger: 3240,
      klik: 245,
      maksVisninger: 25000,
      kreativData: {
        overskrift: "Nyt kontor- og værkstedsfællesskab åbner i Slagelse Nord",
        manchet: "Fleksible lejemål fra 35 m² til håndværkere, kreative og videnstunge virksomheder.",
        ctaTekst: "Læs om faciliteterne",
        linkUrl: "https://munkholm-erhverv.dk",
        badgeTekst: "ANNONCE",
      },
    },
  ];

  for (const camp of demoCampaigns) {
    const existing = await db.adCampaign.findFirst({
      where: { instansId: instance.id, titel: camp.titel },
    });
    if (!existing) {
      await db.adCampaign.create({
        data: {
          ...camp,
          instansId: instance.id,
        },
      });
    }
  }
  console.log(`Seed: Demo Ad Campaigns oprettet`);

  // --- DEMO SUBMISSIONS (CMS-07, P-15, A-07) ---
  const korsoerGeo = await db.geoTag.findFirst({ where: { instansId: instance.id, slug: "korsoer" } });
  const antvorskovGeo = await db.geoTag.findFirst({ where: { instansId: instance.id, slug: "antvorskov" } });
  const skaelskoerGeo = await db.geoTag.findFirst({ where: { instansId: instance.id, slug: "skaelskoer" } });

  const demoSubmissions = [
    {
      navn: "Mette Frederiksen",
      kontakt: "mette.korsoer@gmail.com",
      emne: "Huller i cykelstien ved Halsskov Odde gør turen farlig for skolebørn",
      tekst: "Jeg vil gerne gøre opmærksom på, at den asfalterede cykelsti langs Halsskov Odde er fuldstændig gennembrudt af trærødder og dybe frostsprækker. Flere skoleelever fra Broskolen har været tæt på at vælte i mørket om morgenen. Kommunen har lovet udbedring i to år, men intet sker.",
      omraadeId: korsoerGeo?.id,
      billederUrl: ["https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&auto=format&fit=crop&q=80"],
      rettighederAccepteret: true,
      samtykkeAccepteret: true,
      status: "Ny",
    },
    {
      navn: "Jens Peter Hansen",
      kontakt: "jph@antvorskov-nabo.dk / 21334455",
      emne: "Lokalhistorisk vandring ved Antvorskov Ruiner på søndag",
      tekst: "Vi i den lokale beboergruppe arrangerer en gratis guidet tur søndag kl. 14 for alle historisk interesserede i Slagelse. Vi fortæller om Johanitterordenens kloster, Frederik 2.'s slot og områdets arkæologiske fund. Kaffe og kage kan købes til støtte for ruingruppens formidlingstavler.",
      omraadeId: antvorskovGeo?.id,
      billederUrl: [],
      rettighederAccepteret: true,
      samtykkeAccepteret: true,
      status: "Behandles",
      noter: "God idé til kulturredaktionen - Jonas interviewer Jens Peter fredag.",
    },
    {
      navn: "Kirsten Lind",
      kontakt: "kirsten@skaelskor-roklub.dk",
      emne: "Skælskør Roklub fejrer 75 års jubilæum med åbent hus på havnen",
      tekst: "Lørdag inviterer Skælskør Roklub alle interesserede til gratis prøveture i inrigger og coastal kajak. Vi har haft fremgang i ungdomsafdelingen og vil gerne vise fællesskabet frem for hele byen.",
      omraadeId: skaelskoerGeo?.id,
      billederUrl: ["https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&auto=format&fit=crop&q=80"],
      rettighederAccepteret: true,
      samtykkeAccepteret: true,
      status: "Ny",
    },
  ];

  for (const sub of demoSubmissions) {
    const existing = await db.submission.findFirst({
      where: { instansId: instance.id, emne: sub.emne },
    });
    if (!existing) {
      await db.submission.create({
        data: {
          ...sub,
          instansId: instance.id,
        },
      });
    }
  }
  console.log(`Seed: Demo Submissions oprettet`);

  // --- DEMO NEWSLETTER SUBSCRIBERS (P-16, A-08) ---
  const demoSubscribers = [
    { email: "lars.nielsen@slagelse-post.dk", navn: "Lars Nielsen", omraadeSlug: "slagelse-by", aktiv: true },
    { email: "anne.mette@korsoer-net.dk", navn: "Anne-Mette Poulsen", sektionSlug: "kultur", omraadeSlug: "korsoer", aktiv: true },
    { email: "morten.k@firma-slagelse.dk", navn: "Morten Kristensen", sektionSlug: "erhverv", aktiv: true },
    { email: "sofie.pedersen@outlook.dk", navn: "Sofie Pedersen", omraadeSlug: "skaelskoer", aktiv: true },
    { email: "henrik.gamle@gmail.com", navn: "Henrik Gamle", omraadeSlug: "slagelse-by", aktiv: false, afmeldtTid: new Date() },
  ];

  for (const sub of demoSubscribers) {
    const existing = await db.newsletterSubscriber.findFirst({
      where: { instansId: instance.id, email: sub.email },
    });
    if (!existing) {
      await db.newsletterSubscriber.create({
        data: {
          ...sub,
          instansId: instance.id,
          bekraeftetTid: sub.aktiv ? new Date() : null,
        },
      });
    }
  }
  console.log(`Seed: Demo Newsletter Subscribers oprettet`);

  // --- SEED NETWORK SITES (Næstved, Holbæk, Ringsted, Køge, Roskilde) ---
  await seedNetworkSites(roleMap, mediaMap, passwordHash, rates, categoryTree);
}

async function seedNetworkSites(
  roleMap: Map<string, string>,
  mediaMap: Map<string, string>,
  passwordHash: string,
  rates: readonly (readonly [string, number, number, number])[],
  categoryTree: Array<{
    navn: string;
    slug: string;
    beskrivelse: string;
    sortering: number;
    children: Array<{ navn: string; slug: string; sortering: number }>;
  }>
) {
  console.log(`Seed: Påbegynder seeding af ${NETWORK_SITES.length} øvrige netværkssites...`);

  for (const siteCfg of NETWORK_SITES) {
    const siteInstance = await db.instance.upsert({
      where: { id: siteCfg.id },
      update: {
        navn: siteCfg.navn,
        domaene: siteCfg.domaene,
        farver: siteCfg.colors,
        typografi: { heading: "Bricolage Grotesque", body: "Literata" },
        geografiskDækning: siteCfg.areas.map((a) => a.navn),
        kategoriTaksonomi: categoryTree.map((c) => c.navn),
        kvoteloftProcent: 25,
        markingTekster: {
          sponsorLabel: "Sponsoreret indhold",
          partnerLabel: "Finansieret af",
          principperUrl: "/om-mediet/redaktionelle-principper",
        },
        sideTekster: siteCfg.sideTekster,
        netvaerk: ALL_NETWORK_SITES_INFO.filter((s) => s.domaene !== siteCfg.domaene),
      },
      create: {
        id: siteCfg.id,
        navn: siteCfg.navn,
        domaene: siteCfg.domaene,
        farver: siteCfg.colors,
        typografi: { heading: "Bricolage Grotesque", body: "Literata" },
        geografiskDækning: siteCfg.areas.map((a) => a.navn),
        kategoriTaksonomi: categoryTree.map((c) => c.navn),
        kvoteloftProcent: 25,
        markingTekster: {
          sponsorLabel: "Sponsoreret indhold",
          partnerLabel: "Finansieret af",
          principperUrl: "/om-mediet/redaktionelle-principper",
        },
        sideTekster: siteCfg.sideTekster,
        netvaerk: ALL_NETWORK_SITES_INFO.filter((s) => s.domaene !== siteCfg.domaene),
      },
    });

    // Kategoritræ
    const siteCategoryMap = new Map<string, string>();
    for (const parent of categoryTree) {
      const p = await db.category.upsert({
        where: { instansId_slug: { instansId: siteInstance.id, slug: parent.slug } },
        update: { navn: parent.navn, beskrivelse: parent.beskrivelse, sortering: parent.sortering, parentId: null },
        create: { navn: parent.navn, slug: parent.slug, beskrivelse: parent.beskrivelse, sortering: parent.sortering, instansId: siteInstance.id },
      });
      siteCategoryMap.set(parent.slug, p.id);

      for (const child of parent.children) {
        const c = await db.category.upsert({
          where: { instansId_slug: { instansId: siteInstance.id, slug: child.slug } },
          update: { navn: child.navn, sortering: child.sortering, parentId: p.id },
          create: { navn: child.navn, slug: child.slug, sortering: child.sortering, parentId: p.id, instansId: siteInstance.id },
        });
        siteCategoryMap.set(child.slug, c.id);
      }
    }

    // Områder (GeoTags)
    const siteAreaMap = new Map<string, string>();
    for (const area of siteCfg.areas) {
      const g = await db.geoTag.upsert({
        where: { instansId_slug: { instansId: siteInstance.id, slug: area.slug } },
        update: { navn: area.navn, lat: area.lat, lng: area.lng },
        create: { navn: area.navn, slug: area.slug, lat: area.lat, lng: area.lng, instansId: siteInstance.id },
      });
      siteAreaMap.set(area.slug, g.id);
    }

    // Tags
    const defaultTags = ["Kommunalpolitik", "Handelsliv", "Børnefamilier", "Bæredygtighed", "Frivillighed", "Kulturarv", "Lokalsport", "Klima", "Erhverv"];
    for (const navn of defaultTags) {
      const slug = navn.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa");
      await db.tag.upsert({
        where: { instansId_navn: { instansId: siteInstance.id, navn } },
        update: { slug },
        create: { navn, slug, instansId: siteInstance.id },
      });
    }

    // Forfattere og brugere
    const siteAuthorMap = new Map<string, string>();
    for (const author of siteCfg.authors) {
      const a = await db.author.upsert({
        where: { id: author.id },
        update: { navn: author.navn, slug: author.slug, forfatterType: author.type, bio: author.bio, profilbilledeUrl: author.avatar, instansId: siteInstance.id },
        create: { id: author.id, navn: author.navn, slug: author.slug, forfatterType: author.type, bio: author.bio, profilbilledeUrl: author.avatar, instansId: siteInstance.id },
      });
      siteAuthorMap.set(author.id, a.id);

      const roleName = author.type === "Fast" ? "Ansvarshavende redaktør" : "Freelancejournalist";
      const rId = roleMap.get(roleName) || roleMap.get("Ansvarshavende redaktør")!;
      await db.user.upsert({
        where: { email: author.email },
        update: { passwordHash, roleId: rId, authorId: a.id, instansId: siteInstance.id },
        create: { email: author.email, navn: author.navn, passwordHash, roleId: rId, authorId: a.id, instansId: siteInstance.id },
      });
    }

    // Takster for opgaver
    for (const [leverancetype, minimum, maksimum, standard] of rates) {
      await db.honorRate.upsert({
        where: { instansId_leverancetype: { instansId: siteInstance.id, leverancetype } },
        update: { minimum, maksimum, standard, aktiv: true },
        create: { leverancetype, minimum, maksimum, standard, instansId: siteInstance.id },
      });
    }

    // Støtteaftaler & Organisationer
    for (const org of siteCfg.organizations) {
      const o = await db.organization.upsert({
        where: { id: org.id },
        update: { navn: org.navn, branche: org.branche, kontakt: org.kontakt, instansId: siteInstance.id },
        create: { id: org.id, navn: org.navn, branche: org.branche, kontakt: org.kontakt, instansId: siteInstance.id },
      });

      await db.supportAgreement.upsert({
        where: { id: org.aftaleId },
        update: {
          organisationNavn: org.navn,
          pakkeNiveau: "Fællesskab",
          pris: org.aftalePris,
          instansId: siteInstance.id,
          organizationId: o.id,
        },
        create: {
          id: org.aftaleId,
          organisationNavn: org.navn,
          pakkeNiveau: "Fællesskab",
          startDato: new Date("2026-01-01"),
          arligKvote: 10,
          forbrugtKvote: 2,
          kontaktperson: org.kontakt,
          pris: org.aftalePris,
          organizationId: o.id,
          instansId: siteInstance.id,
        },
      });
    }

    // Artikler og metrikker
    for (const art of siteCfg.articles) {
      const pubDate = new Date(Date.now() - art.daysAgo * 86400000 - (art.hoursAgo || 0) * 3600000);
      const categoryId = siteCategoryMap.get(art.sectionSlug) || siteCategoryMap.get("nyheder");
      const authorCfg = siteCfg.authors[art.authorIndex] || siteCfg.authors[0];
      const authorId = siteAuthorMap.get(authorCfg.id);
      const geoTagId = siteAreaMap.get(art.areaSlug);
      const coverMediaId = mediaMap.get(art.mediaId) || mediaMap.get("media-byraad");

      const blocks: Array<Record<string, unknown>> = [
        { id: "b1", type: "paragraph", data: { content: `<p><strong>${siteCfg.kommune}:</strong> ${art.manchet}</p>` } },
        { id: "b2", type: "paragraph", data: { content: `<p>Sagen har vakt stor interesse i lokalsamfundet i ${siteCfg.kommune}, hvor både borgere, foreninger og lokale erhvervsdrivende følger udviklingen tæt.</p>` } },
        { id: "b3", type: "heading", data: { text: "Lokal betydning og baggrund", level: 2 } },
        { id: "b4", type: "paragraph", data: { content: `<p>Redaktionen på ${siteCfg.navn} har talt med kilder i ${art.areaSlug ? art.areaSlug.replace(/-/g, " ") : siteCfg.kommune}, som understreger, at initiativet kan få mærkbar betydning for områdets fremtid.</p>` } },
      ];

      if (art.hasQuoteWithSource) {
        blocks.push({
          id: "b5",
          type: "quote",
          data: {
            quote: "Vi arbejder hver dag for at skabe de bedste rammer for vores lokalsamfund og fællesskab.",
            attribution: `Lokal talsperson, ${siteCfg.kommune}`,
            kildeUrl: `https://${siteCfg.domaene}/presse`,
            dato: "2026-09-30",
          },
        });
      }

      blocks.push({
        id: "b6",
        type: "paragraph",
        data: { content: `<p>Vi følger sagen og opdaterer løbende med reaktioner og nye oplysninger på ${siteCfg.navn}.</p>` },
      });

      const savedArticle = await db.article.upsert({
        where: { slug: art.slug },
        update: {
          titel: art.titel,
          manchet: art.manchet,
          blocks: blocks as Prisma.InputJsonValue,
          status: "Publiceret",
          indholdstype: art.indholdstype,
          marking: art.marking ? (art.marking as Prisma.InputJsonValue) : Prisma.JsonNull,
          pinned: art.pinned || false,
          breaking: art.breaking || false,
          publiceretTid: pubDate,
          kategoriId: categoryId,
          forfatterId: authorId,
          coverMediaId: coverMediaId,
          instansId: siteInstance.id,
          geoTags: geoTagId ? { set: [{ id: geoTagId }] } : undefined,
        },
        create: {
          titel: art.titel,
          slug: art.slug,
          manchet: art.manchet,
          blocks: blocks as Prisma.InputJsonValue,
          status: "Publiceret",
          indholdstype: art.indholdstype,
          aiBrug: art.indholdstype === "AI-assisteret" ? ["Udkast", "Sproglig korrektur"] : ["Ingen"],
          marking: art.marking ? (art.marking as Prisma.InputJsonValue) : Prisma.JsonNull,
          pinned: art.pinned || false,
          breaking: art.breaking || false,
          publiceretTid: pubDate,
          kategoriId: categoryId,
          forfatterId: authorId,
          coverMediaId: coverMediaId,
          instansId: siteInstance.id,
          geoTags: geoTagId ? { connect: [{ id: geoTagId }] } : undefined,
        },
      });

      // ArticleMetric
      const isBreakingOrPinned = art.breaking || art.pinned;
      const baseViews = isBreakingOrPinned ? 2100 + Math.floor(Math.random() * 900) : 180 + Math.floor(Math.random() * 600);
      const readings = Math.round(baseViews * 0.65);
      const totalTime = readings * 75;
      const hourly = Array.from({ length: 24 }, (_, h) => Math.round((baseViews / 24) * ((h >= 7 && h <= 22) ? 1.4 : 0.3)));
      const dynamicScore = parseFloat(((readings / baseViews) * 50 + (baseViews / 100) + (isBreakingOrPinned ? 35 : 0)).toFixed(1));

      await db.articleMetric.upsert({
        where: { articleId: savedArticle.id },
        update: {
          visninger: baseViews,
          laesninger: readings,
          totalLaesetidSek: totalTime,
          score: dynamicScore,
          hourlyViews: hourly,
        },
        create: {
          articleId: savedArticle.id,
          instansId: siteInstance.id,
          visninger: baseViews,
          laesninger: readings,
          totalLaesetidSek: totalTime,
          score: dynamicScore,
          hourlyViews: hourly,
        },
      });
    }

    // Demo nyhedsbrevsabonnent
    const demoEmail = `borger@${siteCfg.domaene}`;
    const existingSub = await db.newsletterSubscriber.findFirst({
      where: { instansId: siteInstance.id, email: demoEmail },
    });
    if (!existingSub) {
      await db.newsletterSubscriber.create({
        data: {
          email: demoEmail,
          navn: `Lokal læser i ${siteCfg.kommune}`,
          omraadeSlug: siteCfg.areas[0]?.slug,
          aktiv: true,
          instansId: siteInstance.id,
          bekraeftetTid: new Date(),
        },
      });
    }

    console.log(`Seed: ${siteCfg.navn} oprettet med ${siteCfg.articles.length} artikler, ${siteCfg.areas.length} områder og forfattere`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
