import re
import json

with open('nyhedssite.html', 'r', encoding='utf-8') as f:
    existing_content = f.read()

# Extract all 8 image data URIs
img_keys = [
    'storebaelt_hero', 'slagelse_bymidte', 'skaelskoer_sommerhus',
    'slagelse_erhverv', 'nabolag_kort', 'slagelse_fodbold',
    'tude_aa_natur', 'debat_skriver'
]

sl_images = {}
for k in img_keys:
    m = re.search(rf'--img-{k}:\s*url\(\"(data:image[^\"]+)\"\);', existing_content)
    if m:
        sl_images[k] = m.group(1)
    else:
        raise ValueError(f"Missing image {k}")

css_vars = "\n    ".join([f'--img-{k}: url("{v}");' for k, v in sl_images.items()])

cities_data = {
    "slagelse": {
        "navn": "SlagelseLokalt",
        "prefix": "Slagelse",
        "by": "Slagelse",
        "kommune": "Slagelse Kommune",
        "accent": "#007038",
        "accent_soft": "#EBF7EE",
        "tagline": "Lokaljournalistik, der sætter fællesskabet først",
        "omraader": ["Slagelse C", "Korsør", "Skælskør", "Dalmose", "Vemmelev"],
        "hero_kicker": "TRAFIK · STOREBÆLT",
        "hero_title": "Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld",
        "hero_manchet": "Et trafikuheld spærrer et spor på Storebæltsbroen. Bilister skal forvente længere rejsetid.",
        "hero_meta": "2 t. siden",
        "hero_img": "img-storebaelt",
        "wire": [
            ("08:12", "Nyt flertal på rådhuset vil investere 45 millioner i bymidten", "art-byraad"),
            ("07:48", "Dagens overblik: Det besluttede Slagelse Byråd", "art-byraad"),
            ("06:32", "Flere sommerhuse udsat for indbrud ved Skælskør Næs", "art-sommerhuse")
        ],
        "nabolag_text": "Slagelse C: 4 nye byggeprojekter godkendt i bymidten. Håndværkere er i gang ved Nytorv."
    },
    "naestved": {
        "navn": "NæstvedLokalt",
        "prefix": "Næstved",
        "by": "Næstved",
        "kommune": "Næstved Kommune",
        "accent": "#1F5663",
        "accent_soft": "#E8F2F4",
        "tagline": "Din lokale stemme i Næstved, Karrebæksminde og omegn",
        "omraader": ["Næstved By", "Karrebæksminde", "Fuglebjerg", "Holme-Olstrup", "Rønnebæk"],
        "hero_kicker": "HAVN & KLIMA · KARREBÆKSMINDE",
        "hero_title": "Ny havne- og klimapromenade godkendt: Forvandler Karrebæksminde",
        "hero_manchet": "En investering på 38 millioner kroner skal sikre havnen mod stormflod og skabe nyt maritimt samlingspunkt.",
        "hero_meta": "1 t. siden",
        "hero_img": "img-storebaelt",
        "wire": [
            ("08:30", "Grønnegades Kaserne Kulturcenter melder om rekordstort forårsprogram", "art-kultur"),
            ("07:55", "Næstved Byråd afsætter 25 millioner til nye cykelstier i oplandet", "art-byraad"),
            ("06:40", "Lokale fiskere i Karrebæksminde fejrer starten på forårssæsonen", "art-butik"),
            ("21:45", "Næstved Boldklub henter stærk sejr foran 1.400 tilskuere", "art-sport"),
            ("19:20", "Susåen sikres med nyt natur- og vådområde ved Herlufsholm", "art-tudeaa")
        ],
        "nabolag_text": "Næstved By: Omfattende renovering af gågadenettet ved Axeltorv starter i næste måned."
    },
    "holbaek": {
        "navn": "HolbækLokalt",
        "prefix": "Holbæk",
        "by": "Holbæk",
        "kommune": "Holbæk Kommune",
        "accent": "#4F5B1E",
        "accent_soft": "#F2F5E8",
        "tagline": "Lokaljournalistik fra Isefjorden til det åbne Vestsjælland",
        "omraader": ["Holbæk By", "Jyderup", "Tølløse", "Orø", "Vipperød"],
        "hero_kicker": "INFRASTRUKTUR · ORØ",
        "hero_title": "Ny grøn elfærge til Orø er sat i drift: Halverer rejsetiden over fjorden",
        "hero_manchet": "Den nye færgeforbindelse er officielt indviet med gratis overfart for alle øens beboere og pendlere.",
        "hero_meta": "3 t. siden",
        "hero_img": "img-storebaelt",
        "wire": [
            ("08:15", "Holbæk Havneby udvides med 80 nye bæredygtige boliger", "art-byraad"),
            ("07:30", "Jyderup Erhvervsforening lancerer nyt lærlinge-initiativ for unge", "art-butik"),
            ("06:50", "Isefjordens fuglereservater oplever markant fremgang i 2026", "art-tudeaa"),
            ("22:00", "Holbæk B&I rykker tættere på oprykning efter flot sejr", "art-sport"),
            ("20:10", "Kulturkasernen i Holbæk inviterer til gratis forårskoncerter", "art-kultur")
        ],
        "nabolag_text": "Holbæk By: Omlægning af havnefronten giver plads til nye caféer og rekreativt byliv."
    },
    "ringsted": {
        "navn": "RingstedLokalt",
        "prefix": "Ringsted",
        "by": "Ringsted",
        "kommune": "Ringsted Kommune",
        "accent": "#8A5A00",
        "accent_soft": "#FBF4E6",
        "tagline": "Nyheder fra hjertet af Sjælland — lokalt og tæt på dig",
        "omraader": ["Ringsted By", "Benløse", "Jystrup", "Kværkeby", "Vetterslev"],
        "hero_kicker": "ERHVERV & HANDEL · RINGSTED",
        "hero_title": "Ringsted Outlet og bymidten indgår unikt samarbejde med gratis busser",
        "hero_manchet": "Nyt fælles initiativ skal sikre, at de mange tusinde besøgende i outletbyen også finder vej til handelsgaderne.",
        "hero_meta": "2 t. siden",
        "hero_img": "img-erhverv",
        "wire": [
            ("08:40", "Ringsted Festival melder om tæt på udsolgt til jubilæumskoncert", "art-kultur"),
            ("08:05", "Ny cykelsti langs Kværkebyvej øger trafiksikkerheden for skolebørn", "art-byraad"),
            ("07:15", "Erhvervspark Ringsted Syd tiltrækker to nye højteknologiske firmaer", "art-butik"),
            ("21:30", "TMS Ringsted leverer kæmpe overraskelse i håndboldligaen", "art-sport"),
            ("18:50", "Oplevelsesstien omkring Haraldsted Sø udvides med nye shelters", "art-tudeaa")
        ],
        "nabolag_text": "Ringsted By: Torvet summer af liv efter etablering af nye udendørs serveringsarealer."
    },
    "koege": {
        "navn": "KøgeLokalt",
        "prefix": "Køge",
        "by": "Køge",
        "kommune": "Køge Kommune",
        "accent": "#24533A",
        "accent_soft": "#EAF3EE",
        "tagline": "Lokaljournalistik med blik for Køges vækst, havn og stærke fællesskaber",
        "omraader": ["Køge By", "Køge Nord", "Herfølge", "Borup", "Ejby"],
        "hero_kicker": "VÆKST & ERHVERV · KØGE HAVN",
        "hero_title": "Køge Havn indvier ny terminal og skaber 150 nye arbejdspladser",
        "hero_manchet": "Nordens hurtigst voksende erhvervshavn udvider faciliteterne med 120.000 kvm nyt logistikareal.",
        "hero_meta": "4 t. siden",
        "hero_img": "img-erhverv",
        "wire": [
            ("08:20", "Køge Nord Station runder milepæl med over 10.000 daglige passagerer", "art-byraad"),
            ("07:45", "Kulturstrøget i Køge Bymidte åbner for nye kunstneriske værksteder", "art-kultur"),
            ("06:30", "Herfølge Idrætscenter udvider faciliteterne med ny moderne springhal", "art-sport"),
            ("22:10", "HB Køge tager vigtig sejr foran et feststemt hjemmepublikum", "art-sport"),
            ("20:40", "Køge Å-stien renoveres med nye træbroer og forbedret belysning", "art-tudeaa")
        ],
        "nabolag_text": "Køge Nord: Nye grønne boligkvarterer skyder op med fælleshaver og delebilsordninger."
    },
    "roskilde": {
        "navn": "RoskildeLokalt",
        "prefix": "Roskilde",
        "by": "Roskilde",
        "kommune": "Roskilde Kommune",
        "accent": "#6A3553",
        "accent_soft": "#F7EDF3",
        "tagline": "Kultur, viden og byens puls — lokaljournalistik i Roskilde",
        "omraader": ["Roskilde By", "Trekroner", "Jyllinge", "Viby Sjælland", "Svogerslev"],
        "hero_kicker": "KULTURARV · ROSKILDE FJORD",
        "hero_title": "Vikingeskibsmuseets nye klimasikrede museumsbygning godkendt af byrådet",
        "hero_manchet": "En historisk bevilling sikrer de fem originale vikingeskibe mod fremtidige stormfloder og skaber et nyt vartegn.",
        "hero_meta": "2 t. siden",
        "hero_img": "img-storebaelt",
        "wire": [
            ("08:35", "Roskilde Festival løfter sløret for 24 nye internationale kunstnere", "art-kultur"),
            ("07:50", "RUC i Trekroner etablerer nyt forskningscenter for grøn omstilling", "art-byraad"),
            ("07:10", "Stændertorvet omdannes til levende madmarked hver lørdag i foråret", "art-butik"),
            ("21:50", "Roskilde KFUM vinder topopgør og fastholder førstepladsen", "art-sport"),
            ("19:15", "Jyllinge Havn sikres med ny højvandsport og forstærket dige", "art-tudeaa")
        ],
        "nabolag_text": "Roskilde By: Historiske brolægninger omkring Domkirken og Algade restaureres med respekt for arven."
    },
    "kalundborg": {
        "navn": "KalundborgLokalt",
        "prefix": "Kalundborg",
        "by": "Kalundborg",
        "kommune": "Kalundborg Kommune",
        "accent": "#0284C7",
        "accent_soft": "#EBF6FC",
        "tagline": "Biotekbyen, havnen og livet langs kysten i Kalundborg",
        "omraader": ["Kalundborg By", "Høng", "Gørlev", "Svebølle", "Havnsø"],
        "hero_kicker": "BIOTEK & UDDANNELSE · KALUNDBORG",
        "hero_title": "Novo Nordisk og Kalundborg Kommune indvier nyt biotek-akademi",
        "hero_manchet": "Det nye uddannelsescenter skal uddanne hundredvis af procesteknologer og ingeniører til den voksende industri.",
        "hero_meta": "1 t. siden",
        "hero_img": "img-erhverv",
        "wire": [
            ("08:25", "Kalundborg Havn klar til rekordstor krydstogtsæson med 40 anløb", "art-byraad"),
            ("07:40", "Nyt sundhedshus i Gørlev samler læger og fysioterapeuter", "art-butik"),
            ("06:55", "Høng Erhvervsråd hædrer årets lokale iværksætter", "art-butik"),
            ("22:05", "Kalundborg GB vinder lokalopgør mod Svebølle i serie 1", "art-sport"),
            ("19:30", "Havnsø Strandpromenade udvides med ny badebro og sauna", "art-tudeaa")
        ],
        "nabolag_text": "Kalundborg By: Bymidten og havnepromenaden bindes tættere sammen med ny grøn aktivitetsrute."
    }
}

cities_json = json.dumps(cities_data, ensure_ascii=False)

html_content = f'''<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>SlagelseLokalt – Lokaljournalistik, der sætter fællesskabet først</title>
  <meta name="description" content="Nyheder, erhverv, sport, kultur, debat og foreningsliv i Slagelse Kommune og [By]Lokalt netværket.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    :root {{
      {css_vars}

      --bg: #F8F9FA;
      --surface: #FFFFFF;
      --surface-2: #F1F3F5;
      --surface-3: #E9ECEF;
      --ink: #111827;
      --ink-2: #4B5563;
      --ink-3: #6B7280;
      --line: #E5E7EB;
      --line-subtle: #F3F4F6;
      --site-accent: #007038;
      --site-accent-hover: #005A2D;
      --site-accent-soft: #EBF7EE;
      --site-accent-light: #F4FAF5;
      --live-red: #D92D20;

      --font-display: 'Newsreader', Georgia, serif;
      --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
      --shadow-md: 0 4px 14px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03);
      --shadow-lg: 0 10px 30px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 18px;
      --radius-xl: 22px;
    }}

    *, *::before, *::after {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    html {{
      scroll-behavior: smooth;
      -webkit-text-size-adjust: 100%;
      background-color: var(--bg);
    }}

    body {{
      width: 100%;
      max-width: 100vw;
      overflow-x: hidden;
      background-color: var(--bg);
      color: var(--ink);
      font-family: var(--font-body);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding-bottom: env(safe-area-inset-bottom, 24px);
    }}

    a {{ color: inherit; text-decoration: none; cursor: pointer; }}
    button {{ font-family: inherit; cursor: pointer; border: none; background: none; }}
    img {{ display: block; max-width: 100%; height: auto; }}

    /* IMAGE NATIVE BACKGROUND UTILITIES */
    .card-img-cover {{
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: block;
    }}
    .img-storebaelt {{ background-image: var(--img-storebaelt_hero); }}
    .img-bymidte {{ background-image: var(--img-slagelse_bymidte); }}
    .img-sommerhus {{ background-image: var(--img-skaelskoer_sommerhus); }}
    .img-erhverv {{ background-image: var(--img-slagelse_erhverv); }}
    .img-kort {{ background-image: var(--img-nabolag_kort); }}
    .img-fodbold {{ background-image: var(--img-slagelse_fodbold); }}
    .img-natur {{ background-image: var(--img-tude_aa_natur); }}
    .img-debat {{ background-image: var(--img-debat_skriver); }}

    .site-container {{
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 16px;
    }}
    @media (min-width: 640px) {{
      .site-container {{ padding: 0 20px; }}
    }}

    /* 1. TOP NETWORK STRIP */
    .site-network-bar {{
      background-color: #0F172A;
      color: #94A3B8;
      font-size: 11.5px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      width: 100%;
      overflow: hidden;
    }}
    .site-network-inner {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 38px;
      width: 100%;
    }}
    .site-network-left {{
      display: flex;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding-right: 8px;
    }}
    .site-network-left::-webkit-scrollbar {{ display: none; }}
    .site-network-badge {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 700;
      color: #F8FAFC;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      font-size: 10.5px;
      margin-right: 4px;
    }}
    .site-network-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 4px;
    }}
    .site-network-btn {{
      display: inline-flex;
      align-items: center;
      color: #94A3B8;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 11.5px;
      transition: all 0.15s;
      cursor: pointer;
    }}
    .site-network-btn:hover {{
      color: #FFFFFF;
      background: rgba(255,255,255,0.12);
    }}
    .site-network-btn.is-active {{
      color: #FFFFFF;
      background: rgba(255,255,255,0.22);
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }}

    .site-network-right {{
      display: none;
      align-items: center;
      font-size: 11.5px;
      white-space: nowrap;
    }}
    @media (min-width: 960px) {{
      .site-network-right {{ display: flex; }}
    }}
    .live-dot-pulse {{
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #EF4444;
      display: inline-block;
      margin-right: 5px;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.4);
      animation: pulse 1.8s infinite;
    }}
    @keyframes pulse {{
      0% {{ transform: scale(0.95); opacity: 0.8; }}
      50% {{ transform: scale(1.25); opacity: 1; }}
      100% {{ transform: scale(0.95); opacity: 0.8; }}
    }}

    /* 2. STICKY HEADER WITH DYNAMIC ACCENT */
    .site-header-wrapper {{
      background: var(--surface);
      border-bottom: 2px solid var(--site-accent);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: var(--shadow-sm);
      width: 100%;
      transition: border-color 0.3s ease;
    }}
    .site-header-inner {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      width: 100%;
      gap: 10px;
    }}
    @media (min-width: 768px) {{
      .site-header-inner {{ height: 72px; }}
    }}
    .site-brand-container {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .site-brand-logo {{
      display: flex;
      align-items: baseline;
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--ink);
      white-space: nowrap;
    }}
    @media (min-width: 768px) {{
      .site-brand-logo {{ font-size: 28px; }}
    }}
    .site-brand-logo-accent {{
      color: var(--site-accent);
      font-style: italic;
      margin-left: 1px;
      transition: color 0.3s ease;
    }}
    .site-brand-tagline {{
      display: none;
      font-size: 11px;
      color: var(--ink-3);
      letter-spacing: 0.01em;
      margin-top: -3px;
    }}
    @media (min-width: 1024px) {{
      .site-brand-tagline {{ display: block; }}
    }}

    /* CITY SWITCHER DROPDOWN BUTTON IN HEADER */
    .site-city-picker-btn {{
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11.5px;
      font-weight: 700;
      color: var(--site-accent);
      background: var(--site-accent-soft);
      border: 1px solid var(--site-accent);
      padding: 4px 8px;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }}
    .site-city-picker-btn:hover {{
      opacity: 0.9;
    }}

    /* DROPDOWN POPUP MENU */
    .city-dropdown-menu {{
      display: none;
      position: absolute;
      top: 60px;
      left: 16px;
      width: 280px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      padding: 8px;
      z-index: 1000;
      flex-direction: column;
      gap: 2px;
    }}
    .city-dropdown-menu.is-open {{
      display: flex;
    }}
    .city-dropdown-item {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 12px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background 0.15s;
    }}
    .city-dropdown-item:hover {{
      background: var(--surface-2);
    }}
    .city-dropdown-item.is-active {{
      background: var(--site-accent-soft);
      font-weight: 700;
    }}

    .site-header-primary-nav {{
      display: none;
    }}
    @media (min-width: 960px) {{
      .site-header-primary-nav {{ display: flex; align-items: center; }}
    }}
    .site-header-primary-list {{
      display: flex;
      list-style: none;
      gap: 4px;
    }}
    .site-header-primary-link {{
      font-size: 14px;
      font-weight: 600;
      color: var(--ink-2);
      padding: 7px 11px;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
    }}
    .site-header-primary-link:hover {{
      color: var(--ink);
      background: var(--surface-2);
    }}
    .site-header-primary-link.is-active {{
      color: var(--site-accent);
      background: var(--site-accent-soft);
      font-weight: 700;
    }}

    .site-header-actions {{
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }}
    .site-btn-icon {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--ink-2);
      transition: all 0.15s;
    }}
    .site-btn-icon:hover {{ background: var(--surface-2); color: var(--ink); }}

    .site-header-btn-stoet {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      font-weight: 700;
      color: #FFFFFF;
      background: var(--site-accent);
      padding: 7px 12px;
      border-radius: var(--radius-sm);
      white-space: nowrap;
      transition: all 0.25s ease;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    }}
    .site-header-btn-stoet:hover {{
      opacity: 0.92;
    }}

    .site-hamburger-btn {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--ink);
    }}
    @media (min-width: 960px) {{
      .site-hamburger-btn {{ display: none; }}
    }}

    /* MOBILE TOOLBAR COMPACTING & BOTTOM APP BAR */
    @media (max-width: 768px) {{
      .site-city-picker-btn {{ display: none !important; }}
      .site-header-btn-stoet {{ display: none !important; }}
      .site-header-inner {{ height: 56px !important; }}
      .site-brand-logo {{ font-size: 24px !important; }}
      .site-main-content {{ padding-bottom: 84px !important; }}
    }}

    .mobile-bottom-bar {{
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: #FFFFFF;
      border-top: 1px solid var(--line);
      z-index: 980;
      justify-content: space-around;
      align-items: center;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
    }}
    @media (max-width: 768px) {{
      .mobile-bottom-bar {{ display: flex; }}
    }}
    .mobile-bottom-item {{
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      color: var(--ink-3);
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
      flex: 1;
      height: 100%;
      background: none;
      border: none;
      cursor: pointer;
      transition: color 0.15s;
    }}
    .mobile-bottom-item.is-active, .mobile-bottom-item:hover {{
      color: var(--site-accent);
    }}

    /* HERO PIXEL-PERFECT STYLING */
    .site-hero-top-meta {{
      font-size: 12.5px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.85);
      margin-bottom: 3px;
      display: block;
    }}
    .site-hero-subkicker {{
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 8px;
      display: block;
    }}
    .site-hero-live-badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: #FFFFFF;
      padding: 7px 14px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.04em;
      backdrop-filter: blur(4px);
    }}
    .hero-live-dot {{
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #EF4444;
      display: inline-block;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5);
      animation: pulse 1.8s infinite;
    }}

    /* 4-MODE TIP OS TABS */
    .tip-mode-tabs {{
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }}
    .tip-mode-tabs::-webkit-scrollbar {{ display: none; }}
    .tip-tab-btn {{
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      color: var(--ink-2);
      background: var(--surface-2);
      border: 1px solid var(--line);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }}
    .tip-tab-btn.is-active {{
      color: #FFFFFF;
      background: var(--site-accent);
      border-color: var(--site-accent);
      box-shadow: var(--shadow-sm);
    }}

    /* 3. HORIZONTALLY SCROLLABLE SUBNAV PILLS */
    .site-subnav-strip {{
      background: var(--surface);
      border-bottom: 1px solid var(--line);
      width: 100%;
      overflow-x: auto;
      white-space: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding: 8px 0;
    }}
    .site-subnav-strip::-webkit-scrollbar {{ display: none; }}
    .site-subnav-pills-list {{
      display: inline-flex;
      gap: 6px;
      padding: 0 16px;
    }}
    .site-subnav-pill {{
      font-size: 13px;
      font-weight: 600;
      color: var(--ink-2);
      background: var(--surface-2);
      padding: 6px 13px;
      border-radius: 999px;
      transition: all 0.15s;
      flex-shrink: 0;
      display: inline-block;
      border: 1px solid transparent;
    }}
    .site-subnav-pill:hover, .site-subnav-pill.is-active {{
      color: #FFFFFF;
      background: var(--site-accent);
      border-color: var(--site-accent);
    }}
    .site-subnav-pill.is-highlight {{
      color: var(--site-accent);
      background: var(--site-accent-soft);
      border-color: var(--site-accent);
    }}

    /* 4. DRAWER MENU (MOBILE) */
    .mobile-drawer-overlay {{
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 999;
      backdrop-filter: blur(4px);
    }}
    .mobile-drawer-overlay.is-open {{ display: block; }}
    .mobile-drawer-content {{
      position: fixed;
      top: 0;
      right: 0;
      width: 300px;
      max-width: 85%;
      height: 100%;
      background: var(--surface);
      z-index: 1000;
      box-shadow: var(--shadow-lg);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }}
    .mobile-drawer-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--line);
      padding-bottom: 14px;
    }}
    .mobile-drawer-links {{
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }}
    .mobile-drawer-link {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      font-size: 15px;
      font-weight: 600;
      color: var(--ink);
      border-radius: var(--radius-sm);
    }}
    .mobile-drawer-link:hover {{
      background: var(--site-accent-soft);
      color: var(--site-accent);
    }}

    /* MAIN PADDING */
    .site-main-content {{
      padding: 20px 0 60px 0;
      width: 100%;
    }}

    /* SECTION CONTAINERS & HEADERS */
    .content-section {{
      margin-bottom: 44px;
      scroll-margin-top: 80px;
      width: 100%;
    }}
    .section-header-box {{
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 24px 20px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
      border-left: 4px solid var(--site-accent);
      transition: border-color 0.3s ease;
    }}
    @media (min-width: 640px) {{
      .section-header-box {{ padding: 28px 30px; }}
    }}
    .section-kicker {{
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--site-accent);
      margin-bottom: 6px;
      display: block;
      transition: color 0.3s ease;
    }}
    .section-title {{
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--ink);
      line-height: 1.2;
      margin-bottom: 8px;
    }}
    @media (min-width: 640px) {{
      .section-title {{ font-size: 32px; }}
    }}
    .section-desc {{
      font-size: 14.5px;
      color: var(--ink-2);
      line-height: 1.55;
      max-width: 720px;
    }}

    /* TOP 3-COL GRID (FORSIDE) */
    .site-top-3col-grid {{
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-bottom: 28px;
      width: 100%;
    }}
    @media (min-width: 1024px) {{
      .site-top-3col-grid {{
        grid-template-columns: 1.35fr 0.65fr 0.65fr;
        align-items: stretch;
        gap: 22px;
      }}
    }}

    /* HERO CARD */
    .site-hero-overlay-card {{
      position: relative;
      border-radius: var(--radius-lg);
      overflow: hidden;
      min-height: 340px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      box-shadow: var(--shadow-md);
      cursor: pointer;
      background-color: #0F172A;
      width: 100%;
      transition: transform 0.2s;
    }}
    @media (min-width: 640px) {{
      .site-hero-overlay-card {{ min-height: 440px; }}
    }}
    .site-hero-overlay-card:hover {{
      transform: translateY(-2px);
    }}
    .site-hero-bg-layer {{
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }}
    .site-hero-gradient {{
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.6) 45%, rgba(15,23,42,0.96) 100%);
      z-index: 2;
    }}
    .site-hero-content {{
      position: relative;
      z-index: 3;
      padding: 20px 16px;
      color: #FFFFFF;
    }}
    @media (min-width: 640px) {{
      .site-hero-content {{ padding: 28px; }}
    }}
    .site-hero-kicker {{
      display: inline-block;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: #EF4444;
      color: #FFFFFF;
      padding: 3px 9px;
      border-radius: 999px;
      margin-bottom: 10px;
    }}
    .site-hero-title {{
      font-family: var(--font-display);
      font-size: 21px;
      font-weight: 800;
      line-height: 1.25;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
      color: #FFFFFF;
    }}
    @media (min-width: 640px) {{
      .site-hero-title {{ font-size: 30px; }}
    }}
    .site-hero-manchet {{
      font-size: 13.5px;
      color: #E2E8F0;
      line-height: 1.5;
      margin-bottom: 16px;
      max-width: 600px;
    }}
    @media (min-width: 640px) {{
      .site-hero-manchet {{ font-size: 15px; }}
    }}
    .site-hero-actions-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }}
    .site-hero-btn-read {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #FFFFFF;
      color: #0F172A;
      font-size: 13px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: var(--radius-sm);
    }}

    /* WIRE CARD */
    .site-wire-card {{
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 18px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      width: 100%;
    }}
    @media (min-width: 640px) {{
      .site-wire-card {{ padding: 22px; }}
    }}
    .site-wire-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--line-subtle);
      margin-bottom: 14px;
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 800;
    }}
    .site-wire-list {{
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}
    .site-wire-item {{
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--line-subtle);
      cursor: pointer;
    }}
    .site-wire-item:last-child {{ border-bottom: none; padding-bottom: 0; }}
    .site-wire-time {{
      font-size: 11px;
      font-weight: 700;
      color: var(--ink-3);
      background: var(--surface-2);
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      margin-top: 2px;
    }}
    .site-wire-headline {{
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.4;
      color: var(--ink);
      transition: color 0.15s;
    }}
    .site-wire-item:hover .site-wire-headline {{
      color: var(--site-accent);
    }}

    /* NABOLAG CARD */
    .site-nabolag-card {{
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 18px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      width: 100%;
    }}
    @media (min-width: 640px) {{
      .site-nabolag-card {{ padding: 22px; }}
    }}
    .site-nabolag-thumb {{
      height: 120px;
      border-radius: var(--radius-md);
      overflow: hidden;
      margin-bottom: 14px;
      position: relative;
    }}
    .site-nabolag-pills {{
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 12px;
    }}
    .site-nabolag-pill {{
      font-size: 11.5px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--ink-2);
      border: 1px solid var(--line);
      cursor: pointer;
      transition: all 0.15s;
    }}
    .site-nabolag-pill.is-active {{
      background: var(--site-accent);
      color: #FFFFFF;
      border-color: var(--site-accent);
    }}

    /* MIDDLE 3-CARDS GRID */
    .site-middle-3cards-grid {{
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-bottom: 28px;
      width: 100%;
    }}
    @media (min-width: 768px) {{
      .site-middle-3cards-grid {{
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin-bottom: 36px;
      }}
    }}
    .site-card {{
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      width: 100%;
    }}
    .site-card:hover {{
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }}
    .site-card-thumb {{
      height: 170px;
      position: relative;
      overflow: hidden;
      background-color: #E2E8F0;
    }}
    .site-card-body {{
      padding: 16px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }}
    @media (min-width: 640px) {{
      .site-card-body {{ padding: 20px; }}
    }}
    .site-card-kicker {{
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--site-accent);
      margin-bottom: 6px;
      transition: color 0.3s ease;
    }}
    .site-card-title {{
      font-family: var(--font-display);
      font-size: 18.5px;
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.015em;
      color: var(--ink);
      margin-bottom: 8px;
      transition: color 0.15s;
    }}
    .site-card:hover .site-card-title {{
      color: var(--site-accent);
    }}
    .site-card-desc {{
      font-size: 13.5px;
      color: var(--ink-2);
      line-height: 1.5;
      margin-bottom: 14px;
      flex: 1;
    }}
    .site-card-meta {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: var(--ink-3);
      padding-top: 10px;
      border-top: 1px solid var(--line-subtle);
    }}

    /* 4-GRID (MERE FRA OMRÅDET) */
    .site-4grid {{
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-bottom: 32px;
      width: 100%;
    }}
    @media (min-width: 640px) {{
      .site-4grid {{ grid-template-columns: repeat(2, 1fr); }}
    }}
    @media (min-width: 1024px) {{
      .site-4grid {{ grid-template-columns: repeat(4, 1fr); gap: 20px; }}
    }}

    /* COMMUNITY BANNER */
    .site-community-banner {{
      background: linear-gradient(135deg, #064E3B 0%, #065F46 100%);
      border-radius: var(--radius-lg);
      padding: 24px 20px;
      color: #FFFFFF;
      margin-bottom: 32px;
      box-shadow: var(--shadow-md);
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
    }}
    @media (min-width: 860px) {{
      .site-community-banner {{
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 32px 36px;
      }}
    }}
    .site-community-title {{
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 800;
      line-height: 1.25;
      margin-bottom: 8px;
    }}
    @media (min-width: 640px) {{
      .site-community-title {{ font-size: 28px; }}
    }}
    .site-community-desc {{
      font-size: 14.5px;
      color: #D1FAE5;
      line-height: 1.55;
      max-width: 640px;
    }}
    .site-community-btn {{
      background: #FFFFFF;
      color: #064E3B;
      font-size: 13.5px;
      font-weight: 700;
      padding: 10px 18px;
      border-radius: var(--radius-sm);
      white-space: nowrap;
      display: inline-block;
      text-align: center;
    }}

    /* PARTNERS BOX */
    .site-partners-box {{
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 20px;
      margin-bottom: 36px;
      width: 100%;
    }}
    .site-partners-logos {{
      display: flex;
      align-items: center;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 16px;
      padding: 14px 0;
      border-top: 1px solid var(--line-subtle);
      border-bottom: 1px solid var(--line-subtle);
      margin: 12px 0;
    }}
    .site-partner-badge {{
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 700;
      color: #475569;
    }}

    /* STØT CONTAINER (DUAL SUPPORT MODEL) */
    .support-card-container {{
      max-width: 840px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 24px 18px;
      box-shadow: var(--shadow-sm);
      width: 100%;
    }}
    @media (min-width: 640px) {{
      .support-card-container {{ padding: 36px; }}
    }}
    .support-mode-toggle {{
      display: flex;
      background: var(--surface-2);
      padding: 4px;
      border-radius: var(--radius-md);
      margin-bottom: 24px;
      gap: 4px;
      width: 100%;
    }}
    .support-toggle-btn {{
      flex: 1;
      text-align: center;
      padding: 10px;
      font-size: 13.5px;
      font-weight: 700;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--ink-2);
    }}
    .support-toggle-btn.is-active {{
      background: var(--surface);
      color: var(--ink);
      box-shadow: var(--shadow-sm);
    }}
    .support-plans-grid {{
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      margin-bottom: 24px;
      width: 100%;
    }}
    @media (min-width: 680px) {{
      .support-plans-grid {{ grid-template-columns: repeat(3, 1fr); }}
    }}
    .support-plan-card {{
      background: var(--surface);
      border: 2px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 18px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
    }}
    .support-plan-card.is-selected {{
      border-color: var(--site-accent);
      background: var(--site-accent-light);
    }}
    .support-plan-price {{
      font-size: 26px;
      font-weight: 800;
      color: var(--site-accent);
      margin-bottom: 10px;
      transition: color 0.3s ease;
    }}
    .support-plan-price span {{ font-size: 12.5px; color: var(--ink-3); font-weight: 500; }}
    .custom-amt-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
      width: 100%;
    }}
    @media (min-width: 600px) {{
      .custom-amt-grid {{ grid-template-columns: repeat(5, 1fr); }}
    }}
    .custom-amt-btn {{
      padding: 10px;
      font-size: 14px;
      font-weight: 700;
      border: 1px solid var(--line);
      background: var(--surface);
      border-radius: var(--radius-sm);
      text-align: center;
      cursor: pointer;
    }}
    .custom-amt-btn.is-active {{
      background: var(--site-accent);
      color: #FFFFFF;
      border-color: var(--site-accent);
    }}
    .form-control {{
      width: 100%;
      padding: 10px 14px;
      font-size: 14.5px;
      font-family: inherit;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--ink);
    }}

    /* SEARCH VIEW */
    .search-container {{
      max-width: 840px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 24px 18px;
      box-shadow: var(--shadow-sm);
      width: 100%;
    }}
    @media (min-width: 640px) {{
      .search-container {{ padding: 36px; }}
    }}
    .search-input-field {{
      width: 100%;
      padding: 14px 16px 14px 44px;
      font-size: 16px;
      font-family: inherit;
      border: 2px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface-2);
      color: var(--ink);
    }}
    .search-input-field:focus {{
      outline: none;
      border-color: var(--site-accent);
      background: #FFFFFF;
    }}

    /* ========================================================= */
    /* DEDIKEREDE ARTIKEL-LÆSEVISNINGER (FULD SCROLLBARHED)      */
    /* ========================================================= */
    .article-full-page {{
      max-width: 860px;
      margin: 0 auto 60px auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 26px 20px 80px 20px;
      box-shadow: var(--shadow-sm);
      scroll-margin-top: 80px;
      position: relative;
    }}
    @media (min-width: 640px) {{
      .article-full-page {{ padding: 44px 40px 100px 40px; }}
    }}
    .article-top-nav-bar {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--line-subtle);
    }}
    .article-back-link {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13.5px;
      font-weight: 700;
      color: var(--site-accent);
      background: var(--site-accent-soft);
      padding: 7px 14px;
      border-radius: 999px;
      transition: all 0.15s;
    }}
    .article-back-link:hover {{
      opacity: 0.9;
      transform: translateX(-2px);
    }}
    .article-heading {{
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 800;
      line-height: 1.22;
      color: var(--ink);
      margin: 12px 0 16px 0;
    }}
    @media (min-width: 640px) {{
      .article-heading {{ font-size: 38px; }}
    }}
    .article-lead {{
      font-size: 16.5px;
      font-weight: 500;
      color: var(--ink-2);
      line-height: 1.6;
      margin-bottom: 22px;
      border-left: 3.5px solid var(--site-accent);
      padding-left: 16px;
      transition: border-color 0.3s ease;
    }}
    .article-byline-bar {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12.5px;
      color: var(--ink-3);
      padding: 10px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      margin-bottom: 24px;
    }}
    .article-hero-box {{
      height: 240px;
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: 24px;
      position: relative;
    }}
    @media (min-width: 640px) {{
      .article-hero-box {{ height: 420px; }}
    }}
    .article-prose {{
      font-size: 16px;
      line-height: 1.75;
      color: #27272A;
    }}
    .article-prose p {{ margin-bottom: 18px; }}
    .article-pullquote {{
      font-family: var(--font-display);
      font-size: 21px;
      font-style: italic;
      color: var(--ink);
      line-height: 1.45;
      margin: 28px 0;
      padding: 18px 22px;
      background: var(--surface-2);
      border-left: 4px solid var(--site-accent);
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
      transition: border-color 0.3s ease;
    }}
    .article-faktaboks {{
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 20px;
      margin: 28px 0;
    }}
    .article-faktaboks-title {{
      font-size: 13.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--site-accent);
      margin-bottom: 8px;
      letter-spacing: 0.05em;
    }}
    .article-bottom-actions {{
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid var(--line);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }}

    /* FLOATING 'TILBAGE' PILL KNAP DER ALTID KAN SES VED SCROLL */
    .floating-back-btn {{
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #0F172A;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 700;
      padding: 10px 20px;
      border-radius: 999px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      z-index: 99;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }}
    .floating-back-btn:hover {{
      background: var(--site-accent);
      transform: translateX(-50%) translateY(-2px);
    }}

    /* FOOTER */
    .site-footer {{
      background: #0F172A;
      color: #94A3B8;
      padding: 44px 0 28px 0;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 13.5px;
      width: 100%;
    }}
    .site-footer-grid {{
      display: grid;
      grid-template-columns: 1fr;
      gap: 30px;
      margin-bottom: 36px;
    }}
    @media (min-width: 768px) {{
      .site-footer-grid {{ grid-template-columns: 1.5fr 1fr 1fr 1fr; }}
    }}
    .site-footer-brand {{
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 10px;
    }}
    .site-footer-links {{
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }}
  </style>
</head>
<body>

  <!-- 1. TOP NETWORK STRIP WITH ALL CITIES -->
  <div class="site-network-bar">
    <div class="site-container site-network-inner">
      <div class="site-network-left">
        <span class="site-network-badge"><span class="site-network-dot" style="background:var(--site-accent);"></span> [By]Lokalt netværk:</span>
        <button onclick="switchCity('slagelse')" id="net-btn-slagelse" class="site-network-btn is-active"><span class="site-network-dot" style="background:#007038;"></span> Slagelse</button>
        <button onclick="switchCity('naestved')" id="net-btn-naestved" class="site-network-btn"><span class="site-network-dot" style="background:#1F5663;"></span> Næstved</button>
        <button onclick="switchCity('holbaek')" id="net-btn-holbaek" class="site-network-btn"><span class="site-network-dot" style="background:#4F5B1E;"></span> Holbæk</button>
        <button onclick="switchCity('ringsted')" id="net-btn-ringsted" class="site-network-btn"><span class="site-network-dot" style="background:#8A5A00;"></span> Ringsted</button>
        <button onclick="switchCity('koege')" id="net-btn-koege" class="site-network-btn"><span class="site-network-dot" style="background:#24533A;"></span> Køge</button>
        <button onclick="switchCity('roskilde')" id="net-btn-roskilde" class="site-network-btn"><span class="site-network-dot" style="background:#6A3553;"></span> Roskilde</button>
        <button onclick="switchCity('kalundborg')" id="net-btn-kalundborg" class="site-network-btn"><span class="site-network-dot" style="background:#0284C7;"></span> Kalundborg</button>
      </div>
      <div class="site-network-right">
        <a href="#art-storebaelt" id="net-ticker-text">
          <span class="live-dot-pulse"></span>
          <span><strong>LIVE:</strong> Storebæltsbroen mod Fyn – Oprydning i gang</span>
        </a>
      </div>
    </div>
  </div>

  <!-- 2. STICKY HEADER -->
  <header class="site-header-wrapper">
    <div class="site-container site-header-inner">
      <div class="site-brand-container">
        <div>
          <a href="#forside" class="site-brand-logo">
            <span id="site-logo-prefix">Slagelse</span><span class="site-brand-logo-accent">Lokalt</span>
          </a>
          <span id="site-brand-tagline" class="site-brand-tagline">Lokaljournalistik, der sætter fællesskabet først</span>
        </div>

        <!-- City switcher dropdown in header -->
        <div style="position:relative;">
          <button onclick="toggleCityDropdown()" id="header-city-btn" class="site-city-picker-btn" title="Skift til en anden by/kommune">
            <span id="header-city-name">Slagelse</span> ▾
          </button>

          <!-- Dropdown menu popup -->
          <div id="city-dropdown" class="city-dropdown-menu">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--ink-3); padding:4px 8px 6px 8px; border-bottom:1px solid var(--line);">Vælg by / kommune</div>
            <div onclick="switchCity('slagelse')" class="city-dropdown-item is-active" id="drop-item-slagelse">
              <span style="display:flex; align-items:center; gap:8px;"><span class="site-network-dot" style="background:#007038;"></span> SlagelseLokalt</span>
              <span style="font-size:11.5px; color:var(--ink-3);">Slagelse</span>
            </div>
            <div onclick="switchCity('naestved')" class="city-dropdown-item" id="drop-item-naestved">
              <span style="display:flex; align-items:center; gap:8px;"><span class="site-network-dot" style="background:#1F5663;"></span> NæstvedLokalt</span>
              <span style="font-size:11.5px; color:var(--ink-3);">Næstved</span>
            </div>
            <div onclick="switchCity('holbaek')" class="city-dropdown-item" id="drop-item-holbaek">
              <span style="display:flex; align-items:center; gap:8px;"><span class="site-network-dot" style="background:#4F5B1E;"></span> HolbækLokalt</span>
              <span style="font-size:11.5px; color:var(--ink-3);">Holbæk</span>
            </div>
            <div onclick="switchCity('ringsted')" class="city-dropdown-item" id="drop-item-ringsted">
              <span style="display:flex; align-items:center; gap:8px;"><span class="site-network-dot" style="background:#8A5A00;"></span> RingstedLokalt</span>
              <span style="font-size:11.5px; color:var(--ink-3);">Ringsted</span>
            </div>
            <div onclick="switchCity('koege')" class="city-dropdown-item" id="drop-item-koege">
              <span style="display:flex; align-items:center; gap:8px;"><span class="site-network-dot" style="background:#24533A;"></span> KøgeLokalt</span>
              <span style="font-size:11.5px; color:var(--ink-3);">Køge</span>
            </div>
            <div onclick="switchCity('roskilde')" class="city-dropdown-item" id="drop-item-roskilde">
              <span style="display:flex; align-items:center; gap:8px;"><span class="site-network-dot" style="background:#6A3553;"></span> RoskildeLokalt</span>
              <span style="font-size:11.5px; color:var(--ink-3);">Roskilde</span>
            </div>
            <div onclick="switchCity('kalundborg')" class="city-dropdown-item" id="drop-item-kalundborg">
              <span style="display:flex; align-items:center; gap:8px;"><span class="site-network-dot" style="background:#0284C7;"></span> KalundborgLokalt</span>
              <span style="font-size:11.5px; color:var(--ink-3);">Kalundborg</span>
            </div>
          </div>
        </div>

        <!-- Desktop Navigation Links -->
        <nav class="site-header-primary-nav">
          <ul class="site-header-primary-list">
            <li><a href="#forside" class="site-header-primary-link is-active">Forside</a></li>
            <li><a href="#nyheder" class="site-header-primary-link">Nyheder</a></li>
            <li><a href="#erhverv" class="site-header-primary-link">Erhverv</a></li>
            <li><a href="#sport" class="site-header-primary-link">Sport</a></li>
            <li><a href="#kultur" class="site-header-primary-link">Kultur</a></li>
            <li><a href="#foreningsliv" class="site-header-primary-link">Foreningsliv</a></li>
            <li><a href="#debat" class="site-header-primary-link">Debat</a></li>
            <li><a href="#priser" class="site-header-primary-link" style="color:var(--site-accent);">Priser</a></li>
          </ul>
        </nav>
      </div>

      <div class="site-header-actions">
        <!-- Search icon button -->
        <a href="#soeg" class="site-btn-icon" title="Søg i nyheder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </a>

        <!-- User profile icon button (Public reader profile, NOT CMS login) -->
        <a href="#profil" class="site-btn-icon" title="Min brugerprofil">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </a>

        <!-- Support compact button with dynamic site name -->
        <a href="#stoet" id="header-stoet-btn" class="site-header-btn-stoet">
          <span>❤️</span>
          <span id="header-stoet-label">Støt Slagelse</span>
        </a>

        <!-- Mobile hamburger button -->
        <button onclick="toggleMobileMenu()" class="site-hamburger-btn" aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- 3. MOBILE SUBNAV PILLS (HORIZONTALLY SCROLLABLE - MATCHING MOCKUP & AUDIO) -->
  <div class="site-subnav-strip">
    <div class="site-subnav-pills-list">
      <a href="#forside" class="site-subnav-pill is-active">Nyheder</a>
      <a href="#erhverv" class="site-subnav-pill">Erhverv</a>
      <a href="#sport" class="site-subnav-pill">Sport</a>
      <a href="#kultur" class="site-subnav-pill">Kultur</a>
      <a href="#priser" class="site-subnav-pill" style="color:var(--site-accent); font-weight:700;">Priser & Annoncer</a>
      <a href="#stoet" class="site-subnav-pill">Støt os</a>
      <a href="#indsend" class="site-subnav-pill">Tip os</a>
      <a href="javascript:void(0)" onclick="toggleMobileMenu()" class="site-subnav-pill">Mere</a>
    </div>
  </div>

  <!-- 4. MOBILE DRAWER OVERLAY -->
  <div id="mobile-drawer" class="mobile-drawer-overlay" onclick="toggleMobileMenu()">
    <div class="mobile-drawer-content" onclick="event.stopPropagation()">
      <div class="mobile-drawer-header">
        <div class="site-brand-logo" style="font-size:20px;">
          <span id="drawer-logo-prefix">Slagelse</span><span class="site-brand-logo-accent">Lokalt</span>
        </div>
        <button onclick="toggleMobileMenu()" style="font-size:24px; color:var(--ink-3);">&times;</button>
      </div>

      <!-- Vælg by sektion i mobilskuffen -->
      <div style="background:var(--surface-2); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--line);">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--ink-3); margin-bottom:8px;">Vælg by / netværk:</div>
        <div style="display:flex; flex-wrap:wrap; gap:5px;">
          <button onclick="switchCity('slagelse'); toggleMobileMenu()" class="site-network-btn" style="background:#fff; color:var(--ink);"><span class="site-network-dot" style="background:#007038;"></span> Slagelse</button>
          <button onclick="switchCity('naestved'); toggleMobileMenu()" class="site-network-btn" style="background:#fff; color:var(--ink);"><span class="site-network-dot" style="background:#1F5663;"></span> Næstved</button>
          <button onclick="switchCity('holbaek'); toggleMobileMenu()" class="site-network-btn" style="background:#fff; color:var(--ink);"><span class="site-network-dot" style="background:#4F5B1E;"></span> Holbæk</button>
          <button onclick="switchCity('ringsted'); toggleMobileMenu()" class="site-network-btn" style="background:#fff; color:var(--ink);"><span class="site-network-dot" style="background:#8A5A00;"></span> Ringsted</button>
          <button onclick="switchCity('koege'); toggleMobileMenu()" class="site-network-btn" style="background:#fff; color:var(--ink);"><span class="site-network-dot" style="background:#24533A;"></span> Køge</button>
          <button onclick="switchCity('roskilde'); toggleMobileMenu()" class="site-network-btn" style="background:#fff; color:var(--ink);"><span class="site-network-dot" style="background:#6A3553;"></span> Roskilde</button>
          <button onclick="switchCity('kalundborg'); toggleMobileMenu()" class="site-network-btn" style="background:#fff; color:var(--ink);"><span class="site-network-dot" style="background:#0284C7;"></span> Kalundborg</button>
        </div>
      </div>

      <ul class="mobile-drawer-links">
        <li><a href="#forside" onclick="toggleMobileMenu()" class="mobile-drawer-link">Forside <span>→</span></a></li>
        <li><a href="#nyheder" onclick="toggleMobileMenu()" class="mobile-drawer-link">Nyheder <span>→</span></a></li>
        <li><a href="#erhverv" onclick="toggleMobileMenu()" class="mobile-drawer-link">Erhverv <span>→</span></a></li>
        <li><a href="#sport" onclick="toggleMobileMenu()" class="mobile-drawer-link">Sport <span>→</span></a></li>
        <li><a href="#kultur" onclick="toggleMobileMenu()" class="mobile-drawer-link">Kultur <span>→</span></a></li>
        <li><a href="#foreningsliv" onclick="toggleMobileMenu()" class="mobile-drawer-link">Foreningsliv <span>→</span></a></li>
        <li><a href="#debat" onclick="toggleMobileMenu()" class="mobile-drawer-link">Debat <span>→</span></a></li>
        <li><a href="#soeg" onclick="toggleMobileMenu()" class="mobile-drawer-link">Søg i artikler <span>🔍</span></a></li>
        <li><a href="#profil" onclick="toggleMobileMenu()" class="mobile-drawer-link">Min brugerprofil <span>👤</span></a></li>
        <li><a href="#priser" onclick="toggleMobileMenu()" class="mobile-drawer-link" style="color:var(--site-accent); font-weight:700;">Priser & Annoncering <span>🏷️</span></a></li>
        <li><a href="#indsend" onclick="toggleMobileMenu()" class="mobile-drawer-link">Tip os & Indsend <span>✍️</span></a></li>
        <li><a href="#stoet" onclick="toggleMobileMenu()" class="mobile-drawer-link" style="color:var(--site-accent); font-weight:700;"><span id="drawer-stoet-label">Støt medlemskab</span> <span>❤️</span></a></li>
      </ul>
    </div>
  </div>

  <!-- MAIN CONTENT CONTAINER -->
  <main class="site-container site-main-content">

    <!-- ============================================== -->
    <!-- SEKTION 1: FORSIDE & TOP GRID                  -->
    <!-- ============================================== -->
    <section id="forside" class="content-section">
      <!-- 3-COL TOP GRID -->
      <div class="site-top-3col-grid">
        <!-- Hero Card (Native image background via CSS) -->
        <a href="#art-storebaelt" class="site-hero-overlay-card">
          <div class="site-hero-bg-layer card-img-cover img-storebaelt"></div>
          <div class="site-hero-gradient"></div>
          <div class="site-hero-content">
            <div class="site-hero-top-meta" id="hero-meta-byline">Jonas Vestergaard · 2 t. siden</div>
            <span id="hero-kicker" class="site-hero-subkicker">BÆLTET · STOREBÆLT</span>
            <h1 id="hero-title" class="site-hero-title">Kødannelse på Storebæltsbroen i retning mod Fyn</h1>
            <p id="hero-manchet" class="site-hero-manchet">Et trafikuheld spærrer et spor på Storebæltsbroen. Bilister skal forvente længere rejsetid.</p>
            <div class="site-hero-actions-row">
              <span class="site-hero-btn-read">
                <span>Læs artiklen</span>
                <span style="font-size:14px; margin-left:3px;">→</span>
              </span>
              <span class="site-hero-live-badge">
                <span class="hero-live-dot"></span>
                <span>LIVE</span>
              </span>
            </div>
          </div>
        </a>

        <!-- Wire Card: Seneste nyt -->
        <aside class="site-wire-card">
          <div class="site-wire-header">
            <span style="font-family:var(--font-body); font-size:17px; font-weight:800; color:var(--ink);">Seneste nyt</span>
            <a href="#nyheder" style="font-size:13px; font-weight:700; color:var(--site-accent); text-decoration:none; display:inline-flex; align-items:center; gap:3px;">Se alle →</a>
          </div>
          <div id="wire-list-container" class="site-wire-list">
            <a href="#art-byraad" class="site-wire-item">
              <span class="site-wire-time">08:12</span>
              <p class="site-wire-headline">Nyt flertal på rådhuset vil investere 45 millioner i bymidten</p>
            </a>
            <a href="#art-sommerhuse" class="site-wire-item">
              <span class="site-wire-time">07:48</span>
              <p class="site-wire-headline">Flere sommerhuse udsat for indbrud ved Skælskør Næs</p>
            </a>
            <a href="#art-butik" class="site-wire-item">
              <span class="site-wire-time">06:32</span>
              <p class="site-wire-headline">Ny butikskæde åbner på Schweizerpladsen til foråret</p>
            </a>
            <a href="#art-sport" class="site-wire-item">
              <span class="site-wire-time">22:15</span>
              <p class="site-wire-headline">Slagelse B&I tager vigtig sejr i topopgøret på Harboe Arena</p>
            </a>
            <a href="#art-tudeaa" class="site-wire-item">
              <span class="site-wire-time">21:05</span>
              <p class="site-wire-headline">Stort naturprojekt ved Tude Å skal sikre mod oversvømmelser</p>
            </a>
          </div>
        </aside>

        <!-- Dit Nabolag Card -->
        <aside class="site-nabolag-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h2 style="font-family:var(--font-display); font-size:20px; font-weight:800;">Dit nabolag</h2>
            <span id="nabolag-kommune-tag" style="font-size:11.5px; color:var(--ink-3);">Slagelse Kommune</span>
          </div>
          <div class="site-nabolag-thumb">
            <div class="card-img-cover img-kort"></div>
          </div>
          <div id="nabolag-pills-container" class="site-nabolag-pills">
            <button onclick="setNabolagArea('Slagelse C', this)" class="site-nabolag-pill is-active">Slagelse C</button>
            <button onclick="setNabolagArea('Korsør', this)" class="site-nabolag-pill">Korsør</button>
            <button onclick="setNabolagArea('Skælskør', this)" class="site-nabolag-pill">Skælskør</button>
            <button onclick="setNabolagArea('Dalmose', this)" class="site-nabolag-pill">Dalmose</button>
            <button onclick="setNabolagArea('Vemmelev', this)" class="site-nabolag-pill">Vemmelev</button>
          </div>
          <div id="nabolag-box" style="font-size:13px; color:var(--ink-2); line-height:1.45; padding:10px; background:var(--surface-2); border-radius:var(--radius-sm);">
            <strong>Slagelse C:</strong> 4 nye byggeprojekter godkendt i bymidten. Håndværkere er i gang ved Nytorv.
          </div>
        </aside>
      </div>

      <!-- 3 MELLEM-KORT -->
      <div class="site-middle-3cards-grid">
        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb">
            <div class="card-img-cover img-bymidte"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">BYUDVIKLING & POLITIK</span>
            <h3 class="site-card-title">Nyt flertal på rådhuset vil investere 45 millioner i bymidten</h3>
            <p class="site-card-desc">Bredt flertal er enige om en historisk investering i handelsliv, grønne pladser og gågader.</p>
            <div class="site-card-meta">
              <span>Thomas Bach</span>
              <span>4 t. siden</span>
            </div>
          </div>
        </a>

        <a href="#art-sommerhuse" class="site-card">
          <div class="site-card-thumb">
            <div class="card-img-cover img-sommerhus"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">KRIMI & TRYGHED</span>
            <h3 class="site-card-title">Flere sommerhuse udsat for indbrud ved kysten</h3>
            <p class="site-card-desc">Politiet opfordrer sommerhusejere og naboer til øget årvågenhed efter stribe indbrud i weekenden.</p>
            <div class="site-card-meta">
              <span>Mette Lindegaard</span>
              <span>6 t. siden</span>
            </div>
          </div>
        </a>

        <a href="#art-butik" class="site-card">
          <div class="site-card-thumb">
            <div class="card-img-cover img-erhverv"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">ERHVERV & HANDEL</span>
            <h3 class="site-card-title">Ny butikskæde åbner: Vil puste liv i byens handelsliv</h3>
            <p class="site-card-desc">En nyskabende detailforretning med fokus på bæredygtighed slår dørene op til foråret.</p>
            <div class="site-card-meta">
              <span>Henrik Friis</span>
              <span>I dag</span>
            </div>
          </div>
        </a>
      </div>

      <!-- FÆLLESSKABSBANNER -->
      <div class="site-community-banner">
        <div>
          <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#A7F3D0; margin-bottom:6px; display:block;">FÆLLESSKABETS MEDIE</span>
          <h2 id="community-banner-title" class="site-community-title">Vær med til at præge SlagelseLokalt</h2>
          <p id="community-banner-desc" class="site-community-desc">
            Vores journalistik skabes i tæt samspil med hverdagen i kommunen. Vi finansieres og formes af borgerne og de lokale virksomheder – og vi modtager altid gerne dine idéer, spørgsmål og historier.
          </p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          <a href="#indsend" class="site-community-btn">Indsend historie / Tip</a>
          <a href="#stoet" class="site-community-btn" style="background:rgba(255,255,255,0.2); color:#FFFFFF; border:1px solid rgba(255,255,255,0.4);">Støt med valgfrit beløb</a>
        </div>
      </div>

      <!-- 4-GRID (MERE FRA OMRÅDET) -->
      <div class="site-4grid">
        <a href="#art-sport" class="site-card">
          <div class="site-card-thumb" style="height:140px;">
            <div class="card-img-cover img-fodbold"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">LOKALSPORT</span>
            <h3 class="site-card-title" style="font-size:16px;">Dramatisk overtidssejr på hjemmebane</h3>
            <p class="site-card-desc" style="font-size:13px;">Scoring i 93. minut sikrede tre point foran et ellevildt publikum.</p>
          </div>
        </a>

        <a href="#art-tudeaa" class="site-card">
          <div class="site-card-thumb" style="height:140px;">
            <div class="card-img-cover img-natur"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">NATUR & MILJØ</span>
            <h3 class="site-card-title" style="font-size:16px;">Nyt vådområde beskytter mod skybrud</h3>
            <p class="site-card-desc" style="font-size:13px;">Lavbundsjord omlægges for at mindske oversvømmelser og kvælstofudledning.</p>
          </div>
        </a>

        <a href="#art-debat" class="site-card">
          <div class="site-card-thumb" style="height:140px;">
            <div class="card-img-cover img-debat"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">DEBATINDLÆG</span>
            <h3 class="site-card-title" style="font-size:16px;">"Bevar byens grønne oaser"</h3>
            <p class="site-card-desc" style="font-size:13px;">Borger advarer mod for tæt bebyggelse ved de kystnære grønne arealer.</p>
          </div>
        </a>

        <a href="#art-foreningsliv" class="site-card">
          <div class="site-card-thumb" style="height:140px;">
            <div class="card-img-cover img-bymidte"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">FORENINGSLIV</span>
            <h3 class="site-card-title" style="font-size:16px;">120 frivillige hædret</h3>
            <p class="site-card-desc" style="font-size:13px;">Årets foreningsfest hyldede de ildsjæle, der skaber idræt og fællesskab.</p>
          </div>
        </a>
      </div>

      <!-- PARTNERE -->
      <div class="site-partners-box">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--ink-3);">Lokale støttepartnere</span>
          <a href="#stoet" style="font-size:12.5px; font-weight:700; color:var(--site-accent); transition:color 0.3s;">Vil din virksomhed også støtte? Bliv partner her →</a>
        </div>
        <div class="site-partners-logos">
          <span class="site-partner-badge">Harboe Bryggeri</span>
          <span class="site-partner-badge">Sparekassen Sjælland-Fyn</span>
          <span class="site-partner-badge">VKST Landbrugsrådgivning</span>
          <span class="site-partner-badge">Danbolig Erhverv</span>
          <span class="site-partner-badge">SuperBrugsen</span>
        </div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 2: NYHEDER                             -->
    <!-- ============================================== -->
    <section id="nyheder" class="content-section">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 id="section-nyheder-title" class="section-title">Nyheder fra Slagelse Kommune</h2>
        <p class="section-desc">Aktuelt overblik over politik, beredskab, infrastruktur og lokalsamfundet.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-storebaelt" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-storebaelt"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">TRAFIK</span>
            <h3 class="site-card-title">Kødannelse på Storebæltsbroen i retning mod Fyn</h3>
            <p class="site-card-desc">Trafikuheld skabte mandag formiddag lange køer. Trafikken afvikles nu i ét spor.</p>
            <div class="site-card-meta"><span>Trafik</span><span>I dag</span></div>
          </div>
        </a>

        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">POLITIK</span>
            <h3 class="site-card-title">45 millioner til fornyelse af bymidten</h3>
            <p class="site-card-desc">Nyt flertal på rådhuset investerer i handelslivet og gågaderne.</p>
            <div class="site-card-meta"><span>Rådhus</span><span>4 t. siden</span></div>
          </div>
        </a>

        <a href="#art-sommerhuse" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-sommerhus"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">KRIMI</span>
            <h3 class="site-card-title">Sommerhusindbrud ved kysten</h3>
            <p class="site-card-desc">Beboere og grundejerforening opfordres til øget årvågenhed.</p>
            <div class="site-card-meta"><span>Politi</span><span>6 t. siden</span></div>
          </div>
        </a>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 3: ERHVERV                             -->
    <!-- ============================================== -->
    <section id="erhverv" class="content-section">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 class="section-title">Erhverv & Handel</h2>
        <p class="section-desc">Lokale virksomheder, iværksættere, arbejdspladser og handelsliv i hele kommunen.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-butik" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-erhverv"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">DETAILHANDEL</span>
            <h3 class="site-card-title">Ny butikskæde åbner på handelsstrøget</h3>
            <p class="site-card-desc">Genanvendelse og lokalt kunsthåndværk rykker ind i tomme butikslokaler.</p>
            <div class="site-card-meta"><span>Handel</span><span>I dag</span></div>
          </div>
        </a>

        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">LOGISTIK</span>
            <h3 class="site-card-title">Erhvervspark ved motorvejen udvides markant</h3>
            <p class="site-card-desc">Stor efterspørgsel på erhvervsjord tæt ved transportkorridorerne.</p>
            <div class="site-card-meta"><span>Erhverv</span><span>2 dage siden</span></div>
          </div>
        </a>

        <a href="#art-sommerhuse" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-sommerhus"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">TURISME</span>
            <h3 class="site-card-title">Kystturismen melder om rekordhøj interesse</h3>
            <p class="site-card-desc">Restauranter og udlejere melder om stor interesse til højsæsonen.</p>
            <div class="site-card-meta"><span>Turisme</span><span>3 dage siden</span></div>
          </div>
        </a>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 4: SPORT                               -->
    <!-- ============================================== -->
    <section id="sport" class="content-section">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 class="section-title">Lokalsporten</h2>
        <p class="section-desc">Fodbold, håndbold, atletik, svømning og breddeidræt i hele kommunen.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-sport" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-fodbold"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">FODBOLD</span>
            <h3 class="site-card-title">Dramatisk overtidssejr i topopgøret</h3>
            <p class="site-card-desc">Mål i det 93. minut udløste jubel foran 1.100 tilskuere på hjemmebane.</p>
            <div class="site-card-meta"><span>Sport</span><span>I går</span></div>
          </div>
        </a>

        <a href="#art-tudeaa" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-natur"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">MOTION</span>
            <h3 class="site-card-title">Løbeklub klar til det store forårsløb</h3>
            <p class="site-card-desc">Over 400 tilmeldte motionister i de lokale skove og stier.</p>
            <div class="site-card-meta"><span>Motion</span><span>Søndag</span></div>
          </div>
        </a>

        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">SVØMNING</span>
            <h3 class="site-card-title">Svømmeklubben sætter fire nye klubrekorder</h3>
            <p class="site-card-desc">Guldmedaljer og personlige rekorder til de unge talenter.</p>
            <div class="site-card-meta"><span>Svømning</span><span>3 dage siden</span></div>
          </div>
        </a>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 5: KULTUR                              -->
    <!-- ============================================== -->
    <section id="kultur" class="content-section">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 class="section-title">Kultur & Oplevelser</h2>
        <p class="section-desc">Koncerter, teater, udstillinger, biblioteker og historiske seværdigheder.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-kultur" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">MUSIK & TEATER</span>
            <h3 class="site-card-title">Kulturhuset afslører stærkt forårsprogram</h3>
            <p class="site-card-desc">Pop, jazz og stand-up comedy gæster scenerne i byen.</p>
            <div class="site-card-meta"><span>Kultur</span><span>I dag</span></div>
          </div>
        </a>

        <a href="#art-sommerhuse" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-sommerhus"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">HISTORIE</span>
            <h3 class="site-card-title">Historiske herreborge åbner for offentligheden</h3>
            <p class="site-card-desc">Rundvisninger viser områdets unikke renæssancearv og kunstværker.</p>
            <div class="site-card-meta"><span>Historie</span><span>2 dage siden</span></div>
          </div>
        </a>

        <a href="#art-debat" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-debat"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">BØRN & FAMILIE</span>
            <h3 class="site-card-title">Gratis kreative workshops på bibliotekerne</h3>
            <p class="site-card-desc">Kreative værksteder og højtlæsning for børn og unge.</p>
            <div class="site-card-meta"><span>Bibliotek</span><span>Vinterferie</span></div>
          </div>
        </a>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 6: FORENINGSLIV                        -->
    <!-- ============================================== -->
    <section id="foreningsliv" class="content-section">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 class="section-title">Foreningsliv & Frivillighed</h2>
        <p class="section-desc">Menneskene, der driver vores fællesskaber og klubber.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-foreningsliv" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">FRIVILLIGHED</span>
            <h3 class="site-card-title">120 frivillige hædret ved årets foreningsfest</h3>
            <p class="site-card-desc">Borgmesteren overrakte priser til de ildsjæle, der skaber fællesskab.</p>
            <div class="site-card-meta"><span>Foreningsfest</span><span>I går</span></div>
          </div>
        </a>

        <a href="#art-tudeaa" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-natur"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">BORGERINITIATIV</span>
            <h3 class="site-card-title">Naturvennerne samler affald langs åen</h3>
            <p class="site-card-desc">Lokale familier ryddede stierne og sluttede af med bålkaffe.</p>
            <div class="site-card-meta"><span>Natur</span><span>Søndag</span></div>
          </div>
        </a>

        <a href="#art-debat" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-debat"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">HJÆLP HINANDEN</span>
            <h3 class="site-card-title">Frivilligcentret søger nye lektiehjælpere</h3>
            <p class="site-card-desc">Hjælp unge godt videre med skolegang og fritidsliv.</p>
            <div class="site-card-meta"><span>Frivillig</span><span>4 dage siden</span></div>
          </div>
        </a>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 7: DEBAT                               -->
    <!-- ============================================== -->
    <section id="debat" class="content-section">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 class="section-title">Debat & Holdninger</h2>
        <p class="section-desc">Ordet er frit for alle borgere og foreninger i kommunen.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-debat" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-debat"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">BORGERINDLÆG</span>
            <h3 class="site-card-title">"Vi skal bevare byens grønne åndehuller"</h3>
            <p class="site-card-desc">Lise Holm: Byggeri må ikke fjerne de sidste oaser langs kysten.</p>
            <div class="site-card-meta"><span>Debat</span><span>I dag</span></div>
          </div>
        </a>

        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">POLITISK REPLIK</span>
            <h3 class="site-card-title">"Investeringen i bymidten er nødvendig"</h3>
            <p class="site-card-desc">Byrådsmedlem Morten Nielsen om at styrke de fysiske handelsgader.</p>
            <div class="site-card-meta"><span>Politik</span><span>I går</span></div>
          </div>
        </a>

        <a href="#art-storebaelt" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-storebaelt"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">PENDLERDEBAT</span>
            <h3 class="site-card-title">"Pendlerne overses i transportplanerne"</h3>
            <p class="site-card-desc">Efterlysning af rimeligere bropas og bedre togforbindelser.</p>
            <div class="site-card-meta"><span>Pendler</span><span>2 dage siden</span></div>
          </div>
        </a>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 8: STØT (DUAL SUPPORT MODEL)           -->
    <!-- ============================================== -->
    <section id="stoet" class="content-section">
      <div class="support-card-container">
        <div style="text-align:center; max-width:600px; margin:0 auto 24px auto;">
          <span class="section-kicker">FÆLLESSKAB & STØTTE</span>
          <h2 id="support-section-title" style="font-family:var(--font-display); font-size:30px; font-weight:800; margin-bottom:8px;">Støt SlagelseLokalt</h2>
          <p id="support-section-desc" style="font-size:14.5px; color:var(--ink-2); line-height:1.5;">
            Vi formes og finansieres af borgerne og erhvervslivet i Slagelse Kommune. Vælg en fast pakke eller støt med et valgfrit beløb.
          </p>
        </div>

        <!-- Toggle mode -->
        <div class="support-mode-toggle">
          <div onclick="setSupportMode('fast')" id="tab-support-fast" class="support-toggle-btn is-active">Fast støttepakke</div>
          <div onclick="setSupportMode('valgfri')" id="tab-support-valgfri" class="support-toggle-btn">Valgfrit beløb</div>
        </div>

        <!-- Fast pakke -->
        <div id="support-pane-fast">
          <div class="support-plans-grid">
            <div onclick="selectPlan('Støtte', 49, this)" class="support-plan-card is-selected">
              <strong style="font-size:16px;">Støtte</strong>
              <div class="support-plan-price">49 kr. <span>/ md</span></div>
              <p style="font-size:12.5px; color:var(--ink-2); line-height:1.4; margin-bottom:12px;">Fri adgang og nyhedsbrev. Du holder journalistikken tilgængelig for alle.</p>
              <span style="font-size:11.5px; font-weight:700; color:var(--site-accent);">✓ Valgt</span>
            </div>

            <div onclick="selectPlan('Plus', 79, this)" class="support-plan-card">
              <strong style="font-size:16px;">Plus</strong>
              <div class="support-plan-price">79 kr. <span>/ md</span></div>
              <p style="font-size:12.5px; color:var(--ink-2); line-height:1.4; margin-bottom:12px;">Alt i Støtte + invitation til årlige redaktionsmøder og emnedialog.</p>
              <span style="font-size:11.5px; font-weight:700; color:var(--ink-3);">Populært valg</span>
            </div>

            <div onclick="selectPlan('Lokal Helt', 129, this)" class="support-plan-card">
              <strong style="font-size:16px;">Lokal Helt</strong>
              <div class="support-plan-price">129 kr. <span>/ md</span></div>
              <p style="font-size:12.5px; color:var(--ink-2); line-height:1.4; margin-bottom:12px;">Ekstra opbakning til dybdegående temaer i kommunen.</p>
              <span style="font-size:11.5px; font-weight:700; color:var(--ink-3);">Ekstra støtte</span>
            </div>
          </div>
        </div>

        <!-- Valgfrit beløb -->
        <div id="support-pane-valgfri" style="display:none;">
          <div style="margin-bottom:16px;">
            <div style="display:flex; gap:8px; margin-bottom:14px;">
              <button onclick="setCustomFreq('monthly')" id="btn-freq-monthly" class="custom-amt-btn is-active" style="flex:1;">Månedligt</button>
              <button onclick="setCustomFreq('once')" id="btn-freq-once" class="custom-amt-btn" style="flex:1;">Engangsbeløb</button>
            </div>
            <div class="custom-amt-grid">
              <button onclick="setCustomAmt(25)" class="custom-amt-btn">25 kr.</button>
              <button onclick="setCustomAmt(50)" class="custom-amt-btn is-active">50 kr.</button>
              <button onclick="setCustomAmt(100)" class="custom-amt-btn">100 kr.</button>
              <button onclick="setCustomAmt(250)" class="custom-amt-btn">250 kr.</button>
              <button onclick="setCustomAmt(500)" class="custom-amt-btn">500 kr.</button>
            </div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Eller indtast valgfrit beløb (kr.):</label>
            <input type="number" id="input-custom-amount" value="50" oninput="customInputChanged(this.value)" class="form-control" style="font-size:16px; font-weight:700;" min="10">
          </div>
        </div>

        <!-- Submit knap -->
        <button onclick="submitSupport()" id="btn-submit-support" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:13px; font-size:15px; border-radius:var(--radius-sm); margin-top:10px;">
          Støt med Støtte (49 kr. / md)
        </button>
        <div style="font-size:11.5px; color:var(--ink-3); text-align:center; margin-top:8px;">
          Betal nemt med MobilePay eller betalingskort. Ingen binding.
        </div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 8B: PRISER & ANNONCERING (INTRO 25 %)  -->
    <!-- ============================================== -->
    <section id="priser" class="content-section">
      <div class="section-header-box" style="background:#FFFFFF; border:1px solid var(--line); border-left:4px solid var(--site-accent); border-radius:var(--radius-lg); padding:28px 24px; margin-bottom:28px; box-shadow:var(--shadow-sm);">
        <div style="display:inline-flex; align-items:center; gap:6px; background:var(--site-accent-soft); color:var(--site-accent); padding:4px 12px; border-radius:999px; font-size:12px; font-weight:700; margin-bottom:12px;">
          <span>🎉 Særlige opstartspriser 2026 · 75 % introrabat ift. Min By Media</span>
        </div>
        <h2 id="price-section-title" class="section-title" style="font-size:30px; margin-bottom:8px;">
          Lokal synlighed til priser, alle kan være med på
        </h2>
        <p id="price-section-desc" class="section-desc" style="font-size:15px; max-width:820px; line-height:1.55;">
          På SlagelseLokalt skal markedsføring ikke koste en formue. Vores introrater starter på ca. <strong>25 % af de store bymediers priser</strong>.
          Til gengæld får du ægte lokal rækkevidde, professionelt journalistisk håndværk og <strong>fuld distribution på vores Facebook-side</strong> og i nyhedsbrevet — uden merpris.
        </p>
      </div>

      <!-- 4 ENKELTSTÅENDE PRODUKTER -->
      <div style="margin-bottom:24px;">
        <span class="section-kicker">ENKELTPRODUKTER</span>
        <h3 style="font-family:var(--font-display); font-size:22px; font-weight:800; color:var(--ink); margin:2px 0 16px 0;">
          Vælg dit format og kom i gang
        </h3>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:18px; margin-bottom:36px;">
        <!-- 1. Event i kalenderen -->
        <div style="background:#FFFFFF; border:1px solid var(--line); border-radius:var(--radius-md); padding:22px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-sm);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:12px; font-weight:700; color:var(--site-accent); text-transform:uppercase;">Kalender</span>
              <span style="font-size:11px; font-weight:700; background:#FEF3C7; color:#92400E; padding:2px 8px; border-radius:999px;">Laveste pris</span>
            </div>
            <h4 style="font-size:18px; font-weight:800; color:var(--ink); margin-bottom:6px;">Event i kalenderen</h4>
            <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:6px;">
              <span style="font-size:28px; font-weight:800; color:var(--ink);">125 kr.</span>
              <span style="font-size:12px; color:var(--ink-3);">ex. moms</span>
            </div>
            <div style="font-size:11.5px; color:var(--ink-3); text-decoration:line-through; margin-bottom:12px;">Min By pris: 499 kr.</div>
            <p style="font-size:13px; color:var(--ink-2); line-height:1.45; margin-bottom:14px;">
              Få dit arrangement vist i kommunens kalender &quot;Det Sker&quot; med dato, tid, billede og direkte billetlink.
            </p>
            <ul style="padding-left:18px; font-size:12.5px; color:var(--ink-2); line-height:1.5; margin-bottom:14px;">
              <li>Visning i Det Sker kalenderen</li>
              <li>Omtale i ugens weekend-guide</li>
              <li><strong>Gratis for ikke-kommercielle foreninger</strong></li>
            </ul>
          </div>
          <button onclick="selectPriceProduct('event')" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:10px; font-size:13px; border-radius:var(--radius-sm);">
            Opret event (125 kr.) →
          </button>
        </div>

        <!-- 2. Sponsoreret artikel -->
        <div style="background:#FFFFFF; border:2px solid var(--site-accent); border-radius:var(--radius-md); padding:22px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-md); position:relative;">
          <div style="position:absolute; top:-10px; right:16px; background:var(--site-accent); color:#fff; font-size:10.5px; font-weight:700; padding:2px 10px; border-radius:999px;">
            Mest populære
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:12px; font-weight:700; color:var(--site-accent); text-transform:uppercase;">Native Artikel</span>
              <span style="font-size:11px; font-weight:700; background:var(--site-accent-soft); color:var(--site-accent); padding:2px 8px; border-radius:999px;">Spar 80 %</span>
            </div>
            <h4 style="font-size:18px; font-weight:800; color:var(--ink); margin-bottom:6px;">Sponsoreret artikel</h4>
            <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:6px;">
              <span style="font-size:28px; font-weight:800; color:var(--ink);">4.995 kr.</span>
              <span style="font-size:12px; color:var(--ink-3);">samlet pakke</span>
            </div>
            <div style="font-size:11.5px; color:var(--ink-3); text-decoration:line-through; margin-bottom:12px;">Min By pris: 25.995 - 33.995 kr.</div>
            <p style="font-size:13px; color:var(--ink-2); line-height:1.45; margin-bottom:14px;">
              En professionelt skrevet profilartikel om din virksomhed, nye åbning, jubilæum eller grønne omstilling.
            </p>
            <ul style="padding-left:18px; font-size:12.5px; color:var(--ink-2); line-height:1.5; margin-bottom:14px;">
              <li>Journalistisk interview & vinkling</li>
              <li>Professionel fotoserie</li>
              <li>Placering på forsiden og i Erhverv</li>
              <li><strong>Delt direkte på vores Facebook-side</strong></li>
              <li>Omtale i det ugentlige nyhedsbrev</li>
            </ul>
          </div>
          <button onclick="selectPriceProduct('sponsor')" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:10px; font-size:13px; border-radius:var(--radius-sm);">
            Bestil artikel (4.995 kr.) →
          </button>
        </div>

        <!-- 3. Profil i guiden -->
        <div style="background:#FFFFFF; border:1px solid var(--line); border-radius:var(--radius-md); padding:22px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-sm);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:12px; font-weight:700; color:var(--site-accent); text-transform:uppercase;">Lokalguide</span>
              <span style="font-size:11px; font-weight:700; background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:999px;">Abonnement</span>
            </div>
            <h4 style="font-size:18px; font-weight:800; color:var(--ink); margin-bottom:6px;">Profil i Lokalguiden</h4>
            <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:6px;">
              <span style="font-size:28px; font-weight:800; color:var(--ink);">249 kr.</span>
              <span style="font-size:12px; color:var(--ink-3);">/ måned</span>
            </div>
            <div style="font-size:11.5px; color:var(--ink-3); text-decoration:line-through; margin-bottom:12px;">Min By pris: 995 kr./md.</div>
            <p style="font-size:13px; color:var(--ink-2); line-height:1.45; margin-bottom:14px;">
              Fast præsentation i Spise- & Erhvervsguiden for restauranter, butikker, caféer og lokale håndværkere.
            </p>
            <ul style="padding-left:18px; font-size:12.5px; color:var(--ink-2); line-height:1.5; margin-bottom:14px;">
              <li>Flot profilside med logo og fotos</li>
              <li>Åbningstider, adresse og Google-kort</li>
              <li>Direkte booking-knap eller telefonlink</li>
              <li>Ingen binding — opsig når du vil</li>
            </ul>
          </div>
          <button onclick="selectPriceProduct('sponsor')" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:10px; font-size:13px; border-radius:var(--radius-sm);">
            Kom i guiden (249 kr./md) →
          </button>
        </div>

        <!-- 4. Nyhedsbrevssponsorat -->
        <div style="background:#FFFFFF; border:1px solid var(--line); border-radius:var(--radius-md); padding:22px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-sm);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-size:12px; font-weight:700; color:var(--site-accent); text-transform:uppercase;">Nyhedsbrev</span>
              <span style="font-size:11px; font-weight:700; background:#F3E8FF; color:#7E22CE; padding:2px 8px; border-radius:999px;">Høj rækkevidde</span>
            </div>
            <h4 style="font-size:18px; font-weight:800; color:var(--ink); margin-bottom:6px;">Ugens Sponsorat</h4>
            <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:6px;">
              <span style="font-size:28px; font-weight:800; color:var(--ink);">895 kr.</span>
              <span style="font-size:12px; color:var(--ink-3);">/ uge</span>
            </div>
            <div style="font-size:11.5px; color:var(--ink-3); text-decoration:line-through; margin-bottom:12px;">Min By pris: 4.995 kr./uge</div>
            <p style="font-size:13px; color:var(--ink-2); line-height:1.45; margin-bottom:14px;">
              Eksklusiv topplacering i fredagsnyhedsbrevet sendt direkte ud i indbakken hos byens aktive borgere.
            </p>
            <ul style="padding-left:18px; font-size:12.5px; color:var(--ink-2); line-height:1.5; margin-bottom:14px;">
              <li>Topbanner eller redaktionel shout-out</li>
              <li>Direkte link og sporbare kliks</li>
              <li>Kun 1 sponsor pr. uge for maksimal opmærksomhed</li>
            </ul>
          </div>
          <button onclick="selectPriceProduct('sponsor')" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:10px; font-size:13px; border-radius:var(--radius-sm);">
            Book uge (895 kr.) →
          </button>
        </div>
      </div>

      <!-- FASTE PARTNERSKABSPAKKER -->
      <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:var(--radius-lg); padding:28px 24px; margin-bottom:28px;">
        <div style="margin-bottom:16px;">
          <span class="section-kicker">HELÅRLIGT SAMARBEJDE</span>
          <h3 style="font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--ink); margin:2px 0 6px 0;">
            Faste partnerskaber for lokale virksomheder
          </h3>
          <p style="font-size:14px; color:var(--ink-2); margin:0;">
            Vil I bakke fast op om lokaljournalistikken og have kontinuerlig synlighed året rundt? Vælg mellem tre niveauer:
          </p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:16px;">
          <div style="background:#FFFFFF; border:1px solid var(--line); padding:20px; border-radius:var(--radius-md);">
            <strong style="font-size:17px; color:var(--ink); display:block; margin-bottom:4px;">1. Naboskab</strong>
            <div style="font-size:12px; color:var(--ink-3); margin-bottom:10px;">Håndværkere og butikker</div>
            <div style="font-size:22px; font-weight:800; color:var(--ink); margin-bottom:10px;">795 kr. <span style="font-size:12px; font-weight:500; color:var(--ink-3);">/ md</span></div>
            <ul style="padding-left:16px; font-size:12px; color:var(--ink-2); line-height:1.55; margin-bottom:14px;">
              <li><strong>2 sponsorerede artikler</strong> årligt</li>
              <li>Logo i partnersektionen på sitet</li>
              <li>4 opslag på mediets sociale medier</li>
              <li>Omtale i kvartalsvis Erhvervsguide</li>
            </ul>
            <button onclick="selectPriceProduct('sponsor')" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:8px; font-size:12.5px; border-radius:var(--radius-sm);">Vælg Naboskab →</button>
          </div>

          <div style="background:#FFFFFF; border:2px solid var(--site-accent); padding:20px; border-radius:var(--radius-md); position:relative;">
            <div style="position:absolute; top:-9px; right:14px; background:var(--site-accent); color:#fff; font-size:10px; font-weight:700; padding:1px 8px; border-radius:999px;">Anbefalet</div>
            <strong style="font-size:17px; color:var(--ink); display:block; margin-bottom:4px;">2. Fællesskab</strong>
            <div style="font-size:12px; color:var(--ink-3); margin-bottom:10px;">Mellemstore virksomheder & mæglere</div>
            <div style="font-size:22px; font-weight:800; color:var(--ink); margin-bottom:10px;">1.995 kr. <span style="font-size:12px; font-weight:500; color:var(--ink-3);">/ md</span></div>
            <ul style="padding-left:16px; font-size:12px; color:var(--ink-2); line-height:1.55; margin-bottom:14px;">
              <li><strong>4 sponsorerede artikler</strong> årligt</li>
              <li><strong>1 videoproduktion (Reels/video)</strong></li>
              <li>8 delinger på Facebook og LinkedIn</li>
              <li>Fast roterende logo på forsiden</li>
              <li>Kvartalsvist statusmøde med redaktionen</li>
            </ul>
            <button onclick="selectPriceProduct('sponsor')" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:8px; font-size:12.5px; border-radius:var(--radius-sm);">Vælg Fællesskab →</button>
          </div>

          <div style="background:#FFFFFF; border:1px solid var(--line); padding:20px; border-radius:var(--radius-md);">
            <strong style="font-size:17px; color:var(--ink); display:block; margin-bottom:4px;">3. Fyrtårn</strong>
            <div style="font-size:12px; color:var(--ink-3); margin-bottom:10px;">Banker, energi & større aktører</div>
            <div style="font-size:22px; font-weight:800; color:var(--ink); margin-bottom:10px;">4.495 kr. <span style="font-size:12px; font-weight:500; color:var(--ink-3);">/ md</span></div>
            <ul style="padding-left:16px; font-size:12px; color:var(--ink-2); line-height:1.55; margin-bottom:14px;">
              <li><strong>8 sponsorerede artikler</strong> årligt</li>
              <li><strong>2 professionelle videoproduktioner</strong></li>
              <li>Permanent logo på forsiden</li>
              <li>Månedlig omtale i nyhedsbrevet</li>
              <li>Mulighed for dækning i hele Sjællands-netværket</li>
            </ul>
            <button onclick="selectPriceProduct('sponsor')" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:8px; font-size:12.5px; border-radius:var(--radius-sm);">Vælg Fyrtårn →</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 9: TIP OS & DELTAGELSE (4 SPOR)        -->
    <!-- ============================================== -->
    <section id="indsend" class="content-section">
      <div class="support-card-container">
        <span class="section-kicker">BORGER & ERHVERV</span>
        <h2 style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:8px;">Tip redaktionen & Vær med</h2>
        <p style="font-size:14px; color:var(--ink-2); line-height:1.5; margin-bottom:20px;">
          Lokaljournalistik skabes i tæt samspil med dig. Vælg herunder hvad din henvendelse drejer sig om:
        </p>

        <!-- 4-Mode Selector Tabs -->
        <div class="tip-mode-tabs">
          <button type="button" onclick="switchTipMode('tip')" id="tab-tip-tip" class="tip-tab-btn is-active">🚨 Giv et tip</button>
          <button type="button" onclick="switchTipMode('event')" id="tab-tip-event" class="tip-tab-btn">📅 Arrangement</button>
          <button type="button" onclick="switchTipMode('sponsor')" id="tab-tip-sponsor" class="tip-tab-btn">💼 Sponsoreret artikel</button>
          <button type="button" onclick="switchTipMode('citat')" id="tab-tip-citat" class="tip-tab-btn">💬 Giv et citat</button>
        </div>

        <!-- 1. SPOR: GIV ET TIP -->
        <form id="form-tip-tip" onsubmit="event.preventDefault(); submitTipMode('tip');" style="display:flex; flex-direction:column; gap:14px;">
          <div style="background:var(--surface-2); padding:12px 14px; border-radius:var(--radius-sm); font-size:13px; color:var(--ink-2); border-left:3px solid var(--site-accent);">
            🚨 <strong>Har du set eller hørt noget?</strong> Uheld, vejrudsigter, akutte hændelser eller tip om sager, redaktionen bør undersøge. Fuld kildebeskyttelse jf. medieansvarsloven.
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Hvad handler tippet om? *</label>
            <input type="text" class="form-control" id="tip-headline" placeholder="F.eks. Trafikprop ved broen, vandstigning eller byggerod..." required>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Hvor skete det? *</label>
              <input type="text" class="form-control" id="tip-place" placeholder="F.eks. Korsør Havn eller Nytorv" required>
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Hvornår? *</label>
              <input type="text" class="form-control" id="tip-time" placeholder="F.eks. Netop nu el. i morges kl. 8" required>
            </div>
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Beskrivelse af hændelsen *</label>
            <textarea class="form-control" id="tip-desc" rows="3" placeholder="Beskriv hvad du har set, hørt eller oplevet..." required></textarea>
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink-2); cursor:pointer;">
            <input type="checkbox" id="tip-anon" checked style="accent-color:var(--site-accent); width:16px; height:16px;">
            <span>Jeg ønsker kildebeskyttelse / anonymitet over for offentligheden</span>
          </label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <input type="text" class="form-control" id="tip-user-name" placeholder="Dit navn" required>
            <input type="text" class="form-control" id="tip-user-contact" placeholder="Tlf. eller e-mail (kun til redaktionen)" required>
          </div>
          <button type="submit" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:12px; font-size:14px; border-radius:var(--radius-sm);">
            Send tip til redaktionen
          </button>
        </form>

        <!-- 2. SPOR: INDSEND ARRANGEMENT -->
        <form id="form-tip-event" onsubmit="event.preventDefault(); submitTipMode('event');" style="display:none; flex-direction:column; gap:14px;">
          <div style="background:var(--surface-2); padding:12px 14px; border-radius:var(--radius-sm); font-size:13px; color:var(--ink-2); border-left:3px solid var(--site-accent);">
            📅 <strong>Få jeres arrangement i den lokale kalender:</strong> Koncerter, foreningsmøder, teater, loppemarkeder og bylaugsmøder i hele kommunen.
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Arrangementets titel *</label>
            <input type="text" class="form-control" id="event-title" placeholder="F.eks. Forårskoncert på Torvet eller Loppemarked på havnen" required>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Dato og starttidspunkt *</label>
              <input type="text" class="form-control" id="event-datetime" placeholder="F.eks. Lørdag 25. april kl. 14:00" required>
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Sted / Adresse *</label>
              <input type="text" class="form-control" id="event-location" placeholder="F.eks. Schweizerpladsen eller Kulturhuset" required>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Arrangør / Forening *</label>
              <input type="text" class="form-control" id="event-organizer" placeholder="F.eks. Slagelse Musikforening" required>
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Entré / Billetpris</label>
              <input type="text" class="form-control" id="event-price" placeholder="F.eks. Gratis adgang eller 50 kr.">
            </div>
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Kort beskrivelse af programmet *</label>
            <textarea class="form-control" id="event-desc" rows="3" placeholder="Hvad kan gæsterne opleve?" required></textarea>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <input type="text" class="form-control" id="event-contact-name" placeholder="Kontaktperson" required>
            <input type="text" class="form-control" id="event-link" placeholder="Evt. billetlink el. hjemmeside">
          </div>
          <button type="submit" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:12px; font-size:14px; border-radius:var(--radius-sm);">
            Indsend arrangement til kalenderen
          </button>
        </form>

        <!-- 3. SPOR: SPONSORERET ARTIKEL -->
        <form id="form-tip-sponsor" onsubmit="event.preventDefault(); submitTipMode('sponsor');" style="display:none; flex-direction:column; gap:14px;">
          <div style="background:var(--surface-2); padding:12px 14px; border-radius:var(--radius-sm); font-size:13px; color:var(--ink-2); border-left:3px solid var(--site-accent);">
            💼 <strong>Fortæl din virksomheds historie med troværdighed:</strong> En sponsoreret artikel giver jer en professionelt skrevet profilartikel på forsiden og i relevante sektioner, tydeligt mærket med <code>◆ FINANSIERET AF...</code>.
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Virksomhedens navn *</label>
              <input type="text" class="form-control" id="sponsor-company" placeholder="F.eks. Slagelse El & Energi A/S" required>
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Kontaktperson *</label>
              <input type="text" class="form-control" id="sponsor-contact-name" placeholder="F.eks. Henrik Nielsen" required>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">E-mailadresse *</label>
              <input type="email" class="form-control" id="sponsor-email" placeholder="kontakt@virksomhed.dk" required>
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Telefonnummer *</label>
              <input type="tel" class="form-control" id="sponsor-phone" placeholder="+45 20 12 34 56" required>
            </div>
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Anledning & Nøglebudskaber *</label>
            <textarea class="form-control" id="sponsor-message" rows="3" placeholder="F.eks. Jubilæum, ny afdeling, rekruttering af lærlinge eller grønne tiltag..." required></textarea>
          </div>
          <button type="submit" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:12px; font-size:14px; border-radius:var(--radius-sm);">
            Send forespørgsel om sponsoreret artikel
          </button>
        </form>

        <!-- 4. SPOR: GIV ET CITAT -->
        <form id="form-tip-citat" onsubmit="event.preventDefault(); submitTipMode('citat');" style="display:none; flex-direction:column; gap:14px;">
          <div style="background:var(--surface-2); padding:12px 14px; border-radius:var(--radius-sm); font-size:13px; color:var(--ink-2); border-left:3px solid var(--site-accent);">
            💬 <strong>Giv et citat med til en aktuel sag:</strong> Hvad mener du som lokal borger? Send os dit citat, så redaktionen kan tage din stemme med, når vi skriver om emnet.
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Hvilket emne eller sag udtaler du dig om? *</label>
            <select class="form-control" id="citat-topic" required>
              <option value="Storebælt & Pendling">Trafik og Storebæltsbroen</option>
              <option value="Bymidteinvestering på 45 mio.">De 45 mio. kr. til fornyelse af bymidten</option>
              <option value="Kystbeskyttelse & Natur">Kystbeskyttelse og Tude Å vådområdet</option>
              <option value="Tryghed & Sommerhuse">Sommerhusindbrud og lokal tryghed</option>
              <option value="Lokalsport & Idræt">Sport, faciliteter og Harboe Arena</option>
              <option value="Andet lokalt emne">Andet lokalt emne (skriv nedenfor)</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Dit citat — hvad vil du gerne sige? *</label>
            <textarea class="form-control" id="citat-text" rows="3" placeholder="F.eks. 'Det er afgørende, at man tænker på de små butikker, når gågaden graves op...' eller 'Pendlerne bliver ofte overset...'" required></textarea>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Dit fulde navn *</label>
              <input type="text" class="form-control" id="citat-author" placeholder="F.eks. Lise Holm" required>
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Bydel / By i kommunen *</label>
              <input type="text" class="form-control" id="citat-city-part" placeholder="F.eks. Korsør, Slagelse eller Skælskør" required>
            </div>
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink-2); cursor:pointer;">
            <input type="checkbox" id="citat-consent" checked required style="accent-color:var(--site-accent); width:16px; height:16px;">
            <span>Jeg giver samtykke til, at redaktionen må bringe mit citat med navn og bydel i redaktionelle artikler</span>
          </label>
          <button type="submit" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:12px; font-size:14px; border-radius:var(--radius-sm);">
            Indsend citat til redaktionen
          </button>
        </form>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 10: SØG                                -->
    <!-- ============================================== -->
    <section id="soeg" class="content-section">
      <div class="search-container">
        <span class="section-kicker">ARKIV</span>
        <h2 style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:12px;">Søg i artikler</h2>
        <div style="position:relative; margin-bottom:16px;">
          <input type="text" id="search-input" oninput="runLiveSearch(this.value)" placeholder="Søg f.eks. Storebælt, byråd, erhverv, sport..." class="search-input-field">
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px;">
          <button onclick="setSearchTerm('Storebælt')" class="site-subnav-pill">Storebælt</button>
          <button onclick="setSearchTerm('Byråd')" class="site-subnav-pill">Byråd</button>
          <button onclick="setSearchTerm('Erhverv')" class="site-subnav-pill">Erhverv</button>
          <button onclick="setSearchTerm('Sport')" class="site-subnav-pill">Sport</button>
        </div>
        <div id="search-results-list" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 11: BRUGERPROFIL FOR LÆSERE            -->
    <!-- ============================================== -->
    <section id="profil" class="content-section">
      <div class="support-card-container">
        <span class="section-kicker">LÆSERKONTO</span>
        <h2 style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:8px;">Min Brugerprofil</h2>
        <p style="font-size:14px; color:var(--ink-2); line-height:1.5; margin-bottom:20px;">
          Her kan du administrere dine præferencer, lokalområder, nyhedsbreve og gemte artikler.
        </p>

        <!-- Profil Hovedkort -->
        <div style="background:#FFFFFF; border:1px solid var(--line); border-radius:var(--radius-md); padding:20px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:52px; height:52px; border-radius:50%; background:var(--site-accent-soft); color:var(--site-accent); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700;">
              👤
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <strong id="profile-display-name" style="font-size:18px; color:var(--ink);">Lokal Læser</strong>
                <span style="font-size:11px; font-weight:700; background:var(--surface-2); color:var(--ink-2); padding:2px 8px; border-radius:999px;">Læser</span>
              </div>
              <div id="profile-display-area" style="font-size:13px; color:var(--ink-2); margin-top:2px;">Slagelse · Fri læseradgang</div>
            </div>
          </div>
          <button onclick="toggleProfileEdit()" id="btn-edit-profile" class="site-subnav-pill" style="border:1px solid var(--line); font-weight:700;">
            ✏️ Redigér profil
          </button>
        </div>

        <!-- Redigér formular (skjult default) -->
        <div id="profile-edit-box" style="display:none; background:var(--surface-2); border:1px solid var(--line); border-radius:var(--radius-md); padding:18px; margin-bottom:18px;">
          <div style="font-size:14px; font-weight:700; margin-bottom:10px;">Opdatér dine oplysninger</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Dit navn</label>
              <input type="text" id="input-profile-name" value="Lokal Læser" class="form-control">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Dit lokalområde</label>
              <input type="text" id="input-profile-area" value="Slagelse By" class="form-control">
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button onclick="toggleProfileEdit()" style="padding:7px 14px; font-size:12.5px; border-radius:var(--radius-sm); border:1px solid var(--line); background:#fff;">Annullér</button>
            <button onclick="saveProfile()" class="site-header-btn-stoet" style="padding:7px 16px; font-size:12.5px; border-radius:var(--radius-sm);">Gem oplysninger</button>
          </div>
        </div>

        <!-- 2 Bokse: Følg emner & Nyhedsbreve -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-bottom:18px;">
          <div style="background:#FFFFFF; border:1px solid var(--line); border-radius:var(--radius-md); padding:18px;">
            <div style="font-size:14.5px; font-weight:700; color:var(--ink); margin-bottom:8px;">🏷️ Følg emner</div>
            <p style="font-size:12.5px; color:var(--ink-2); line-height:1.4; margin-bottom:12px;">
              Vælg hvilke emner du vil have fremhævet på forsiden:
            </p>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              <span class="site-subnav-pill is-active" style="font-size:12px; padding:4px 10px;">✓ Trafik & Broen</span>
              <span class="site-subnav-pill is-active" style="font-size:12px; padding:4px 10px;">✓ Byråd & Politik</span>
              <span class="site-subnav-pill" style="font-size:12px; padding:4px 10px;">+ Erhverv</span>
              <span class="site-subnav-pill" style="font-size:12px; padding:4px 10px;">+ Lokalsport</span>
              <span class="site-subnav-pill" style="font-size:12px; padding:4px 10px;">+ Kultur</span>
            </div>
          </div>

          <div style="background:#FFFFFF; border:1px solid var(--line); border-radius:var(--radius-md); padding:18px;">
            <div style="font-size:14.5px; font-weight:700; color:var(--ink); margin-bottom:8px;">📬 Nyhedsbreve</div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--ink-2);">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" checked style="accent-color:var(--site-accent);">
                <span>Morgenoverblik (hverdage kl. 07)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" checked style="accent-color:var(--site-accent);">
                <span>Weekendguide (fredag kl. 14)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" style="accent-color:var(--site-accent);">
                <span>Akutte advarsler (kun ved breaking)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 3. Støttestatus & Meddeler -->
        <div style="background:#FFFFFF; border:1px solid var(--line); border-radius:var(--radius-md); padding:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
          <div>
            <div style="font-size:14px; font-weight:700; color:var(--ink);">❤️ Støt lokaljournalistikken</div>
            <div style="font-size:12.5px; color:var(--ink-2); margin-top:2px;">Aktuel status: Gratis læserkonto. Bak op fra 49 kr./md.</div>
          </div>
          <a href="#stoet" class="site-header-btn-stoet" style="font-size:12.5px; padding:7px 14px; border-radius:var(--radius-sm); text-decoration:none;">
            Se støttemuligheder →
          </a>
        </div>

        <!-- Diskret redaktionslogin info -->
        <div style="border-top:1px solid var(--line); padding-top:14px; font-size:12px; color:var(--ink-3); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span>Er du ansat på redaktionen eller journalist?</span>
          <span style="font-weight:600; color:var(--ink-2);">Redaktionel adgang: /redaktion</span>
        </div>
      </div>
    </section>

    <!-- ========================================================= -->
    <!-- SEKTION 11: DEDIKEREDE ARTIKLER (FULD SCROLLBARHED)       -->
    <!-- ========================================================= -->

    <!-- ARTIKEL: STOREBÆLT -->
    <article id="art-storebaelt" class="article-full-page">
      <div class="article-top-nav-bar">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <span style="font-size:12px; font-weight:700; color:var(--ink-3);">Trafik & Beredskab</span>
      </div>
      <span class="section-kicker">TRAFIK · STOREBÆLT</span>
      <h1 class="article-heading">Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld</h1>
      <p class="article-lead">Et trafikuheld med to biler spærrer det ene spor på Storebæltsbroen. Bilister skal forvente ekstra rejsetid.</p>
      <div class="article-byline-bar">
        <div>Af <strong>Jonas Vestergaard</strong> · Lokaljournalist</div>
        <div>Publiceret: I dag kl. 09:14 · 3 min. læsetid</div>
      </div>
      <div class="article-hero-box"><div class="card-img-cover img-storebaelt"></div></div>
      <div class="article-prose">
        <p>Vagtchefen ved Sydsjællands og Lolland-Falsters Politi oplyser, at uheldet skete omkring klokken 08.45 lige før højbroen i vestgående retning mod Fyn. Der er tale om et harmonikasammenstød med to personbiler under den tætte morgentrafik.</p>
        <p>Ingen personer er kommet alvorligt til skade, men vragdele og en mindre olielækage har gjort det nødvendigt midlertidigt at lukke det højre spor, mens Falck og Vejdirektoratet arbejder på stedet.</p>
        <blockquote class="article-pullquote">"Vi forventer, at oprydningsarbejdet er afsluttet før middag, men der er fortsat kødannelse tilbage mod Korsør."</blockquote>
        <div class="article-faktaboks">
          <div class="article-faktaboks-title">Fakta om Storebæltsbroen</div>
          <ul style="padding-left:18px; font-size:13.5px; color:var(--ink-2); line-height:1.6;">
            <li>Omkring 36.000 køretøjer passerer forbindelsen dagligt.</li>
            <li>Aktuel status: 1 spor farbart i vestgående retning med 50 km/t hastighedsbegrænsning.</li>
            <li>Trafikanter rådes til at følge P4 Trafik og Sund & Bælts hjemmeside.</li>
          </ul>
        </div>
        <p>Politiet opfordrer alle bilister til at udvise tålmodighed, holde behørig afstand og undgå at kigge på uheldsstedet under forbikørsel.</p>
      </div>
      <div class="article-bottom-actions">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <a href="#stoet" class="site-header-btn-stoet">Støt den lokale dækning</a>
      </div>
    </article>

    <!-- ARTIKEL: BYRÅD -->
    <article id="art-byraad" class="article-full-page">
      <div class="article-top-nav-bar">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <span style="font-size:12px; font-weight:700; color:var(--ink-3);">Politik & Byudvikling</span>
      </div>
      <span class="section-kicker">POLITIK & BYMIDTE</span>
      <h1 class="article-heading">Nyt flertal på rådhuset vil investere 45 millioner i bymidten</h1>
      <p class="article-lead">En historisk investering over de næste tre år skal skabe fornyelse af gågaderne og handelslivet i kommunen.</p>
      <div class="article-byline-bar">
        <div>Af <strong>Thomas Bach</strong> · Rådhusreporter</div>
        <div>Publiceret: I dag kl. 08:12 · 4 min. læsetid</div>
      </div>
      <div class="article-hero-box"><div class="card-img-cover img-bymidte"></div></div>
      <div class="article-prose">
        <p>Efter måneders forhandlinger er et bredt flertal i byrådet blevet enige om en stor fornyelsespakke til bymidten. Målet er at modvirke butiksdød, skabe flere grønne opholdsarealer og gøre det mere attraktivt at handle lokalt.</p>
        <p>Aftalen indeholder blandt andet midler til modernisering af belægningen på torvet, etablering af nye byhaver med bænke samt en markant opgradering af gadebelysningen.</p>
        <blockquote class="article-pullquote">"Vi vil have en levende bymidte med liv, handel og kulturoplevelser frem for tomme facader."</blockquote>
        <div class="article-faktaboks">
          <div class="article-faktaboks-title">Hovedpunkter i bymidteplanen</div>
          <ul style="padding-left:18px; font-size:13.5px; color:var(--ink-2); line-height:1.6;">
            <li>Samlet budget: 45 mio. kr. over årene 2026-2028.</li>
            <li>Nytorv og tilstødende gågader renoveres med natursten og træbeplantning.</li>
            <li>Etablering af gratis korttidsparkering for at styrke detailhandlen.</li>
          </ul>
        </div>
        <p>Arbejdet forventes igangsat til foråret og vil blive udført i etaper for at genere handelslivet mindst muligt.</p>
      </div>
      <div class="article-bottom-actions">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <a href="#debat" class="site-header-btn-stoet">Deltag i debatten</a>
      </div>
    </article>

    <!-- ARTIKEL: SOMMERHUSE -->
    <article id="art-sommerhuse" class="article-full-page">
      <div class="article-top-nav-bar">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <span style="font-size:12px; font-weight:700; color:var(--ink-3);">Krimi & Tryghed</span>
      </div>
      <span class="section-kicker">KRIMI & TRYGHED</span>
      <h1 class="article-heading">Flere sommerhuse udsat for indbrud langs kysten</h1>
      <p class="article-lead">Beboere og grundejerforening opfordres til årvågenhed efter nattens indbrud i weekenden.</p>
      <div class="article-byline-bar">
        <div>Af <strong>Mette Lindegaard</strong> · Kriminalreporter</div>
        <div>Publiceret: I dag kl. 07:48 · 3 min. læsetid</div>
      </div>
      <div class="article-hero-box"><div class="card-img-cover img-sommerhus"></div></div>
      <div class="article-prose">
        <p>Gerningsmændene har slået til mod mindst fire sommerhuse i weekenden. De er gået efter designmøbler, el-værktøj og elektronik, mens husene har stået tomme i vinterkulden.</p>
        <p>Lokalpolitiet efterlyser vidner, der måtte have set mistænkelige varebiler i området sent fredag eller lørdag aften.</p>
        <blockquote class="article-pullquote">"Vi opfordrer alle sommerhusejere til at tilmelde sig Nabohjælp og fjerne værdigenstande, når huset forlades."</blockquote>
        <p>Grundejerforeningen overvejer nu i samarbejde med politiet at opsætte midlertidig tryghedskameraovervågning ved indfaldsvejene til sommerhusområdet.</p>
      </div>
      <div class="article-bottom-actions">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <a href="#indsend" class="site-header-btn-stoet">Tip redaktionen</a>
      </div>
    </article>

    <!-- ARTIKEL: BUTIK -->
    <article id="art-butik" class="article-full-page">
      <div class="article-top-nav-bar">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <span style="font-size:12px; font-weight:700; color:var(--ink-3);">Erhverv & Handel</span>
      </div>
      <span class="section-kicker">ERHVERV & HANDEL</span>
      <h1 class="article-heading">Ny butikskæde åbner i centrum til foråret</h1>
      <p class="article-lead">Bæredygtig detail og lokalt håndværk skaber nyt liv og arbejdspladser i handelsbyen.</p>
      <div class="article-byline-bar">
        <div>Af <strong>Henrik Friis</strong> · Erhvervsjournalist</div>
        <div>Publiceret: I dag kl. 06:32 · 3 min. læsetid</div>
      </div>
      <div class="article-hero-box"><div class="card-img-cover img-erhverv"></div></div>
      <div class="article-prose">
        <p>Det tomme hjørnelokale på gågaden får nyt liv, når en innovativ detailbutik slår dørene op i marts. Konceptet kombinerer upcycling, genbrugskunst og lokalt producerede fødevarer.</p>
        <p>Etableringen skaber 12 nye lokale arbejdspladser og vil desuden rumme en mindre kaffebar, hvor gæster kan mødes til kreative aftener og workshops.</p>
        <blockquote class="article-pullquote">"Vi tror på det fysiske byliv. Mennesker vil gerne mærke varerne og have en personlig oplevelse."</blockquote>
      </div>
      <div class="article-bottom-actions">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <a href="#erhverv" class="site-header-btn-stoet">Se mere erhverv</a>
      </div>
    </article>

    <!-- ARTIKEL: SPORT -->
    <article id="art-sport" class="article-full-page">
      <div class="article-top-nav-bar">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <span style="font-size:12px; font-weight:700; color:var(--ink-3);">Lokalsport</span>
      </div>
      <span class="section-kicker">LOKALSPORT</span>
      <h1 class="article-heading">Dramatisk overtidssejr i topopgøret på hjemmebane</h1>
      <p class="article-lead">Mål i det 93. minut udløste jubel foran et tætpakket publikum.</p>
      <div class="article-byline-bar">
        <div>Af <strong>Martin Simonsen</strong> · Sportsreporter</div>
        <div>Publiceret: I går kl. 22:15 · 3 min. læsetid</div>
      </div>
      <div class="article-hero-box"><div class="card-img-cover img-fodbold"></div></div>
      <div class="article-prose">
        <p>Det lignede længe en pointdeling efter en hårdt spillet kamp med chancer i begge ender. Men dybt inde i overtiden steg hjemmeholdets anfører til vejrs efter et hjørnespark og headede bolden i netmaskerne til 2-1.</p>
        <p>Træneren roste efterfølgende spillernes vilje og takkede publikum for den enorme lydkulisse, der bar holdet frem i de afgørende minutter.</p>
      </div>
      <div class="article-bottom-actions">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <a href="#sport" class="site-header-btn-stoet">Flere sportsnyheder</a>
      </div>
    </article>

    <!-- ARTIKEL: TUDE Å -->
    <article id="art-tudeaa" class="article-full-page">
      <div class="article-top-nav-bar">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <span style="font-size:12px; font-weight:700; color:var(--ink-3);">Natur & Miljø</span>
      </div>
      <span class="section-kicker">NATUR & MILJØ</span>
      <h1 class="article-heading">Nyt vådområdeprojekt beskytter mod oversvømmelser</h1>
      <p class="article-lead">Lavbundsjord omlægges i historisk samarbejde mellem kommune og lodsejere.</p>
      <div class="article-byline-bar">
        <div>Af <strong>Astrid Lorentzen</strong> · Miljøreporter</div>
        <div>Publiceret: I går kl. 16:30 · 4 min. læsetid</div>
      </div>
      <div class="article-hero-box"><div class="card-img-cover img-natur"></div></div>
      <div class="article-prose">
        <p>Et stort vådområdeprojekt genslynger nu åen og skaber 140 hektar vådområde. Projektet fjerner mere end 12 tons kvælstof årligt og beskytter samtidig de omkringliggende marker mod oversvømmelser ved kraftige skybrud.</p>
        <p>Der etableres desuden nye stier og fugletårne, så naturelskere og skoleklasser kan få glæde af det rige dyreliv.</p>
      </div>
      <div class="article-bottom-actions">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <a href="#forside" class="site-header-btn-stoet">Gå til Forsiden</a>
      </div>
    </article>

    <!-- ARTIKEL: DEBAT -->
    <article id="art-debat" class="article-full-page">
      <div class="article-top-nav-bar">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <span style="font-size:12px; font-weight:700; color:var(--ink-3);">Debat & Holdninger</span>
      </div>
      <span class="section-kicker">DEBATINDLÆG</span>
      <h1 class="article-heading">"Vi må og skal bevare de grønne åndehuller i kommunen"</h1>
      <p class="article-lead">Debatindlæg af lokal borger: Hvorfor vi ikke må ofre byens oaser til fordel for hurtige parkeringspladser eller betonbyggeri.</p>
      <div class="article-byline-bar">
        <div>Af <strong>Lise Holm</strong> · Borger og debattør</div>
        <div>Publiceret: I dag kl. 10:00 · 3 min. læsetid</div>
      </div>
      <div class="article-hero-box"><div class="card-img-cover img-debat"></div></div>
      <div class="article-prose">
        <p>Hver dag møder jeg medborgere, der nyder de grønne åndehuller langs kysten og i parkerne. Det slår mig igen og igen, hvor uvurderlige disse oaser er for vores trivsel, sundhed og fællesskab.</p>
        <p>Når vi udvikler fremtidens byer, må vi ikke kun lade os styre af kvadratmeter og kortsigtet profit. Lad os passe på det grønne, som gør vores kommune til et dejligt sted at leve.</p>
      </div>
      <div class="article-bottom-actions">
        <a href="#forside" class="article-back-link">← Tilbage til Forsiden</a>
        <a href="#indsend" class="site-header-btn-stoet">Skriv et debatindlæg</a>
      </div>
    </article>

  </main>

  <!-- MOBILE BOTTOM APP BAR (ACCORDING TO USER MOCKUP) -->
  <nav class="mobile-bottom-bar" aria-label="Mobil navigation">
    <a href="#forside" class="mobile-bottom-item is-active" id="mbar-home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
      <span>Hjem</span>
    </a>
    <a href="#nabolag" class="mobile-bottom-item" id="mbar-area">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span>Mit område</span>
    </a>
    <a href="#indsend" class="mobile-bottom-item" id="mbar-tip">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      <span>Tip os</span>
    </a>
    <button onclick="toggleMobileMenu()" class="mobile-bottom-item" id="mbar-more" aria-label="Mere">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
      <span>Mere</span>
    </button>
  </nav>

  <!-- 5. FOOTER -->
  <footer class="site-footer">
    <div class="site-container">
      <div class="site-footer-grid">
        <div>
          <div class="site-footer-brand">
            <span id="footer-logo-prefix">Slagelse</span><span style="color:#34D399; font-style:italic;">Lokalt</span>
          </div>
          <p id="footer-tagline" style="font-size:13.5px; line-height:1.5; color:#94A3B8; margin-bottom:14px;">
            Lokaljournalistik, der sætter fællesskabet først. Skabt i tæt dialog med borgere og lokalt erhvervsliv i Slagelse Kommune.
          </p>
          <div style="font-size:12.5px; color:#CBD5E1;">
            📍 Lokalkontor i <span id="footer-city-label">Slagelse</span> · ✉️ redaktion@lokalmedie.dk
          </div>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#fff; margin-bottom:10px;">Sektioner</div>
          <ul class="site-footer-links">
            <li><a href="#forside">Forside</a></li>
            <li><a href="#nyheder">Nyheder</a></li>
            <li><a href="#erhverv">Erhverv</a></li>
            <li><a href="#sport">Sport</a></li>
            <li><a href="#kultur">Kultur</a></li>
            <li><a href="#foreningsliv">Foreningsliv</a></li>
            <li><a href="#debat">Debat</a></li>
          </ul>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#fff; margin-bottom:10px;">Netværkssites</div>
          <ul class="site-footer-links">
            <li><a onclick="switchCity('slagelse')">SlagelseLokalt</a></li>
            <li><a onclick="switchCity('naestved')">NæstvedLokalt</a></li>
            <li><a onclick="switchCity('holbaek')">HolbækLokalt</a></li>
            <li><a onclick="switchCity('ringsted')">RingstedLokalt</a></li>
            <li><a onclick="switchCity('koege')">KøgeLokalt</a></li>
            <li><a onclick="switchCity('roskilde')">RoskildeLokalt</a></li>
            <li><a onclick="switchCity('kalundborg')">KalundborgLokalt</a></li>
          </ul>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#fff; margin-bottom:10px;">Deltag</div>
          <ul class="site-footer-links">
            <li><a href="#stoet">Støt med fast pris</a></li>
            <li><a href="#stoet">Støt med valgfrit beløb</a></li>
            <li><a href="#indsend">Indsend historie / tip</a></li>
            <li><a href="#soeg">Søg i arkivet</a></li>
          </ul>
        </div>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:16px; font-size:12px; color:#64748B; text-align:center;">
        &copy; 2026 <span id="footer-copy-name">SlagelseLokalt</span> · En del af [By]Lokalt netværket i Danmark.
      </div>
    </div>
  </footer>

  <!-- 6. INTERAKTIVE SCRIPTS & DYNAMISK BYSKIFTE -->
  <script>
    const CITIES_DATA = {cities_json};
    let currentCityKey = 'slagelse';

    function toggleCityDropdown() {{
      const menu = document.getElementById('city-dropdown');
      if (menu) menu.classList.toggle('is-open');
    }}

    // Luk dropdown ved klik udenfor
    document.addEventListener('click', (e) => {{
      const btn = document.getElementById('header-city-btn');
      const menu = document.getElementById('city-dropdown');
      if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {{
        menu.classList.remove('is-open');
      }}
    }});

    function switchCity(cityKey) {{
      const data = CITIES_DATA[cityKey];
      if (!data) return;
      currentCityKey = cityKey;

      // 1. Skift CSS farvetema dynamisk
      document.documentElement.style.setProperty('--site-accent', data.accent);
      document.documentElement.style.setProperty('--site-accent-soft', data.accent_soft);

      // 2. Opdater logo og taglines
      const logoPrefix = document.getElementById('site-logo-prefix');
      const drawerLogo = document.getElementById('drawer-logo-prefix');
      const footerLogo = document.getElementById('footer-logo-prefix');
      if (logoPrefix) logoPrefix.innerText = data.prefix;
      if (drawerLogo) drawerLogo.innerText = data.prefix;
      if (footerLogo) footerLogo.innerText = data.prefix;

      const headerTagline = document.getElementById('site-brand-tagline');
      const footerTagline = document.getElementById('footer-tagline');
      if (headerTagline) headerTagline.innerText = data.tagline;
      if (footerTagline) footerTagline.innerText = data.tagline + ' · Dækning i ' + data.kommune + '.';

      // 3. Opdater header-knap og dropdown-status
      const headerCityName = document.getElementById('header-city-name');
      if (headerCityName) headerCityName.innerText = data.by;

      const dropdown = document.getElementById('city-dropdown');
      if (dropdown) dropdown.classList.remove('is-open');

      document.querySelectorAll('.city-dropdown-item').forEach(el => el.classList.remove('is-active'));
      const activeDropItem = document.getElementById('drop-item-' + cityKey);
      if (activeDropItem) activeDropItem.classList.add('is-active');

      // 4. Opdater topbar netværksknapper
      document.querySelectorAll('.site-network-btn').forEach(btn => btn.classList.remove('is-active'));
      const activeNetBtn = document.getElementById('net-btn-' + cityKey);
      if (activeNetBtn) activeNetBtn.classList.add('is-active');

      // 5. Opdater Støt-knap labels
      const headerStoetLabel = document.getElementById('header-stoet-label');
      const drawerStoetLabel = document.getElementById('drawer-stoet-label');
      if (headerStoetLabel) headerStoetLabel.innerText = 'Støt ' + data.by;
      if (drawerStoetLabel) drawerStoetLabel.innerText = 'Støt ' + data.navn;

      // 6. Opdater Forside Hero-kort
      const heroKicker = document.getElementById('hero-kicker');
      const heroTitle = document.getElementById('hero-title');
      const heroManchet = document.getElementById('hero-manchet');
      const heroMeta = document.getElementById('hero-meta');
      if (heroKicker) heroKicker.innerText = data.hero_kicker;
      if (heroTitle) heroTitle.innerText = data.hero_title;
      if (heroManchet) heroManchet.innerText = data.hero_manchet;
      if (heroMeta) heroMeta.innerText = data.hero_meta;

      // 7. Opdater Wire / Seneste nyt
      const wireKommune = document.getElementById('wire-kommune-name');
      if (wireKommune) wireKommune.innerText = data.kommune;

      const wireContainer = document.getElementById('wire-list-container');
      if (wireContainer && data.wire) {{
        wireContainer.innerHTML = data.wire.map(item => `
          <a href="#${{item[2]}}" class="site-wire-item">
            <span class="site-wire-time">${{item[0]}}</span>
            <p class="site-wire-headline">${{item[1]}}</p>
          </a>
        `).join('');
      }}

      // 8. Opdater Dit Nabolag
      const nabolagKommune = document.getElementById('nabolag-kommune-tag');
      if (nabolagKommune) nabolagKommune.innerText = data.kommune;

      const nabolagPillsContainer = document.getElementById('nabolag-pills-container');
      if (nabolagPillsContainer && data.omraader) {{
        nabolagPillsContainer.innerHTML = data.omraader.map((area, idx) => `
          <button onclick="setNabolagArea('${{area}}', this)" class="site-nabolag-pill ${{idx === 0 ? 'is-active' : ''}}">${{area}}</button>
        `).join('');
      }}
      const nabolagBox = document.getElementById('nabolag-box');
      if (nabolagBox) nabolagBox.innerHTML = `<strong>${{data.omraader[0]}}:</strong> ${{data.nabolag_text}}`;

      // 9. Opdater Fællesskabsbanner & Støttekort
      const commTitle = document.getElementById('community-banner-title');
      if (commTitle) commTitle.innerText = 'Vær med til at præge ' + data.navn;

      const suppTitle = document.getElementById('support-section-title');
      const suppDesc = document.getElementById('support-section-desc');
      if (suppTitle) suppTitle.innerText = 'Støt ' + data.navn;
      if (suppDesc) suppDesc.innerText = `Vi formes og finansieres af borgerne og erhvervslivet i ${{data.kommune}}. Vælg en fast pakke eller støt med et valgfrit beløb.`;

      const nyhederTitle = document.getElementById('section-nyheder-title');
      if (nyhederTitle) nyhederTitle.innerText = 'Nyheder fra ' + data.kommune;

      const footerCopy = document.getElementById('footer-copy-name');
      const footerCityLabel = document.getElementById('footer-city-label');
      if (footerCopy) footerCopy.innerText = data.navn;
      if (footerCityLabel) footerCityLabel.innerText = data.by;

      updateSubmitText();

      try {{
        localStorage.setItem('valgt_by', cityKey);
      }} catch (e) {{}}
    }}

    function setNabolagArea(area, btn) {{
      document.querySelectorAll('.site-nabolag-pill').forEach(b => b.classList.remove('is-active'));
      if (btn) btn.classList.add('is-active');
      const box = document.getElementById('nabolag-box');
      const currentCity = CITIES_DATA[currentCityKey];
      if (box && currentCity) {{
        box.innerHTML = `<strong>${{area}}:</strong> Aktuelle projekter, byggeplaner og lokale aktiviteter i ${{area}} (${{currentCity.kommune}}).`;
      }}
    }}

    function toggleMobileMenu() {{
      const d = document.getElementById('mobile-drawer');
      if (d) d.classList.toggle('is-open');
    }}

    // Støttemodel logic
    let supportMode = 'fast';
    let planName = 'Støtte';
    let planPrice = 49;
    let customAmount = 50;
    let customFreq = 'monthly';

    function setSupportMode(m) {{
      supportMode = m;
      const tabFast = document.getElementById('tab-support-fast');
      const tabValgfri = document.getElementById('tab-support-valgfri');
      const paneFast = document.getElementById('support-pane-fast');
      const paneValgfri = document.getElementById('support-pane-valgfri');

      if (m === 'fast') {{
        tabFast.classList.add('is-active');
        tabValgfri.classList.remove('is-active');
        paneFast.style.display = 'block';
        paneValgfri.style.display = 'none';
      }} else {{
        tabValgfri.classList.add('is-active');
        tabFast.classList.remove('is-active');
        paneFast.style.display = 'none';
        paneValgfri.style.display = 'block';
      }}
      updateSubmitText();
    }}

    function selectPlan(name, price, el) {{
      planName = name;
      planPrice = price;
      document.querySelectorAll('.support-plan-card').forEach(c => c.classList.remove('is-selected'));
      el.classList.add('is-selected');
      updateSubmitText();
    }}

    function setCustomFreq(f) {{
      customFreq = f;
      const bm = document.getElementById('btn-freq-monthly');
      const bo = document.getElementById('btn-freq-once');
      if (f === 'monthly') {{
        bm.classList.add('is-active');
        bo.classList.remove('is-active');
      }} else {{
        bo.classList.add('is-active');
        bm.classList.remove('is-active');
      }}
      updateSubmitText();
    }}

    function setCustomAmt(amt) {{
      customAmount = amt;
      document.getElementById('input-custom-amount').value = amt;
      document.querySelectorAll('.custom-amt-btn').forEach(b => b.classList.remove('is-active'));
      event.target.classList.add('is-active');
      updateSubmitText();
    }}

    function customInputChanged(val) {{
      const p = parseInt(val, 10);
      if (!isNaN(p) && p > 0) {{
        customAmount = p;
        document.querySelectorAll('.custom-amt-btn').forEach(b => b.classList.remove('is-active'));
        updateSubmitText();
      }}
    }}

    function updateSubmitText() {{
      const btn = document.getElementById('btn-submit-support');
      const currentCity = CITIES_DATA[currentCityKey];
      const cityName = currentCity ? currentCity.navn : 'SlagelseLokalt';
      if (supportMode === 'fast') {{
        btn.innerText = `Støt ${{cityName}} med ${{planName}} (${{planPrice}} kr. / md)`;
      }} else {{
        const ft = customFreq === 'monthly' ? 'pr. md.' : 'engang';
        btn.innerText = `Støt ${{cityName}} med ${{customAmount}} kr. (${{ft}})`;
      }}
    }}

    function submitSupport() {{
      const currentCity = CITIES_DATA[currentCityKey];
      const cityName = currentCity ? currentCity.navn : 'SlagelseLokalt';
      if (supportMode === 'fast') {{
        alert(`Tusind tak! Dit medlemskab med ${{planName}} (${{planPrice}} kr./md) er nu oprettet. Tak fordi du bakker op om ${{cityName}}!`);
      }} else {{
        const ft = customFreq === 'monthly' ? 'hver måned' : 'som engangsbidrag';
        alert(`Tusind tak! Dit bidrag på ${{customAmount}} kr. (${{ft}}) er modtaget. Du gør en direkte forskel for lokaljournalistikken i ${{currentCity.kommune}}!`);
      }}
    }}

    function selectPriceProduct(mode) {{
      switchTipMode(mode);
      const el = document.getElementById('indsend');
      if (el) el.scrollIntoView({{ behavior: 'smooth' }});
    }}

    function switchTipMode(mode) {{
      ['tip', 'event', 'sponsor', 'citat'].forEach(m => {{
        const btn = document.getElementById(`tab-tip-${{m}}`);
        const form = document.getElementById(`form-tip-${{m}}`);
        if (btn) btn.classList.toggle('is-active', m === mode);
        if (form) form.style.display = (m === mode) ? 'flex' : 'none';
      }});
    }}

    function submitTipMode(mode) {{
      const c = currentCity || CITIES_DATA['slagelse'];
      if (mode === 'tip') {{
        const name = document.getElementById('tip-user-name').value;
        const headline = document.getElementById('tip-headline').value;
        alert(`Tusind tak, ${{name}}! Dit tip "${{headline}}" er modtaget hos redaktionen for ${{c.navn}}. Kildebeskyttelse er sikret.`);
      }} else if (mode === 'event') {{
        const title = document.getElementById('event-title').value;
        const name = document.getElementById('event-contact-name').value;
        alert(`Mange tak, ${{name}}! Jeres arrangement "${{title}}" er modtaget og klargøres til kalenderen på ${{c.navn}}.`);
      }} else if (mode === 'sponsor') {{
        const comp = document.getElementById('sponsor-company').value;
        const name = document.getElementById('sponsor-contact-name').value;
        alert(`Mange tak, ${{name}}! Jeres forespørgsel om en sponsoreret artikel for ${{comp}} er modtaget. Vores redaktion kontakter jer hurtigst muligt.`);
      }} else if (mode === 'citat') {{
        const name = document.getElementById('citat-author').value;
        const topic = document.getElementById('citat-topic').value;
        alert(`Tak for dit citat, ${{name}}! Dit bidrag til emnet "${{topic}}" er overdraget til redaktionen for ${{c.navn}}.`);
      }}
    }}

    // Søgemaskine
    const stories = [
      {{ id: 'art-storebaelt', title: 'Kødannelse på Storebæltsbroen mod Fyn efter trafikuheld', cat: 'Trafik' }},
      {{ id: 'art-byraad', title: 'Nyt flertal på rådhuset vil investere 45 millioner i bymidten', cat: 'Politik' }},
      {{ id: 'art-sommerhuse', title: 'Flere sommerhuse udsat for indbrud ved Skælskør Næs', cat: 'Krimi' }},
      {{ id: 'art-butik', title: 'Ny butikskæde åbner på Schweizerpladsen til foråret', cat: 'Erhverv' }},
      {{ id: 'art-sport', title: 'Slagelse B&I overtidssejr på Harboe Arena', cat: 'Sport' }},
      {{ id: 'art-tudeaa', title: 'Nyt vådområdeprojekt ved Tude Å beskytter mod oversvømmelser', cat: 'Natur' }},
      {{ id: 'art-debat', title: 'Debat: "Vi må bevare de grønne åndehuller i kommunen"', cat: 'Debat' }}
    ];

    function runLiveSearch(query) {{
      const q = (query || '').toLowerCase().trim();
      const list = document.getElementById('search-results-list');
      if (!list) return;

      const filtered = stories.filter(s => !q || s.title.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q));
      if (filtered.length === 0) {{
        list.innerHTML = '<div style="padding:16px; text-align:center; color:var(--ink-3);">Ingen resultater matchede.</div>';
        return;
      }}
      list.innerHTML = filtered.map(s => `
        <a href="#${{s.id}}" style="display:block; padding:12px 14px; background:var(--surface-2); border-radius:var(--radius-sm); border:1px solid var(--line);">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--site-accent); margin-bottom:3px;">${{s.cat}}</div>
          <div style="font-size:15px; font-weight:700; color:var(--ink);">${{s.title}}</div>
        </a>
      `).join('');
    }}

    function setSearchTerm(t) {{
      const inp = document.getElementById('search-input');
      if (inp) {{
        inp.value = t;
        runLiveSearch(t);
      }}
    }}

    function toggleProfileEdit() {{
      const box = document.getElementById('profile-edit-box');
      if (box) {{
        box.style.display = (box.style.display === 'none' || !box.style.display) ? 'block' : 'none';
      }}
    }}

    function saveProfile() {{
      const name = document.getElementById('input-profile-name').value;
      const area = document.getElementById('input-profile-area').value;
      if (name) document.getElementById('profile-display-name').textContent = name;
      if (area) document.getElementById('profile-display-area').textContent = `${{area}} · Fri læseradgang`;
      toggleProfileEdit();
      alert('Dine profiloplysninger er opdateret!');
    }}

    window.addEventListener('DOMContentLoaded', () => {{
      runLiveSearch('');
      try {{
        const saved = localStorage.getItem('valgt_by');
        if (saved && CITIES_DATA[saved]) {{
          switchCity(saved);
        }}
      }} catch (e) {{}}
    }});
  </script>
</body>
</html>
'''

with open('nyhedssite.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"nyhedssite.html updated with dedicated full scrollable articles and city switching. Size: {len(html_content):,} bytes")
