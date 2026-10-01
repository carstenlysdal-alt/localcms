import re
import json

# Read base64 images from current nyhedssite.html
with open('nyhedssite.html', 'r', encoding='utf-8') as f:
    existing_content = f.read()

match = re.search(r'window\.SL_IMAGES\s*=\s*(\{.*?\});', existing_content, re.DOTALL)
if not match:
    raise ValueError("Could not find window.SL_IMAGES in nyhedssite.html")

sl_images = json.loads(match.group(1))

# CSS variables for images
css_vars = "\n    ".join([f'--img-{k}: url("{v}");' for k, v in sl_images.items()])

html_content = f'''<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>SlagelseLokalt – Lokaljournalistik, der sætter fællesskabet først</title>
  <meta name="description" content="Nyheder, erhverv, sport, kultur, debat og foreningsliv i Slagelse Kommune.">
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
      --blue-accent: #0284C7;
      --blue-soft: #F0F9FF;

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
      height: 36px;
      width: 100%;
    }}
    .site-network-left {{
      display: flex;
      align-items: center;
      gap: 10px;
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
    }}
    .site-network-dot {{
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--site-accent);
    }}
    .site-network-link {{
      color: #94A3B8;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }}
    .site-network-link.is-current {{
      color: #FFFFFF;
      font-weight: 700;
      background: rgba(255,255,255,0.15);
    }}
    .site-network-right {{
      display: none;
      align-items: center;
      font-size: 11.5px;
      white-space: nowrap;
    }}
    @media (min-width: 900px) {{
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

    /* 2. STICKY HEADER */
    .site-header-wrapper {{
      background: var(--surface);
      border-bottom: 1px solid var(--line);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: var(--shadow-sm);
      width: 100%;
    }}
    .site-header-inner {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 60px;
      width: 100%;
      gap: 10px;
    }}
    @media (min-width: 768px) {{
      .site-header-inner {{ height: 68px; }}
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
      transition: all 0.15s;
      box-shadow: 0 1px 4px rgba(0, 112, 56, 0.2);
    }}
    .site-header-btn-stoet:hover {{
      background: var(--site-accent-hover);
    }}

    .site-header-btn-tip-desktop {{
      display: none;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      font-weight: 600;
      color: var(--site-accent);
      background: var(--site-accent-soft);
      padding: 7px 12px;
      border-radius: var(--radius-sm);
      white-space: nowrap;
      border: 1px solid rgba(0, 112, 56, 0.2);
    }}
    @media (min-width: 1080px) {{
      .site-header-btn-tip-desktop {{ display: inline-flex; }}
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
    }}
    .site-subnav-pill.is-highlight {{
      color: var(--site-accent);
      background: var(--site-accent-soft);
      border-color: rgba(0, 112, 56, 0.25);
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
      width: 290px;
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
    }}
    .site-card-title {{
      font-family: var(--font-display);
      font-size: 18.5px;
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.015em;
      color: var(--ink);
      margin-bottom: 8px;
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

    /* 4-GRID (MERE FRA SLAGELSE) */
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

    /* ARTICLE DETAIL MODAL (CSS :target & JS READY) */
    .article-modal {{
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
      overflow-y: auto;
      padding: 16px;
    }}
    .article-modal:target, .article-modal.is-open {{
      display: block;
    }}
    .article-modal-card {{
      max-width: 820px;
      margin: 20px auto;
      background: var(--surface);
      border-radius: var(--radius-xl);
      padding: 24px 18px;
      box-shadow: var(--shadow-lg);
      position: relative;
    }}
    @media (min-width: 640px) {{
      .article-modal-card {{ padding: 40px; margin: 40px auto; }}
    }}
    .article-modal-close {{
      position: sticky;
      top: 10px;
      float: right;
      background: var(--surface-2);
      border: 1px solid var(--line);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 700;
      color: var(--ink);
      z-index: 10;
    }}
    .article-heading {{
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 800;
      line-height: 1.2;
      color: var(--ink);
      margin: 12px 0;
    }}
    @media (min-width: 640px) {{
      .article-heading {{ font-size: 36px; }}
    }}
    .article-lead {{
      font-size: 16px;
      font-weight: 500;
      color: var(--ink-2);
      line-height: 1.55;
      margin-bottom: 20px;
      border-left: 3px solid var(--site-accent);
      padding-left: 14px;
    }}
    .article-hero-box {{
      height: 240px;
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: 20px;
      position: relative;
    }}
    @media (min-width: 640px) {{
      .article-hero-box {{ height: 400px; }}
    }}
    .article-prose {{
      font-size: 15.5px;
      line-height: 1.7;
      color: #27272A;
    }}
    .article-prose p {{ margin-bottom: 16px; }}
    .article-pullquote {{
      font-family: var(--font-display);
      font-size: 20px;
      font-style: italic;
      color: var(--ink);
      line-height: 1.45;
      margin: 24px 0;
      padding: 16px 20px;
      background: var(--surface-2);
      border-left: 4px solid var(--site-accent);
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
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

  <!-- 1. TOP NETWORK STRIP -->
  <div class="site-network-bar">
    <div class="site-container site-network-inner">
      <div class="site-network-left">
        <span class="site-network-badge"><span class="site-network-dot"></span> [By]Lokalt:</span>
        <a href="#forside" class="site-network-link is-current">Slagelse</a>
        <a onclick="alert('Skifter til KalundborgLokalt')" class="site-network-link">Kalundborg</a>
        <a onclick="alert('Skifter til NæstvedLokalt')" class="site-network-link">Næstved</a>
        <a onclick="alert('Skifter til HolbækLokalt')" class="site-network-link">Holbæk</a>
      </div>
      <div class="site-network-right">
        <a href="#art-storebaelt">
          <span class="live-dot-pulse"></span>
          <span><strong>LIVE:</strong> Storebæltsbroen mod Fyn – Oprydning i gang</span>
        </a>
      </div>
    </div>
  </div>

  <!-- 2. STICKY HEADER -->
  <header class="site-header-wrapper">
    <div class="site-container site-header-inner">
      <div style="display:flex; align-items:center; gap:24px;">
        <div>
          <a href="#forside" class="site-brand-logo">
            Slagelse<span class="site-brand-logo-accent">Lokalt</span>
          </a>
          <span class="site-brand-tagline">Lokaljournalistik, der sætter fællesskabet først</span>
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
          </ul>
        </nav>
      </div>

      <div class="site-header-actions">
        <!-- Search icon button -->
        <a href="#soeg" class="site-btn-icon" title="Søg i nyheder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </a>

        <!-- Tip/indsend (desktop) -->
        <a href="#indsend" class="site-header-btn-tip-desktop">
          <span>✍️ Indsend historie</span>
        </a>

        <!-- Support compact button -->
        <a href="#stoet" class="site-header-btn-stoet">
          <span>❤️</span>
          <span>Støt</span>
        </a>

        <!-- Mobile hamburger button -->
        <button onclick="toggleMobileMenu()" class="site-hamburger-btn" aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- 3. MOBILE SUBNAV PILLS (HORIZONTALLY SCROLLABLE) -->
  <div class="site-subnav-strip">
    <div class="site-subnav-pills-list">
      <a href="#forside" class="site-subnav-pill is-active">Forside</a>
      <a href="#nyheder" class="site-subnav-pill">Nyheder</a>
      <a href="#erhverv" class="site-subnav-pill">Erhverv</a>
      <a href="#sport" class="site-subnav-pill">Sport</a>
      <a href="#kultur" class="site-subnav-pill">Kultur</a>
      <a href="#foreningsliv" class="site-subnav-pill">Foreningsliv</a>
      <a href="#debat" class="site-subnav-pill">Debat</a>
      <a href="#stoet" class="site-subnav-pill is-highlight">❤️ Støt</a>
      <a href="#indsend" class="site-subnav-pill">✍️ Indsend</a>
    </div>
  </div>

  <!-- 4. MOBILE DRAWER OVERLAY -->
  <div id="mobile-drawer" class="mobile-drawer-overlay" onclick="toggleMobileMenu()">
    <div class="mobile-drawer-content" onclick="event.stopPropagation()">
      <div class="mobile-drawer-header">
        <div class="site-brand-logo" style="font-size:20px;">Slagelse<span class="site-brand-logo-accent">Lokalt</span></div>
        <button onclick="toggleMobileMenu()" style="font-size:24px; color:var(--ink-3);">&times;</button>
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
        <li><a href="#indsend" onclick="toggleMobileMenu()" class="mobile-drawer-link">Indsend historie <span>✍️</span></a></li>
        <li><a href="#stoet" onclick="toggleMobileMenu()" class="mobile-drawer-link" style="color:var(--site-accent); font-weight:700;">Støt SlagelseLokalt <span>❤️</span></a></li>
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
            <span class="site-hero-kicker">TRAFIK · STOREBÆLT</span>
            <h1 class="site-hero-title">Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld</h1>
            <p class="site-hero-manchet">Et trafikuheld spærrer et spor på Storebæltsbroen. Bilister skal forvente 20-30 minutters ekstra rejsetid.</p>
            <div class="site-hero-actions-row">
              <span class="site-hero-btn-read">
                <span>Læs artiklen</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </span>
              <span style="font-size:12px; font-weight:600; color:#CBD5E1;">2 t. siden</span>
            </div>
          </div>
        </a>

        <!-- Wire Card: Seneste nyt -->
        <aside class="site-wire-card">
          <div class="site-wire-header">
            <span>Seneste nyt</span>
            <span style="font-size:11.5px; font-weight:600; color:var(--site-accent);">Slagelse Kommune</span>
          </div>
          <div class="site-wire-list">
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
            <span style="font-size:11.5px; color:var(--ink-3);">Kort</span>
          </div>
          <div class="site-nabolag-thumb">
            <div class="card-img-cover img-kort"></div>
          </div>
          <div class="site-nabolag-pills">
            <button onclick="setNabolag('Slagelse C', this)" class="site-nabolag-pill is-active">Slagelse C</button>
            <button onclick="setNabolag('Korsør', this)" class="site-nabolag-pill">Korsør</button>
            <button onclick="setNabolag('Skælskør', this)" class="site-nabolag-pill">Skælskør</button>
            <button onclick="setNabolag('Dalmose', this)" class="site-nabolag-pill">Dalmose</button>
          </div>
          <div id="nabolag-box" style="font-size:13px; color:var(--ink-2); line-height:1.45; padding:10px; background:var(--surface-2); border-radius:var(--radius-sm);">
            <strong>Slagelse C:</strong> 4 nye byggeprojekter godkendt i bymidten. Håndværkere er gået i gang ved Nytorv.
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
            <p class="site-card-desc">Bredt flertal er enige om en historisk investering i Slagelses handelsliv, grønne pladser og gågader.</p>
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
            <h3 class="site-card-title">Flere sommerhuse udsat for indbrud ved Skælskør Næs</h3>
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
            <h3 class="site-card-title">Ny butikskæde åbner på Schweizerpladsen</h3>
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
          <h2 class="site-community-title">Vær med til at præge SlagelseLokalt</h2>
          <p class="site-community-desc">
            Vores journalistik skabes i tæt samspil med hverdagen i Slagelse Kommune. Vi finansieres og formes af borgerne og de lokale virksomheder – og vi modtager altid gerne dine idéer, spørgsmål og historier.
          </p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          <a href="#indsend" class="site-community-btn">Indsend historie / Tip</a>
          <a href="#stoet" class="site-community-btn" style="background:rgba(255,255,255,0.2); color:#FFFFFF; border:1px solid rgba(255,255,255,0.4);">Støt med valgfrit beløb</a>
        </div>
      </div>

      <!-- 4-GRID (MERE FRA SLAGELSE) -->
      <div class="site-4grid">
        <a href="#art-sport" class="site-card">
          <div class="site-card-thumb" style="height:140px;">
            <div class="card-img-cover img-fodbold"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">LOKALSPORT</span>
            <h3 class="site-card-title" style="font-size:16px;">Slagelse B&I overtidssejr</h3>
            <p class="site-card-desc" style="font-size:13px;">Scoring i 93. minut sikrede tre point foran 1.100 tilskuere på Harboe Arena.</p>
          </div>
        </a>

        <a href="#art-tudeaa" class="site-card">
          <div class="site-card-thumb" style="height:140px;">
            <div class="card-img-cover img-natur"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">NATUR & MILJØ</span>
            <h3 class="site-card-title" style="font-size:16px;">Vådområde ved Tude Å</h3>
            <p class="site-card-desc" style="font-size:13px;">140 hektar lavbundsjord omlægges for at mindske oversvømmelser og kvælstof.</p>
          </div>
        </a>

        <a href="#art-debat" class="site-card">
          <div class="site-card-thumb" style="height:140px;">
            <div class="card-img-cover img-debat"></div>
          </div>
          <div class="site-card-body">
            <span class="site-card-kicker">DEBATINDLÆG</span>
            <h3 class="site-card-title" style="font-size:16px;">"Bevar byens oaser"</h3>
            <p class="site-card-desc" style="font-size:13px;">Lise Holm advarer mod for tæt bebyggelse ved de grønne arealer i Korsør.</p>
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
          <a href="#stoet" style="font-size:12.5px; font-weight:700; color:var(--site-accent);">Vil din virksomhed også støtte? Bliv partner her →</a>
        </div>
        <div class="site-partners-logos">
          <span class="site-partner-badge">Harboe Bryggeri</span>
          <span class="site-partner-badge">Sparekassen Sjælland-Fyn</span>
          <span class="site-partner-badge">VKST Landbrugsrådgivning</span>
          <span class="site-partner-badge">Danbolig Slagelse</span>
          <span class="site-partner-badge">SuperBrugsen Korsør</span>
        </div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 2: NYHEDER                             -->
    <!-- ============================================== -->
    <section id="nyheder" class="content-section">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 class="section-title">Nyheder fra Slagelse Kommune</h2>
        <p class="section-desc">Aktuelt overblik over politik, beredskab, infrastruktur og lokalsamfundet.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-storebaelt" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-storebaelt"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">TRAFIK</span>
            <h3 class="site-card-title">Kødannelse på Storebæltsbroen i retning mod Fyn</h3>
            <p class="site-card-desc">Trafikuheld skabte mandag formiddag lange køer. Trafikken afvikles nu i ét spor.</p>
            <div class="site-card-meta"><span>Korsør</span><span>I dag</span></div>
          </div>
        </a>

        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">POLITIK</span>
            <h3 class="site-card-title">45 millioner til fornyelse af Slagelse bymidte</h3>
            <p class="site-card-desc">Nyt flertal på rådhuset investerer i handelslivet og gågaderne.</p>
            <div class="site-card-meta"><span>Slagelse C</span><span>4 t. siden</span></div>
          </div>
        </a>

        <a href="#art-sommerhuse" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-sommerhus"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">KRIMI</span>
            <h3 class="site-card-title">Sommerhusindbrud ved Skælskør Næs</h3>
            <p class="site-card-desc">Beboere og grundejerforening opfordres til øget årvågenhed.</p>
            <div class="site-card-meta"><span>Skælskør</span><span>6 t. siden</span></div>
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
            <h3 class="site-card-title">Ny butikskæde åbner på Schweizerpladsen</h3>
            <p class="site-card-desc">Genanvendelse og lokalt kunsthåndværk rykker ind i tomme butikslokaler.</p>
            <div class="site-card-meta"><span>Handel</span><span>I dag</span></div>
          </div>
        </a>

        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">LOGISTIK</span>
            <h3 class="site-card-title">Erhvervspark ved E20 udvides markant</h3>
            <p class="site-card-desc">Stor efterspørgsel på erhvervsjord ved motorvejsafkørsel 39.</p>
            <div class="site-card-meta"><span>Erhverv</span><span>2 dage siden</span></div>
          </div>
        </a>

        <a href="#art-sommerhuse" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-sommerhus"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">TURISME</span>
            <h3 class="site-card-title">Kystturismen i Skælskør mod ny rekord</h3>
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
        <p class="section-desc">Fodbold, håndbold, atletik, svømning og breddeidræt i Slagelse, Korsør og Skælskør.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-sport" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-fodbold"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">FODBOLD</span>
            <h3 class="site-card-title">Slagelse B&I henter overtidssejr på Harboe Arena</h3>
            <p class="site-card-desc">Mål i det 93. minut udløste jubel foran 1.100 tilskuere i topstriden.</p>
            <div class="site-card-meta"><span>Harboe Arena</span><span>I går</span></div>
          </div>
        </a>

        <a href="#art-tudeaa" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-natur"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">MOTION</span>
            <h3 class="site-card-title">Slagelse Løbeklub klar til forårsløb</h3>
            <p class="site-card-desc">Over 400 tilmeldte løbere gennem Slagelse Lystskov.</p>
            <div class="site-card-meta"><span>Motion</span><span>Søndag</span></div>
          </div>
        </a>

        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">SVØMNING</span>
            <h3 class="site-card-title">Korsør Svømmeklub sætter fire klubrekorder</h3>
            <p class="site-card-desc">Guldmedaljer og personlige rekorder til de unge talenter.</p>
            <div class="site-card-meta"><span>Korsør</span><span>3 dage siden</span></div>
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
        <p class="section-desc">Koncerter, teater, udstillinger, biblioteker og historiske steder.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-kultur" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">MUSIK & TEATER</span>
            <h3 class="site-card-title">Musikhuset Slagelse afslører forårsprogram</h3>
            <p class="site-card-desc">Pop, jazz og stand-up comedy gæster scenerne i byen.</p>
            <div class="site-card-meta"><span>Musikhuset</span><span>I dag</span></div>
          </div>
        </a>

        <a href="#art-sommerhuse" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-sommerhus"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">HISTORIE</span>
            <h3 class="site-card-title">Borreby Herreborg åbner historiske sale</h3>
            <p class="site-card-desc">Offentlige rundvisninger viser Skælskørs unikke renæssancearv.</p>
            <div class="site-card-meta"><span>Skælskør</span><span>2 dage siden</span></div>
          </div>
        </a>

        <a href="#art-debat" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-debat"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">BØRN & FAMILIE</span>
            <h3 class="site-card-title">Gratis workshops på bibliotekerne</h3>
            <p class="site-card-desc">Kreative værksteder og højtlæsning i både Slagelse og Korsør.</p>
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
            <div class="site-card-meta"><span>Korsør Kulturhus</span><span>I går</span></div>
          </div>
        </a>

        <a href="#art-tudeaa" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-natur"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">BORGERINITIATIV</span>
            <h3 class="site-card-title">Naturvennerne samler 300 kg affald</h3>
            <p class="site-card-desc">Lokale familier ryddede stierne langs Tude Å.</p>
            <div class="site-card-meta"><span>Tude Å</span><span>Søndag</span></div>
          </div>
        </a>

        <a href="#art-debat" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-debat"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">HJÆLP HINANDEN</span>
            <h3 class="site-card-title">Frivilligcenter Slagelse søger mentorer</h3>
            <p class="site-card-desc">Hjælp unge godt videre med skolegang og fritidsliv.</p>
            <div class="site-card-meta"><span>Slagelse C</span><span>4 dage siden</span></div>
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
        <p class="section-desc">Ordet er frit for alle borgere og foreninger i Slagelse Kommune.</p>
      </div>

      <div class="site-middle-3cards-grid">
        <a href="#art-debat" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-debat"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">BORGERINDLÆG</span>
            <h3 class="site-card-title">"Vi skal bevare byens grønne åndehuller"</h3>
            <p class="site-card-desc">Lise Holm: Byggeri må ikke fjerne de sidste oaser langs kysten.</p>
            <div class="site-card-meta"><span>Af Lise Holm</span><span>I dag</span></div>
          </div>
        </a>

        <a href="#art-byraad" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-bymidte"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">POLITISK REPLIK</span>
            <h3 class="site-card-title">"Investeringen i bymidten er nødvendig"</h3>
            <p class="site-card-desc">Byrådsmedlem Morten Nielsen om at styrke de fysiske handelsgader.</p>
            <div class="site-card-meta"><span>Morten Nielsen (V)</span><span>I går</span></div>
          </div>
        </a>

        <a href="#art-storebaelt" class="site-card">
          <div class="site-card-thumb"><div class="card-img-cover img-storebaelt"></div></div>
          <div class="site-card-body">
            <span class="site-card-kicker">PENDLERDEBAT</span>
            <h3 class="site-card-title">"Storebæltspendlerne overses i planerne"</h3>
            <p class="site-card-desc">Efterlysning af rimeligere bropas og bedre togforbindelser.</p>
            <div class="site-card-meta"><span>Søren K. Møller</span><span>2 dage siden</span></div>
          </div>
        </a>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 8: STØT SLAGELSE LOKALT                -->
    <!-- ============================================== -->
    <section id="stoet" class="content-section">
      <div class="support-card-container">
        <div style="text-align:center; max-width:600px; margin:0 auto 24px auto;">
          <span class="section-kicker">FÆLLESSKAB & STØTTE</span>
          <h2 style="font-family:var(--font-display); font-size:30px; font-weight:800; margin-bottom:8px;">Støt SlagelseLokalt</h2>
          <p style="font-size:14.5px; color:var(--ink-2); line-height:1.5;">
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
    <!-- SEKTION 9: INDSEND HISTORIE                    -->
    <!-- ============================================== -->
    <section id="indsend" class="content-section">
      <div class="support-card-container">
        <span class="section-kicker">BORGERJOURNALISTIK</span>
        <h2 style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:8px;">Indsend historie eller tip</h2>
        <p style="font-size:14px; color:var(--ink-2); line-height:1.5; margin-bottom:20px;">
          Har du set noget i trafikken, har din forening haft en god oplevelse, eller har du et debatindlæg?
        </p>

        <form onsubmit="event.preventDefault(); submitTip();" style="display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Kategori</label>
            <select class="form-control" id="tip-category" required>
              <option value="nyhed">Nyhed eller tip</option>
              <option value="foreningsliv">Foreningsliv & arrangement</option>
              <option value="debat">Debatindlæg</option>
              <option value="erhverv">Erhvervsnyt</option>
              <option value="kultur">Kultur & oplevelser</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Overskrift *</label>
            <input type="text" class="form-control" id="tip-title" placeholder="Hvad handler det om?" required>
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Din historie *</label>
            <textarea class="form-control" id="tip-body" rows="4" placeholder="Beskriv forløbet, dato, sted..." required></textarea>
          </div>
          <div style="display:grid; grid-template-columns:1fr; gap:10px;">
            <input type="text" class="form-control" id="tip-name" placeholder="Dit navn" required>
            <input type="text" class="form-control" id="tip-contact" placeholder="Telefon eller e-mail" required>
          </div>
          <button type="submit" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:12px; font-size:14px; border-radius:var(--radius-sm);">
            Send til redaktionen
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
        <h2 style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:12px;">Søg i SlagelseLokalt</h2>
        <div style="position:relative; margin-bottom:16px;">
          <input type="text" id="search-input" oninput="runLiveSearch(this.value)" placeholder="Søg f.eks. Storebælt, byråd, erhverv, sport..." class="search-input-field">
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px;">
          <button onclick="setSearchTerm('Storebælt')" class="site-subnav-pill">Storebælt</button>
          <button onclick="setSearchTerm('Byråd')" class="site-subnav-pill">Byråd</button>
          <button onclick="setSearchTerm('Skælskør')" class="site-subnav-pill">Skælskør</button>
          <button onclick="setSearchTerm('Sport')" class="site-subnav-pill">Sport</button>
        </div>
        <div id="search-results-list" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>
    </section>

  </main>

  <!-- ============================================== -->
  <!-- MODAL ARTIKELVISNINGER (CSS :TARGET OG JS)     -->
  <!-- ============================================== -->
  
  <!-- ARTIKEL: STOREBÆLT -->
  <div id="art-storebaelt" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">TRAFIK · STOREBÆLT</span>
      <h2 class="article-heading">Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld</h2>
      <p class="article-lead">Et trafikuheld med to biler spærrer det ene spor på Storebæltsbroen. Bilister skal forvente ekstra rejsetid.</p>
      <div style="font-size:12px; color:var(--ink-3); margin-bottom:16px;">Af Jonas Vestergaard · 2 t. siden</div>
      <div class="article-hero-box"><div class="card-img-cover img-storebaelt"></div></div>
      <div class="article-prose">
        <p>Vagtchefen ved Sydsjællands og Lolland-Falsters Politi oplyser, at uheldet skete omkring klokken 08.45 lige før højbroen i vestgående retning.</p>
        <p>Ingen personer er kommet alvorligt til skade, men vragdele og spildt olie har gjort det nødvendigt midlertidigt at lukke det ene spor.</p>
        <blockquote class="article-pullquote">"Vi forventer, at oprydningsarbejdet er afsluttet før middag, men der er fortsat kødannelse."</blockquote>
        <p>Trafikanter opfordres til at køre forsigtigt og holde god afstand.</p>
      </div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- ARTIKEL: BYRÅD -->
  <div id="art-byraad" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">POLITIK & BYMIDTE</span>
      <h2 class="article-heading">Nyt flertal på rådhuset vil investere 45 millioner i bymidten</h2>
      <p class="article-lead">En historisk investering over de næste tre år skal skabe fornyelse af gågaderne og handelslivet i Slagelse.</p>
      <div style="font-size:12px; color:var(--ink-3); margin-bottom:16px;">Af Thomas Bach · 4 t. siden</div>
      <div class="article-hero-box"><div class="card-img-cover img-bymidte"></div></div>
      <div class="article-prose">
        <p>Aftalen omfatter omlægning af belægningen på Nytorv, nye grønne opholdsrum samt bedre belysning.</p>
        <blockquote class="article-pullquote">"Vi vil have en levende bymidte med liv og handel frem for tomme lokaler."</blockquote>
      </div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- ARTIKEL: SOMMERHUSE -->
  <div id="art-sommerhuse" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">KRIMI & TRYGHED</span>
      <h2 class="article-heading">Flere sommerhuse udsat for indbrud ved Skælskør Næs</h2>
      <p class="article-lead">Beboere og grundejerforening opfordres til årvågenhed efter nattens indbrud i weekenden.</p>
      <div style="font-size:12px; color:var(--ink-3); margin-bottom:16px;">Af Mette Lindegaard · 6 t. siden</div>
      <div class="article-hero-box"><div class="card-img-cover img-sommerhus"></div></div>
      <div class="article-prose">
        <p>Tyvene er gået efter værktøj, designmøbler og elektronik i de ubeboede sommerhuse langs kysten.</p>
      </div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- ARTIKEL: BUTIK -->
  <div id="art-butik" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">ERHVERV & HANDEL</span>
      <h2 class="article-heading">Ny butikskæde åbner på Schweizerpladsen til foråret</h2>
      <p class="article-lead">Bæredygtig detail og lokalt håndværk skaber nyt liv og arbejdspladser i centrum af Slagelse.</p>
      <div class="article-hero-box"><div class="card-img-cover img-erhverv"></div></div>
      <div class="article-prose">
        <p>Butikken rummer også en hyggelig kaffebar og vil afholde kreative workshops med lokale kunsthåndværkere.</p>
      </div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- ARTIKEL: SPORT -->
  <div id="art-sport" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">LOKALSPORT</span>
      <h2 class="article-heading">Slagelse B&I henter dramatisk overtidssejr på Harboe Arena</h2>
      <p class="article-lead">Mål i 93. minut udløste jubel foran 1.100 tilskuere.</p>
      <div class="article-hero-box"><div class="card-img-cover img-fodbold"></div></div>
      <div class="article-prose">
        <p>Slagelse fastholder sin topplacering efter en hæsblæsende fight mod gæsterne.</p>
      </div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- ARTIKEL: TUDE Å -->
  <div id="art-tudeaa" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">NATUR & MILJØ</span>
      <h2 class="article-heading">Nyt vådområdeprojekt ved Tude Å beskytter mod oversvømmelser</h2>
      <p class="article-lead">140 hektar lavbundsjord omlægges i historisk samarbejde mellem kommune og lodsejere.</p>
      <div class="article-hero-box"><div class="card-img-cover img-natur"></div></div>
      <div class="article-prose">
        <p>Projektet fjerner kvælstof og skaber samtidig nye rekreative stier for områdets borgere.</p>
      </div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- ARTIKEL: DEBAT -->
  <div id="art-debat" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">DEBATINDLÆG</span>
      <h2 class="article-heading">"Vi må og skal bevare de grønne åndehuller i Slagelse Kommune"</h2>
      <p class="article-lead">Debatindlæg af Lise Holm, borger i Korsør: Hvorfor vi ikke må ofre byens oaser.</p>
      <div class="article-hero-box"><div class="card-img-cover img-debat"></div></div>
      <div class="article-prose">
        <p>Når vi planlægger fremtidens kommune, må målet ikke kun være mursten og tal, men også livskvalitet og natur.</p>
      </div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- ARTIKEL: FORENINGSLIV -->
  <div id="art-foreningsliv" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">FORENINGSLIV</span>
      <h2 class="article-heading">120 frivillige hædret ved årets foreningsfest i Korsør</h2>
      <p class="article-lead">Ildsjæle fra idræt, spejdere og ældreklubber hyldet for deres indsats for fællesskabet.</p>
      <div class="article-hero-box"><div class="card-img-cover img-bymidte"></div></div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- ARTIKEL: KULTUR -->
  <div id="art-kultur" class="article-modal">
    <div class="article-modal-card">
      <a href="#forside" class="article-modal-close" title="Luk">&times;</a>
      <span class="section-kicker">KULTUR</span>
      <h2 class="article-heading">Musikhuset Slagelse løfter sløret for et stærkt forårsprogram</h2>
      <p class="article-lead">Fra intime koncerter på Badeanstalten til store teateropsætninger i Musikhuset.</p>
      <div class="article-hero-box"><div class="card-img-cover img-bymidte"></div></div>
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);">
        <a href="#forside" class="site-community-btn" style="background:var(--site-accent); color:#fff;">← Tilbage til oversigten</a>
      </div>
    </div>
  </div>

  <!-- 5. FOOTER -->
  <footer class="site-footer">
    <div class="site-container">
      <div class="site-footer-grid">
        <div>
          <div class="site-footer-brand">Slagelse<span style="color:#34D399; font-style:italic;">Lokalt</span></div>
          <p style="font-size:13.5px; line-height:1.5; color:#94A3B8; margin-bottom:14px;">
            Lokaljournalistik, der sætter fællesskabet først. Skabt i tæt dialog med borgere og lokalt erhvervsliv i Slagelse Kommune.
          </p>
          <div style="font-size:12.5px; color:#CBD5E1;">
            📍 Nytorv 8, 4200 Slagelse · ✉️ redaktion@slagelselokalt.dk
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
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#fff; margin-bottom:10px;">Områder</div>
          <ul class="site-footer-links">
            <li><a href="#forside">Slagelse by</a></li>
            <li><a href="#forside">Korsør & Halsskov</a></li>
            <li><a href="#forside">Skælskør & Agersø</a></li>
            <li><a href="#forside">Dalmose & Flakkebjerg</a></li>
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
        &copy; 2026 SlagelseLokalt · En del af [By]Lokalt netværket i Danmark.
      </div>
    </div>
  </footer>

  <!-- SCRIPT FOR PROGRESSIVE ENHANCEMENT (NÅR JS ER TIL STEDE) -->
  <script>
    function toggleMobileMenu() {{
      const d = document.getElementById('mobile-drawer');
      if (d) d.classList.toggle('is-open');
    }}

    const nabolagData = {{
      'Slagelse C': '4 nye projekter godkendt i bymidten. Håndværkere er gået i gang ved Nytorv.',
      'Korsør': 'Storebæltstrafikken afvikles i ét spor mod Vest. Ny skater- og multihal planlægges.',
      'Skælskør': 'Øget patruljering efter sommerhusindbrud ved Skælskør Næs.',
      'Dalmose': 'Lokalrådet inviterer til borgermøde om forbedret kollektiv bustransport.'
    }};

    function setNabolag(area, btn) {{
      document.querySelectorAll('.site-nabolag-pill').forEach(b => b.classList.remove('is-active'));
      if (btn) btn.classList.add('is-active');
      const box = document.getElementById('nabolag-box');
      if (box && nabolagData[area]) {{
        box.innerHTML = '<strong>' + area + ':</strong> ' + nabolagData[area];
      }}
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
      if (supportMode === 'fast') {{
        btn.innerText = 'Støt med ' + planName + ' (' + planPrice + ' kr. / md)';
      }} else {{
        const ft = customFreq === 'monthly' ? 'pr. md.' : 'engang';
        btn.innerText = 'Støt med ' + customAmount + ' kr. (' + ft + ')';
      }}
    }}

    function submitSupport() {{
      if (supportMode === 'fast') {{
        alert('Tusind tak! Dit medlemskab med ' + planName + ' (' + planPrice + ' kr./md) er nu oprettet. Tak fordi du bakker op om SlagelseLokalt!');
      }} else {{
        const ft = customFreq === 'monthly' ? 'hver måned' : 'som engangsbidrag';
        alert('Tusind tak! Dit bidrag på ' + customAmount + ' kr. (' + ft + ') er modtaget. Du gør en direkte forskel for lokaljournalistikken!');
      }}
    }}

    function submitTip() {{
      const title = document.getElementById('tip-title').value;
      const name = document.getElementById('tip-name').value;
      alert('Mange tak, ' + name + '! Din henvendelse "' + title + '" er modtaget hos redaktionen.');
    }}

    // Søgemaskine
    const stories = [
      {{ id: 'art-storebaelt', title: 'Kødannelse på Storebæltsbroen mod Fyn efter trafikuheld', cat: 'Trafik' }},
      {{ id: 'art-byraad', title: 'Nyt flertal på rådhuset vil investere 45 millioner i bymidten', cat: 'Politik' }},
      {{ id: 'art-sommerhuse', title: 'Flere sommerhuse udsat for indbrud ved Skælskør Næs', cat: 'Krimi' }},
      {{ id: 'art-butik', title: 'Ny butikskæde åbner på Schweizerpladsen til foråret', cat: 'Erhverv' }},
      {{ id: 'art-sport', title: 'Slagelse B&I overtidssejr på Harboe Arena', cat: 'Sport' }},
      {{ id: 'art-tudeaa', title: 'Nyt vådområdeprojekt ved Tude Å beskytter mod oversvømmelser', cat: 'Natur' }},
      {{ id: 'art-debat', title: 'Debat: "Vi må bevare de grønne åndehuller i kommunen"', cat: 'Debat' }},
      {{ id: 'art-foreningsliv', title: '120 frivillige hædret ved årets foreningsfest i Korsør', cat: 'Foreningsliv' }},
      {{ id: 'art-kultur', title: 'Musikhuset Slagelse løfter sløret for forårsprogram', cat: 'Kultur' }}
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

    window.addEventListener('DOMContentLoaded', () => {{
      runLiveSearch('');
    }});
  </script>
</body>
</html>
'''

with open('nyhedssite.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"nyhedssite.html generated. Size: {len(html_content):,} bytes")
