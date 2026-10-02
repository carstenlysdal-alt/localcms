#!/usr/bin/env python3
"""Bygger nyhedssite.html (statisk prototype af lokalmedie-netværket).

Dette script er kilden til nyhedssite.html. Kør:  python3 build_nyhedssite.py
(Det læser base64-billederne fra den eksisterende nyhedssite.html, så den skal ligge ved siden af.)

Valgfrit: SITE_URL=https://eksempel.dk python3 build_nyhedssite.py  -> absolut canonical/og:url/JSON-LD url.
Uden SITE_URL sættes canonical/og:url først i browseren (kun ved http/https), så der ikke opfindes et domæne.

Alt indhold (navne, tal, hændelser) er EKSEMPELINDHOLD til prototypen.
Byggetrinnet til sidst fejler (exit 1) ved døde interne ankre, dublerede id'er eller ukendte by-nøgler.
"""
import html as _html
import json
import os
import re
import sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(HERE, 'nyhedssite.html')
SITE_URL = os.environ.get('SITE_URL', '').rstrip('/')

with open(OUT_PATH, 'r', encoding='utf-8') as f:
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

# ---------------------------------------------------------------------------
# BASIS-CSS (uændret design; {{ }} er f-string-escapes)
# ---------------------------------------------------------------------------
CSS_BASE = f'''
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
'''

# ---------------------------------------------------------------------------
# EKSTRA CSS (tilgængelighed, nye komponenter). Almindelig streng (enkelt {}).
# ---------------------------------------------------------------------------
CSS_EXTRA = '''
    /* ===== FIX-STATISK-SITE: tilgængelighed og nye komponenter ===== */
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
    .skip-link {
      position: absolute; left: 12px; top: -70px; z-index: 3000;
      background: #0F172A; color: #FFFFFF; padding: 10px 16px;
      border-radius: var(--radius-sm); font-weight: 700; font-size: 14px;
      transition: top 0.15s;
    }
    .skip-link:focus { top: 12px; }
    #main:focus { outline: none; }
    :focus-visible { outline: 3px solid var(--site-accent); outline-offset: 2px; }
    .site-network-bar :focus-visible, .site-footer :focus-visible { outline-color: #FFFFFF; }
    .site-hero-overlay-card:focus-visible { outline-color: #FFFFFF; outline-offset: -5px; }
    .mobile-bottom-item:focus-visible { outline-offset: -4px; }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
    }

    /* Artikler vises kun når de er målet (deep link / klik fra kort) */
    .article-full-page { display: none; }
    .article-full-page:target, .article-full-page.is-open { display: block; }

    /* Kort: stretched link, så kicker kan være eget link uden indlejrede <a> */
    .site-card { position: relative; }
    .site-card-link { color: inherit; }
    .site-card-link::after { content: ''; position: absolute; inset: 0; z-index: 1; }
    .site-card-link:focus-visible { outline: none; }
    .site-card:focus-within { outline: 3px solid var(--site-accent); outline-offset: 2px; }
    a.site-card-kicker, a.section-kicker { position: relative; z-index: 2; align-self: flex-start; display: inline-block; }
    a.site-card-kicker:hover, a.section-kicker:hover { text-decoration: underline; }
    a.section-kicker { display: block; }
    .site-card-meta .sample-tag { font-weight: 600; }
    .is-collapsed .is-extra { display: none; }
    .site-wire-item { text-decoration: none; }

    .sample-badge {
      display: inline-block; font-size: 11px; font-weight: 700;
      background: #FEF3C7; color: #92400E; padding: 3px 10px; border-radius: 999px;
    }
    .section-cta-row {
      display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
      margin: -8px 0 8px 0;
    }
    .section-cta-row p { font-size: 13.5px; color: var(--ink-2); margin-right: 4px; }
    .btn-soft {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 13px; font-weight: 700; color: var(--site-accent);
      background: var(--site-accent-soft); border: 1px solid var(--site-accent);
      padding: 8px 14px; border-radius: var(--radius-sm); cursor: pointer;
    }
    .btn-soft:hover { opacity: 0.9; }

    /* Områder / nabolag */
    .nabolag-links { list-style: none; margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
    .nabolag-links a { color: var(--site-accent); font-weight: 600; text-decoration: underline; }
    #nabolag { scroll-margin-top: 80px; }

    /* Artikler: relaterede, forrige/næste */
    .article-related { margin-top: 32px; padding-top: 18px; border-top: 1px solid var(--line); }
    .article-related h3 { font-family: var(--font-display); font-size: 20px; font-weight: 800; margin-bottom: 10px; }
    .article-related ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .article-related li { font-size: 14.5px; }
    .article-related a.rel-title { font-weight: 700; color: var(--ink); text-decoration: underline; text-decoration-color: var(--line); }
    .article-related a.rel-title:hover { color: var(--site-accent); text-decoration-color: var(--site-accent); }
    .article-related .rel-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--site-accent); margin-left: 6px; }
    .article-prevnext { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 22px; }
    @media (min-width: 640px) { .article-prevnext { grid-template-columns: 1fr 1fr; } }
    .article-prevnext a {
      display: block; padding: 12px 14px; border: 1px solid var(--line);
      border-radius: var(--radius-md); background: var(--surface-2); font-size: 13.5px; font-weight: 600;
    }
    .article-prevnext a:hover { border-color: var(--site-accent); }
    .article-prevnext .pn-dir { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 3px; }
    .article-prevnext .pn-next { text-align: right; }
    .article-bottom-actions .actions-right { display: flex; flex-wrap: wrap; gap: 8px; }
    .article-top-nav-bar { gap: 10px; flex-wrap: wrap; }

    /* "Vis alle"-knap */
    .expand-row { display: flex; justify-content: center; margin: -6px 0 14px 0; }

    /* Formularer */
    .form-status {
      background: var(--site-accent-soft); border: 1px solid var(--site-accent);
      color: var(--ink); border-radius: var(--radius-sm); padding: 12px 14px;
      font-size: 13.5px; line-height: 1.5; margin-bottom: 14px;
    }
    .form-status[hidden] { display: none; }
    .form-status:focus { outline: none; }
    .form-status.is-error { background: #FEF2F2; border-color: #DC2626; }
    .product-chip {
      display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
      background: var(--site-accent-soft); border: 1px solid var(--site-accent);
      border-radius: var(--radius-sm); padding: 8px 12px; font-size: 13px; font-weight: 600;
    }
    .product-chip[hidden] { display: none; }
    .product-chip button { font-size: 12px; font-weight: 700; color: var(--site-accent); text-decoration: underline; }
    .tip-mode-tabs { flex-wrap: nowrap; }
    .support-toggle-btn { border: none; background: transparent; font-family: inherit; }
    .support-plan-card { text-align: left; font-family: inherit; }
    .support-plan-card:focus-visible { outline: 3px solid var(--site-accent); outline-offset: 2px; }
    .custom-amt-btn:focus-visible { outline-offset: 1px; }
    .site-header-btn-stoet:disabled { opacity: 0.55; cursor: not-allowed; }
    .field-hint { font-size: 12px; color: var(--ink-3); margin-top: 4px; }
    .field-error { font-size: 12px; color: #B91C1C; margin-top: 4px; }
    .form-control[aria-invalid="true"] { border-color: #DC2626; }
    .search-result { display: block; padding: 12px 14px; background: var(--surface-2); border-radius: var(--radius-sm); border: 1px solid var(--line); }
    .search-result:hover { border-color: var(--site-accent); }
    .search-empty { padding: 16px; text-align: center; color: var(--ink-3); }
    .search-empty a { color: var(--site-accent); font-weight: 700; text-decoration: underline; }
    .site-subnav-pill { font-family: inherit; cursor: pointer; }

    /* Om / Kontakt / Privatliv */
    .om-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
    @media (min-width: 860px) { .om-grid { grid-template-columns: repeat(3, 1fr); } }
    .om-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow-sm); scroll-margin-top: 80px; }
    .om-card h3 { font-family: var(--font-display); font-size: 20px; font-weight: 800; margin-bottom: 8px; }
    .om-card p { font-size: 14px; color: var(--ink-2); line-height: 1.55; margin-bottom: 8px; }
    .om-card a { color: var(--site-accent); font-weight: 700; text-decoration: underline; }
    #om-os, #kontakt, #privatliv { scroll-margin-top: 80px; }
    @media (min-width: 768px) {
      .site-footer-grid { grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr; }
    }
    .site-footer-links a:hover { color: #FFFFFF; text-decoration: underline; }
    .footer-note { font-size: 12px; color: #64748B; text-align: center; margin-top: 6px; }
    .floating-back-btn { display: none; }
'''

# ---------------------------------------------------------------------------
# DATA — alt indhold er EKSEMPELINDHOLD
# ---------------------------------------------------------------------------
DEFAULT_CITY = 'slagelse'

SEC_NAMES = {
    'nyheder': 'Nyheder', 'erhverv': 'Erhverv & Handel', 'sport': 'Lokalsporten',
    'kultur': 'Kultur & Oplevelser', 'foreningsliv': 'Foreningsliv & Frivillighed',
    'debat': 'Debat & Holdninger',
}
SEC_SHORT = {
    'nyheder': 'Nyheder', 'erhverv': 'Erhverv', 'sport': 'Sport',
    'kultur': 'Kultur', 'foreningsliv': 'Foreningsliv', 'debat': 'Debat',
}
SEC_ORDER = ['nyheder', 'erhverv', 'sport', 'kultur', 'foreningsliv', 'debat']

# Sektion -> (label, href, tipmode)
SEC_CTA = {
    'nyheder': ('Flere nyheder', '#nyheder', None),
    'erhverv': ('Se mere erhverv', '#erhverv', None),
    'sport': ('Flere sportsnyheder', '#sport', None),
    'kultur': ('Annoncér dit arrangement', '#indsend', 'event'),
    'foreningsliv': ('Indsend et arrangement', '#indsend', 'event'),
    'debat': ('Skriv et debatindlæg', '#indsend', 'debat'),
}

IMG_LABELS = {
    'img-storebaelt': 'Illustration: Storebæltsbroen og motorvejen',
    'img-bymidte': 'Illustration: byens centrum og gågade',
    'img-sommerhus': 'Illustration: sommerhuse ved kysten',
    'img-erhverv': 'Illustration: butik og handelsliv i byen',
    'img-fodbold': 'Illustration: fodboldkamp på hjemmebane',
    'img-natur': 'Illustration: å og vådområde i naturen',
    'img-debat': 'Illustration: debat og borgerindlæg',
}


def S(slug, sec, kicker, title, desc, img, omr, when='I dag', author='Redaktionen',
      tags='', time=None, custom=None):
    return dict(slug=slug, sec=sec, kicker=kicker, title=title, desc=desc, img='img-' + img,
                omr=omr, when=when, author=author, tags=tags, time=time, custom=custom)


# --- Slagelse: de oprindelige artikler (uden opdigtede citater) + nye eksempelhistorier ---
SL_STORIES = [
    S('storebaelt', 'nyheder', 'TRAFIK · STOREBÆLT',
      'Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld',
      'Et trafikuheld spærrer et spor på Storebæltsbroen. Bilister skal forvente længere rejsetid.',
      'storebaelt', 'Korsør', when='2 t. siden', author='Jonas Vestergaard',
      tags='trafik storebælt bro motorvej pendler uheld',
      custom=dict(
          lead='Et trafikuheld med to biler spærrer det ene spor på Storebæltsbroen. Bilister skal forvente ekstra rejsetid.',
          role='Lokaljournalist', published='I dag kl. 09:14', read=3,
          paras=[
              'Vagtchefen ved Sydsjællands og Lolland-Falsters Politi oplyser, at uheldet skete omkring klokken 08.45 lige før højbroen i vestgående retning mod Fyn. Der er tale om et harmonikasammenstød med to personbiler under den tætte morgentrafik.',
              'Ingen personer er kommet alvorligt til skade, men vragdele og en mindre olielækage har gjort det nødvendigt midlertidigt at lukke det højre spor, mens redningsberedskabet og Vejdirektoratet arbejder på stedet.',
              ('fakta', 'Fakta om Storebæltsbroen', [
                  'Omkring 36.000 køretøjer passerer forbindelsen dagligt.',
                  'Aktuel status: 1 spor farbart i vestgående retning med 50 km/t hastighedsbegrænsning.',
                  'Trafikanter rådes til at følge P4 Trafik og Sund & Bælts hjemmeside.']),
              'Politiet opfordrer alle bilister til at udvise tålmodighed, holde behørig afstand og undgå at kigge på uheldsstedet under forbikørsel.',
          ])),
    S('byraad', 'nyheder', 'POLITIK & BYMIDTE',
      'Nyt flertal på rådhuset vil investere 45 millioner i bymidten',
      'Bredt flertal er enige om en historisk investering i handelsliv, grønne pladser og gågader.',
      'bymidte', 'Slagelse C', when='4 t. siden', author='Thomas Bach',
      tags='byråd politik rådhus bymidte investering gågade', time='08:12',
      custom=dict(
          lead='En historisk investering over de næste tre år skal skabe fornyelse af gågaderne og handelslivet i kommunen.',
          role='Rådhusreporter', published='I dag kl. 08:12', read=4,
          cta=('Deltag i debatten', '#debat', None),
          paras=[
              'Efter måneders forhandlinger er et bredt flertal i byrådet blevet enige om en stor fornyelsespakke til bymidten. Målet er at modvirke butiksdød, skabe flere grønne opholdsarealer og gøre det mere attraktivt at handle lokalt.',
              'Aftalen indeholder blandt andet midler til modernisering af belægningen på torvet, etablering af nye byhaver med bænke samt en markant opgradering af gadebelysningen.',
              ('fakta', 'Hovedpunkter i bymidteplanen', [
                  'Samlet budget: 45 mio. kr. over årene 2026-2028.',
                  'Nytorv og tilstødende gågader renoveres med natursten og træbeplantning.',
                  'Etablering af gratis korttidsparkering for at styrke detailhandlen.']),
              'Arbejdet forventes igangsat til foråret og vil blive udført i etaper for at genere handelslivet mindst muligt.',
          ])),
    S('sommerhuse', 'nyheder', 'KRIMI & TRYGHED',
      'Flere sommerhuse udsat for indbrud langs kysten',
      'Politiet opfordrer sommerhusejere og naboer til øget årvågenhed efter stribe indbrud i weekenden.',
      'sommerhus', 'Skælskør', when='6 t. siden', author='Mette Lindegaard',
      tags='politi indbrud sommerhus tryghed kriminalitet skælskør næs', time='07:48',
      custom=dict(
          lead='Beboere og grundejerforening opfordres til årvågenhed efter nattens indbrud i weekenden.',
          role='Kriminalreporter', published='I dag kl. 07:48', read=3,
          cta=('Tip redaktionen', '#indsend', 'tip'),
          paras=[
              'Gerningsmændene har slået til mod mindst fire sommerhuse i weekenden. De er gået efter designmøbler, el-værktøj og elektronik, mens husene har stået tomme i vinterkulden.',
              'Lokalpolitiet efterlyser vidner, der måtte have set mistænkelige varebiler i området sent fredag eller lørdag aften.',
              'Politiet opfordrer sommerhusejere til at tilmelde sig Nabohjælp og fjerne værdigenstande, når huset forlades.',
              'Grundejerforeningen overvejer nu i samarbejde med politiet at opsætte midlertidig tryghedskameraovervågning ved indfaldsvejene til sommerhusområdet.',
          ])),
    S('butik', 'erhverv', 'ERHVERV & HANDEL',
      'Ny butikskæde åbner i centrum til foråret',
      'En nyskabende detailforretning med fokus på bæredygtighed slår dørene op til foråret.',
      'erhverv', 'Slagelse C', when='I dag', author='Henrik Friis',
      tags='butik detailhandel handel åbning schweizerpladsen', time='06:32',
      custom=dict(
          lead='Bæredygtig detail og lokalt håndværk skaber nyt liv og arbejdspladser i handelsbyen.',
          role='Erhvervsjournalist', published='I dag kl. 06:32', read=3,
          paras=[
              'Det tomme hjørnelokale på gågaden får nyt liv, når en innovativ detailbutik slår dørene op i marts. Konceptet kombinerer upcycling, genbrugskunst og lokalt producerede fødevarer.',
              'Etableringen skaber 12 nye lokale arbejdspladser og vil desuden rumme en mindre kaffebar, hvor gæster kan mødes til kreative aftener og workshops.',
              'Butikkens ejere forklarer, at de vil give kunderne en personlig oplevelse i det fysiske byliv.',
          ])),
    S('sport', 'sport', 'LOKALSPORT',
      'Dramatisk overtidssejr i topopgøret på hjemmebane',
      'Mål i det 93. minut udløste jubel foran et tætpakket publikum.',
      'fodbold', 'Slagelse C', when='I går', author='Martin Simonsen',
      tags='fodbold sport kamp slagelse b&i eksempel arena', time='22:15',
      custom=dict(
          lead='Mål i det 93. minut udløste jubel foran et tætpakket publikum.',
          role='Sportsreporter', published='I går kl. 22:15', read=3,
          paras=[
              'Det lignede længe en pointdeling efter en hårdt spillet kamp med chancer i begge ender. Men dybt inde i overtiden steg hjemmeholdets anfører til vejrs efter et hjørnespark og headede bolden i netmaskerne til 2-1.',
              'Træneren roste efterfølgende spillernes vilje og takkede publikum for den enorme lydkulisse, der bar holdet frem i de afgørende minutter.',
          ])),
    S('tudeaa', 'nyheder', 'NATUR & MILJØ',
      'Nyt vådområdeprojekt beskytter mod oversvømmelser',
      'Lavbundsjord omlægges i historisk samarbejde mellem kommune og lodsejere.',
      'natur', 'Dalmose', when='I går', author='Astrid Lorentzen',
      tags='natur miljø tude å vådområde oversvømmelse skybrud', time='21:05',
      custom=dict(
          lead='Lavbundsjord omlægges i historisk samarbejde mellem kommune og lodsejere.',
          role='Miljøreporter', published='I går kl. 16:30', read=4,
          paras=[
              'Et stort vådområdeprojekt genslynger nu åen og skaber 140 hektar vådområde. Projektet fjerner mere end 12 tons kvælstof årligt og beskytter samtidig de omkringliggende marker mod oversvømmelser ved kraftige skybrud.',
              'Der etableres desuden nye stier og fugletårne, så naturelskere og skoleklasser kan få glæde af det rige dyreliv.',
          ])),
    S('debat', 'debat', 'DEBATINDLÆG',
      'Vi må bevare de grønne åndehuller i kommunen',
      'Debatindlæg (eksempel): Hvorfor byens oaser ikke bør ofres til fordel for parkeringspladser eller betonbyggeri.',
      'debat', 'Slagelse C', when='I dag', author='Debattør (eksempel)',
      tags='debat borger grøn natur bevar oaser',
      custom=dict(
          lead='Debatindlæg (eksempel): Hvorfor byens oaser ikke bør ofres til fordel for parkeringspladser eller betonbyggeri.',
          role='Eksempelindlæg fra en borger', published='I dag kl. 10:00', read=3,
          paras=[
              'Hver dag møder jeg medborgere, der nyder de grønne åndehuller langs kysten og i parkerne. Det slår mig igen og igen, hvor uvurderlige disse oaser er for vores trivsel, sundhed og fællesskab.',
              'Når vi udvikler fremtidens byer, må vi ikke kun lade os styre af kvadratmeter og kortsigtet profit. Lad os passe på det grønne, som gør vores kommune til et dejligt sted at leve.',
          ])),
    S('foreningsliv', 'foreningsliv', 'FRIVILLIGHED',
      '120 frivillige hædret ved årets foreningsfest',
      'Årets foreningsfest hyldede de ildsjæle, der skaber idræt og fællesskab.',
      'bymidte', 'Slagelse C', when='I går', tags='frivillige forening hædret fest ildsjæle'),
    S('kultur', 'kultur', 'MUSIK & TEATER',
      'Kulturhuset afslører stærkt forårsprogram',
      'Pop, jazz og stand-up comedy gæster scenerne i byen.',
      'bymidte', 'Slagelse C', when='I dag', tags='kultur koncert teater kulturhus program'),
    S('erhvervspark', 'erhverv', 'LOGISTIK',
      'Erhvervspark ved motorvejen udvides markant',
      'Stor efterspørgsel på erhvervsjord tæt ved transportkorridorerne.',
      'erhverv', 'Vemmelev', when='2 dage siden', tags='erhvervspark logistik motorvej erhvervsjord'),
    S('kystturisme', 'erhverv', 'TURISME',
      'Kystturismen melder om rekordhøj interesse',
      'Restauranter og udlejere melder om stor interesse til højsæsonen.',
      'sommerhus', 'Skælskør', when='3 dage siden', tags='turisme kyst udlejning restaurant'),
    S('lobeklub', 'sport', 'MOTION',
      'Løbeklub klar til det store forårsløb',
      'Over 400 tilmeldte motionister i de lokale skove og stier.',
      'natur', 'Vemmelev', when='Søndag', tags='løb motion løbeklub forårsløb'),
    S('svoemning', 'sport', 'SVØMNING',
      'Svømmeklubben sætter fire nye klubrekorder',
      'Guldmedaljer og personlige rekorder til de unge talenter.',
      'bymidte', 'Slagelse C', when='3 dage siden', tags='svømning svømmeklub rekord'),
    S('herreborge', 'kultur', 'HISTORIE',
      'Historiske herreborge åbner for offentligheden',
      'Rundvisninger viser områdets unikke renæssancearv og kunstværker.',
      'sommerhus', 'Skælskør', when='2 dage siden', tags='historie herregård renæssance rundvisning'),
    S('workshops', 'kultur', 'BØRN & FAMILIE',
      'Gratis kreative workshops på bibliotekerne',
      'Kreative værksteder og højtlæsning for børn og unge.',
      'debat', 'Korsør', when='Vinterferie', tags='børn familie bibliotek workshop'),
    S('naturvenner', 'foreningsliv', 'BORGERINITIATIV',
      'Naturvennerne samler affald langs åen',
      'Lokale familier ryddede stierne og sluttede af med bålkaffe.',
      'natur', 'Dalmose', when='Søndag', tags='natur affald forening åen borgerinitiativ'),
    S('lektiehjaelp', 'foreningsliv', 'HJÆLP HINANDEN',
      'Frivilligcentret søger nye lektiehjælpere',
      'Hjælp unge godt videre med skolegang og fritidsliv.',
      'debat', 'Korsør', when='4 dage siden', tags='frivillig lektiehjælp frivilligcenter unge'),
    S('replik', 'debat', 'POLITISK REPLIK',
      'Investeringen i bymidten er nødvendig',
      'Replik (eksempel): Et byrådsmedlem om at styrke de fysiske handelsgader.',
      'bymidte', 'Slagelse C', when='I går', author='Debattør (eksempel)',
      tags='replik byråd politik bymidte investering'),
    S('pendlere', 'debat', 'PENDLERDEBAT',
      'Pendlerne overses i transportplanerne',
      'Debatindlæg (eksempel): Efterlysning af rimeligere bropas og bedre togforbindelser.',
      'storebaelt', 'Korsør', when='2 dage siden', author='Debattør (eksempel)',
      tags='pendler transport bropas tog debat'),
]
SL_WIRE = [('08:12', 'byraad'), ('07:48', 'sommerhuse'), ('06:32', 'butik'), ('22:15', 'sport'), ('21:05', 'tudeaa')]


def _stories(*items):
    return list(items)


CITY_BASE = {
    'slagelse': dict(
        navn='SlagelseLokalt', prefix='Slagelse', by='Slagelse', kommune='Slagelse Kommune',
        accent='#007038', accent_soft='#EBF7EE',
        tagline='Lokaljournalistik, der sætter fællesskabet først',
        omraader=['Slagelse C', 'Korsør', 'Skælskør', 'Dalmose', 'Vemmelev'],
        area_text={'Slagelse C': '4 nye byggeprojekter godkendt i bymidten. Håndværkere er i gang ved Nytorv.'},
        ticker='Storebæltsbroen mod Fyn – Oprydning i gang',
        chips=['Storebælt', 'Byråd', 'Erhverv', 'Sport'],
    ),
    'naestved': dict(
        navn='NæstvedLokalt', prefix='Næstved', by='Næstved', kommune='Næstved Kommune',
        accent='#1F5663', accent_soft='#E8F2F4',
        tagline='Din lokale stemme i Næstved, Karrebæksminde og omegn',
        omraader=['Næstved By', 'Karrebæksminde', 'Fuglebjerg', 'Holme-Olstrup', 'Rønnebæk'],
        area_text={'Næstved By': 'Omfattende renovering af gågadenettet ved Axeltorv starter i næste måned.'},
        ticker='Karrebæksminde: Havne- og klimapromenade godkendt',
        chips=['Byråd', 'Erhverv', 'Sport', 'Kultur', 'Karrebæksminde'],
    ),
    'holbaek': dict(
        navn='HolbækLokalt', prefix='Holbæk', by='Holbæk', kommune='Holbæk Kommune',
        accent='#4F5B1E', accent_soft='#F2F5E8',
        tagline='Lokaljournalistik fra Isefjorden til det åbne Vestsjælland',
        omraader=['Holbæk By', 'Jyderup', 'Tølløse', 'Orø', 'Vipperød'],
        area_text={'Holbæk By': 'Omlægning af havnefronten giver plads til nye caféer og rekreativt byliv.'},
        ticker='Ny grøn elfærge til Orø er sat i drift',
        chips=['Erhverv', 'Sport', 'Kultur', 'Orø'],
    ),
    'ringsted': dict(
        navn='RingstedLokalt', prefix='Ringsted', by='Ringsted', kommune='Ringsted Kommune',
        accent='#8A5A00', accent_soft='#FBF4E6',
        tagline='Nyheder fra hjertet af Sjælland — lokalt og tæt på dig',
        omraader=['Ringsted By', 'Benløse', 'Jystrup', 'Kværkeby', 'Vetterslev'],
        area_text={'Ringsted By': 'Torvet summer af liv efter etablering af nye udendørs serveringsarealer.'},
        ticker='Gratis busser mellem Ringsted Outlet og bymidten',
        chips=['Erhverv', 'Sport', 'Kultur', 'Festival'],
    ),
    'koege': dict(
        navn='KøgeLokalt', prefix='Køge', by='Køge', kommune='Køge Kommune',
        accent='#24533A', accent_soft='#EAF3EE',
        tagline='Lokaljournalistik med blik for Køges vækst, havn og stærke fællesskaber',
        omraader=['Køge By', 'Køge Nord', 'Herfølge', 'Borup', 'Ejby'],
        # Teksten hørte i den gamle version til Køge Nord (ikke første område)
        area_text={'Køge Nord': 'Nye grønne boligkvarterer skyder op med fælleshaver og delebilsordninger.'},
        ticker='Køge Havn indvier ny terminal',
        chips=['Havn', 'Erhverv', 'Sport', 'Kultur'],
    ),
    'roskilde': dict(
        navn='RoskildeLokalt', prefix='Roskilde', by='Roskilde', kommune='Roskilde Kommune',
        accent='#6A3553', accent_soft='#F7EDF3',
        tagline='Kultur, viden og byens puls — lokaljournalistik i Roskilde',
        omraader=['Roskilde By', 'Trekroner', 'Jyllinge', 'Viby Sjælland', 'Svogerslev'],
        area_text={'Roskilde By': 'Historiske brolægninger omkring Domkirken og Algade restaureres med respekt for arven.'},
        ticker='Vikingeskibsmuseet: Ny klimasikret bygning godkendt',
        chips=['Byråd', 'Erhverv', 'Sport', 'Festival'],
    ),
    'kalundborg': dict(
        navn='KalundborgLokalt', prefix='Kalundborg', by='Kalundborg', kommune='Kalundborg Kommune',
        accent='#0284C7', accent_soft='#EBF6FC',
        tagline='Biotekbyen, havnen og livet langs kysten i Kalundborg',
        omraader=['Kalundborg By', 'Høng', 'Gørlev', 'Svebølle', 'Havnsø'],
        area_text={'Kalundborg By': 'Bymidten og havnepromenaden bindes tættere sammen med ny grøn aktivitetsrute.'},
        ticker='Nyt biotek-akademi indviet i Kalundborg',
        chips=['Havn', 'Erhverv', 'Sport', 'Biotek'],
    ),
}

# Øvrige byer: [hero] + 5 wire + foreningsliv + debat (alle EKSEMPELINDHOLD)
OTHER_STORIES = {
    'naestved': dict(
        wire_times=['08:30', '07:55', '06:40', '21:45', '19:20'],
        stories=[
            S('havn', 'nyheder', 'HAVN & KLIMA · KARREBÆKSMINDE',
              'Ny havne- og klimapromenade godkendt: Forvandler Karrebæksminde',
              'En investering på 38 millioner kroner skal sikre havnen mod stormflod og skabe nyt maritimt samlingspunkt.',
              'natur', 'Karrebæksminde', when='1 t. siden', tags='havn klima karrebæksminde stormflod promenade'),
            S('kultur', 'kultur', 'KULTUR · NÆSTVED',
              'Grønnegades Kaserne Kulturcenter melder om rekordstort forårsprogram',
              'Flere koncerter, teaterstykker og udstillinger er på plakaten i foråret.',
              'bymidte', 'Næstved By', tags='kultur koncert teater kulturcenter program'),
            S('cykelstier', 'nyheder', 'POLITIK · BYRÅD',
              'Næstved Byråd afsætter 25 millioner til nye cykelstier i oplandet',
              'Pengene skal give bedre og sikrere cykelforbindelser mellem landsbyerne og byen.',
              'bymidte', 'Fuglebjerg', tags='byråd politik cykelsti trafik'),
            S('fiskere', 'erhverv', 'ERHVERV · FISKERI',
              'Lokale fiskere i Karrebæksminde fejrer starten på forårssæsonen',
              'Havnen er igen i gang med både og lokale fangster efter vinterpausen.',
              'erhverv', 'Karrebæksminde', tags='fiskeri fiskere havn erhverv'),
            S('boldklub', 'sport', 'FODBOLD',
              'Næstved Boldklub henter stærk sejr foran 1.400 tilskuere',
              'Hjemmeholdet vandt en tæt kamp og tog tre vigtige point.',
              'fodbold', 'Næstved By', when='I går', tags='fodbold sport næstved boldklub'),
            S('susaaen', 'nyheder', 'NATUR & MILJØ',
              'Susåen sikres med nyt natur- og vådområde ved Herlufsholm',
              'Projektet skal give mere plads til vandet og et rigere dyreliv langs åen.',
              'natur', 'Holme-Olstrup', when='I går', tags='natur miljø susåen vådområde'),
            S('foreningsdag', 'foreningsliv', 'FRIVILLIGHED',
              'Næstveds ildsjæle samles til foreningsdag',
              'Foreninger fra hele kommunen mødes for at dele erfaringer og finde nye frivillige.',
              'bymidte', 'Rønnebæk', when='I går', tags='forening frivillig ildsjæle'),
            S('debat-axeltorv', 'debat', 'DEBAT',
              'Debat: Hvordan skal Axeltorv bruges i fremtiden?',
              'Borgere og forretningsdrivende inviteres til at dele deres holdning til torvets fremtid.',
              'debat', 'Næstved By', when='2 dage siden', tags='debat axeltorv torv by'),
        ]),
    'holbaek': dict(
        wire_times=['08:15', '07:30', '06:50', '22:00', '20:10'],
        stories=[
            S('faerge', 'nyheder', 'INFRASTRUKTUR · ORØ',
              'Ny grøn elfærge til Orø er sat i drift: Halverer rejsetiden over fjorden',
              'Den nye færgeforbindelse er officielt indviet med gratis overfart for alle øens beboere og pendlere.',
              'natur', 'Orø', when='3 t. siden', tags='færge orø infrastruktur fjord pendler'),
            S('havneby', 'nyheder', 'BOLIGER · HAVNEBY',
              'Holbæk Havneby udvides med 80 nye bæredygtige boliger',
              'Nye boliger i træ og genbrugsmaterialer skal give flere plads ved vandet.',
              'bymidte', 'Holbæk By', tags='boliger havneby byggeri bæredygtig'),
            S('laerlinge', 'erhverv', 'ERHVERV · UNGE',
              'Jyderup Erhvervsforening lancerer nyt lærlinge-initiativ for unge',
              'Lokale virksomheder byder flere unge indenfor i en ny lærlingeordning.',
              'erhverv', 'Jyderup', tags='erhverv lærlinge unge virksomheder'),
            S('fugle', 'nyheder', 'NATUR & MILJØ',
              'Isefjordens fuglereservater oplever markant fremgang i 2026',
              'Flere fuglearter yngler nu ved fjorden, viser årets optælling.',
              'natur', 'Vipperød', tags='natur fugle isefjord reservat'),
            S('bi', 'sport', 'FODBOLD',
              'Holbæk B&I rykker tættere på oprykning efter flot sejr',
              'Sejren giver holdet fornyet medvind i kampen om en oprykningsplads.',
              'fodbold', 'Holbæk By', when='I går', tags='fodbold sport b&i oprykning'),
            S('kulturkasernen', 'kultur', 'KULTUR · KULTURKASERNEN',
              'Kulturkasernen i Holbæk inviterer til gratis forårskoncerter',
              'Programmet byder på musik for både børn og voksne – uden entré.',
              'bymidte', 'Holbæk By', when='I går', tags='kultur koncert kulturkasernen gratis'),
            S('loppemarked', 'foreningsliv', 'FRIVILLIGHED',
              'Frivillige i Tølløse holder fælles loppemarked for ny legeplads',
              'Foreningerne samler ind til nyt legeudstyr ved skolen.',
              'bymidte', 'Tølløse', when='I går', tags='forening frivillig loppemarked legeplads'),
            S('debat-faerge', 'debat', 'DEBAT',
              'Debat: Skal Orø have flere afgange året rundt?',
              'Beboere og pendlere opfordres til at dele erfaringer med færgens køreplan.',
              'debat', 'Orø', when='2 dage siden', tags='debat færge orø køreplan'),
        ]),
    'ringsted': dict(
        wire_times=['08:40', '08:05', '07:15', '21:30', '18:50'],
        stories=[
            S('outlet', 'erhverv', 'ERHVERV & HANDEL · RINGSTED',
              'Ringsted Outlet og bymidten indgår unikt samarbejde med gratis busser',
              'Nyt fælles initiativ skal sikre, at de mange tusinde besøgende i outletbyen også finder vej til handelsgaderne.',
              'erhverv', 'Ringsted By', when='2 t. siden', tags='outlet handel bymidte busser erhverv'),
            S('festival', 'kultur', 'KULTUR · FESTIVAL',
              'Ringsted Festival melder om tæt på udsolgt til jubilæumskoncert',
              'Billetsalget går stærkt til årets store jubilæumskoncert.',
              'bymidte', 'Ringsted By', tags='kultur festival koncert jubilæum'),
            S('cykelsti', 'nyheder', 'TRAFIK · SKOLEVEJ',
              'Ny cykelsti langs Kværkebyvej øger trafiksikkerheden for skolebørn',
              'Stien giver børnene en sikrere vej til skole og fritidsaktiviteter.',
              'bymidte', 'Kværkeby', tags='trafik cykelsti skolevej sikkerhed'),
            S('erhvervspark', 'erhverv', 'ERHVERV · RINGSTED SYD',
              'Erhvervspark Ringsted Syd tiltrækker to nye højteknologiske firmaer',
              'Nye virksomheder flytter ind og skaber flere lokale arbejdspladser.',
              'erhverv', 'Ringsted By', tags='erhvervspark virksomheder arbejdspladser'),
            S('tms', 'sport', 'HÅNDBOLD',
              'TMS Ringsted leverer kæmpe overraskelse i håndboldligaen',
              'Holdet overraskede og vandt over en favorit i weekendens kamp.',
              'fodbold', 'Ringsted By', when='I går', tags='håndbold sport tms'),
            S('haraldsted', 'nyheder', 'NATUR & MILJØ',
              'Oplevelsesstien omkring Haraldsted Sø udvides med nye shelters',
              'Flere overnatningspladser skal gøre stien til en endnu bedre naturoplevelse.',
              'natur', 'Jystrup', when='I går', tags='natur sti haraldsted sø shelter'),
            S('traenere', 'foreningsliv', 'FRIVILLIGHED',
              'Idrætsforeninger i Benløse søger nye trænere',
              'Børneholdene mangler voksne ildsjæle, og foreningerne inviterer til åbent hus.',
              'bymidte', 'Benløse', when='I går', tags='forening frivillig trænere idræt'),
            S('debat-bymidte', 'debat', 'DEBAT',
              'Debat: Hvordan får vi flere ud i bymidten efter lukketid?',
              'Borgere og handlende opfordres til at dele idéer til et mere levende centrum.',
              'debat', 'Ringsted By', when='2 dage siden', tags='debat bymidte byliv'),
        ]),
    'koege': dict(
        wire_times=['08:20', '07:45', '06:30', '22:10', '20:40'],
        stories=[
            S('havn', 'erhverv', 'VÆKST & ERHVERV · KØGE HAVN',
              'Køge Havn indvier ny terminal og skaber 150 nye arbejdspladser',
              'Nordens hurtigst voksende erhvervshavn udvider faciliteterne med 120.000 kvm nyt logistikareal.',
              'erhverv', 'Køge By', when='4 t. siden', tags='havn erhverv terminal logistik arbejdspladser'),
            S('station', 'nyheder', 'TRANSPORT',
              'Køge Nord Station runder milepæl med over 10.000 daglige passagerer',
              'Stationen er blevet et vigtigt knudepunkt for pendlere i regionen.',
              'bymidte', 'Køge Nord', tags='station tog pendler transport'),
            S('kunstvaerksteder', 'kultur', 'KUNST · KØGE BYMIDTE',
              'Kulturstrøget i Køge Bymidte åbner for nye kunstneriske værksteder',
              'Kunstnere får adgang til nye lokaler midt i byen.',
              'bymidte', 'Køge By', tags='kultur kunst værksteder kulturstrøget'),
            S('springhal', 'sport', 'IDRÆT',
              'Herfølge Idrætscenter udvider faciliteterne med ny moderne springhal',
              'Hallen giver gymnaster og springere markant bedre træningsforhold.',
              'fodbold', 'Herfølge', tags='idræt springhal gymnastik sport'),
            S('hb', 'sport', 'FODBOLD',
              'HB Køge tager vigtig sejr foran et feststemt hjemmepublikum',
              'Hjemmesejren giver holdet ro og tre vigtige point.',
              'fodbold', 'Køge By', when='I går', tags='fodbold sport hb køge'),
            S('aastien', 'nyheder', 'NATUR & BYMILJØ',
              'Køge Å-stien renoveres med nye træbroer og forbedret belysning',
              'Renoveringen skal gøre stien mere tryg og tilgængelig hele året.',
              'natur', 'Borup', when='I går', tags='natur å sti belysning broer'),
            S('baalhytte', 'foreningsliv', 'FRIVILLIGHED',
              'Spejdere og naboer bygger fælles bålhytte i Borup',
              'Frivillige giver en hånd med, når den nye bålhytte rejses.',
              'natur', 'Borup', when='I går', tags='forening frivillig spejder bålhytte'),
            S('debat-havn', 'debat', 'DEBAT',
              'Debat: Hvordan skal Køge Havn og byen vokse sammen?',
              'Borgere og virksomheder inviteres til at dele deres synspunkter på havnens udvikling.',
              'debat', 'Køge By', when='2 dage siden', tags='debat havn by udvikling'),
        ]),
    'roskilde': dict(
        wire_times=['08:35', '07:50', '07:10', '21:50', '19:15'],
        stories=[
            S('vikingeskibe', 'kultur', 'KULTURARV · ROSKILDE FJORD',
              'Vikingeskibsmuseets nye klimasikrede museumsbygning godkendt af byrådet',
              'En historisk bevilling sikrer de fem originale vikingeskibe mod fremtidige stormfloder og skaber et nyt vartegn.',
              'bymidte', 'Roskilde By', when='2 t. siden', tags='kultur byråd vikingeskibe museum klima'),
            S('festival', 'kultur', 'MUSIK · FESTIVAL',
              'Eksempel Festival løfter sløret for 24 nye kunstnere',
              'Programmet for sommerens festival er blevet udvidet med nye navne.',
              'bymidte', 'Roskilde By', tags='kultur festival musik koncert'),
            S('ruc', 'nyheder', 'VIDEN · RUC',
              'RUC i Trekroner etablerer nyt forskningscenter for grøn omstilling',
              'Centret skal samle forskere om løsninger på klima og bæredygtighed.',
              'bymidte', 'Trekroner', tags='viden ruc forskning grøn omstilling'),
            S('madmarked', 'erhverv', 'HANDEL · MADMARKED',
              'Stændertorvet omdannes til levende madmarked hver lørdag i foråret',
              'Lokale producenter får stande på torvet hver weekend.',
              'erhverv', 'Roskilde By', tags='handel madmarked torv erhverv'),
            S('kfum', 'sport', 'FODBOLD',
              'Roskilde KFUM vinder topopgør og fastholder førstepladsen',
              'Sejren i topopgøret giver holdet et solidt forspring i rækken.',
              'fodbold', 'Roskilde By', when='I går', tags='fodbold sport kfum'),
            S('jyllinge-havn', 'nyheder', 'KLIMASIKRING',
              'Jyllinge Havn sikres med ny højvandsport og forstærket dige',
              'Tiltagene skal beskytte havnen og bebyggelsen mod stormflod.',
              'natur', 'Jyllinge', when='I går', tags='klima havn jyllinge stormflod dige'),
            S('groent-omraade', 'foreningsliv', 'FRIVILLIGHED',
              'Frivillige i Svogerslev rydder fælles grønt område',
              'Naboer og foreninger gør fælles sag for et pænere nærmiljø.',
              'natur', 'Svogerslev', when='I går', tags='forening frivillig natur nærmiljø'),
            S('debat-festival', 'debat', 'DEBAT',
              'Debat: Hvordan holder vi Roskilde levende uden for festivaltiden?',
              'Borgere og handlende opfordres til at dele idéer til byens liv hele året.',
              'debat', 'Roskilde By', when='2 dage siden', tags='debat byliv festival kultur'),
        ]),
    'kalundborg': dict(
        wire_times=['08:25', '07:40', '06:55', '22:05', '19:30'],
        stories=[
            S('biotek', 'erhverv', 'BIOTEK & UDDANNELSE · KALUNDBORG',
              'Eksempel Virksomhed A og kommunen indvier nyt biotek-akademi',
              'Det nye uddannelsescenter skal uddanne hundredvis af procesteknologer og ingeniører til den voksende industri.',
              'erhverv', 'Kalundborg By', when='1 t. siden', tags='biotek uddannelse akademi erhverv industri'),
            S('krydstogt', 'erhverv', 'HAVN · TURISME',
              'Kalundborg Havn klar til rekordstor krydstogtsæson med 40 anløb',
              'Havnen gør klar til flere gæster og et travlt forår ved kajen.',
              'natur', 'Kalundborg By', tags='havn krydstogt turisme erhverv'),
            S('sundhedshus', 'nyheder', 'SUNDHED · GØRLEV',
              'Nyt sundhedshus i Gørlev samler læger og fysioterapeuter',
              'Flere sundhedstilbud under samme tag skal gøre hverdagen lettere.',
              'bymidte', 'Gørlev', tags='sundhed sundhedshus læger fysioterapeuter'),
            S('ivaerksaetter', 'erhverv', 'ERHVERV · IVÆRKSÆTTERE',
              'Høng Erhvervsråd hædrer årets lokale iværksætter',
              'Prisen går til en virksomhed, der har skabt nye lokale jobs.',
              'erhverv', 'Høng', tags='erhverv iværksætter pris høng'),
            S('gb', 'sport', 'FODBOLD',
              'Kalundborg GB vinder lokalopgør mod Svebølle i serie 1',
              'Lokalopgøret endte med hjemmesejr og stemning på tribunerne.',
              'fodbold', 'Svebølle', when='I går', tags='fodbold sport kalundborg gb svebølle'),
            S('badebro', 'kultur', 'KYST & OPLEVELSER · HAVNSØ',
              'Havnsø Strandpromenade udvides med ny badebro og sauna',
              'Udvidelsen skal give flere en grund til at bruge kysten hele året.',
              'natur', 'Havnsø', when='I går', tags='kyst strand badebro sauna havnsø'),
            S('aabent-hus', 'foreningsliv', 'FRIVILLIGHED',
              'Kalundborgs foreninger holder fælles åbent-hus-dag',
              'Foreningerne viser, hvad de kan tilbyde, og søger nye medlemmer.',
              'bymidte', 'Kalundborg By', when='I går', tags='forening frivillig åbent hus'),
            S('debat-tilflyttere', 'debat', 'DEBAT',
              'Debat: Hvordan får biotekbyen plads til alle nye tilflyttere?',
              'Borgere og virksomheder opfordres til at dele idéer til boliger og skoler.',
              'debat', 'Kalundborg By', when='2 dage siden', tags='debat boliger tilflyttere biotek'),
        ]),
}

CSS_EXTRA += '''
    .plan-state { font-size: 11.5px; font-weight: 700; color: var(--ink-3); }
    .support-plan-card.is-selected .plan-state { color: var(--site-accent); }
'''

# ---------------------------------------------------------------------------
# BYGGER DATA PR. BY
# ---------------------------------------------------------------------------


def e(s):
    return _html.escape(str(s), quote=True)


def build_cities():
    cities = {}
    for key, base in CITY_BASE.items():
        if key == 'slagelse':
            stories = SL_STORIES
            by_slug = {s['slug']: s for s in stories}
            wire_pairs = [(t, by_slug[slug]) for t, slug in SL_WIRE]
        else:
            spec = OTHER_STORIES[key]
            stories = spec['stories']
            wire_pairs = list(zip(spec['wire_times'], stories[1:6]))
            for t, s in wire_pairs:
                s['time'] = t
        for s in stories:
            s['id'] = ('art-' + s['slug']) if key == 'slagelse' else f"art-{key}-{s['slug']}"
        hero = stories[0]
        kommune = base['kommune']
        c = dict(base)
        c.pop('area_text')
        c.pop('ticker')
        c['key'] = key
        c['stories_full'] = stories
        c['omraader'] = [
            {
                'navn': n,
                'tekst': base['area_text'].get(
                    n, f'Aktuelle projekter, byggeplaner og lokale aktiviteter i {n} ({kommune}).'),
                'stories': [{'id': s['id'], 'title': s['title']} for s in stories if s['omr'] == n],
            }
            for n in base['omraader']
        ]
        c['hero_href'] = '#' + hero['id']
        c['hero_img'] = hero['img']
        c['hero_img_label'] = IMG_LABELS[hero['img']]
        c['hero_kicker'] = hero['kicker']
        c['hero_title'] = hero['title']
        c['hero_manchet'] = hero['desc']
        c['hero_author'] = hero['author']
        c['hero_meta'] = hero['when']
        c['ticker'] = {'text': base['ticker'], 'href': c['hero_href']}
        c['wire'] = [{'time': t, 'title': s['title'], 'href': '#' + s['id']} for t, s in wire_pairs]
        c['stories'] = [
            {'id': s['id'], 'href': '#' + s['id'], 'title': s['title'], 'cat': s['kicker'],
             'sec': s['sec'], 'secname': SEC_SHORT[s['sec']], 'tags': s['tags']}
            for s in stories
        ]
        c['topics'] = [s['title'] for s in stories[:5]]
        c['ph'] = {
            'place': f"F.eks. {c['omraader'][0]['navn']} eller {c['omraader'][1]['navn']}",
            'venue': f"F.eks. {c['omraader'][0]['navn']} eller Kulturhuset",
            'org': f"F.eks. {base['by']} Musikforening",
            'company': 'F.eks. Eksempel Byg & Energi A/S',
            'areas': 'F.eks. ' + ', '.join(base['omraader'][:3]),
        }
        c['title'] = f"{base['navn']} – {base['tagline']}"
        c['desc'] = (f"Lokale nyheder, erhverv, sport, kultur, debat og foreningsliv i {kommune}. "
                     f"En del af netværket af lokale medier i Sjælland.")
        c['footer_tagline'] = base['tagline'] + ' · Dækning i ' + kommune + '.'
        cities[key] = c
    return cities


CITIES = build_cities()

# ---------------------------------------------------------------------------
# RENDERERS (kort, artikler, fragmenter)
# ---------------------------------------------------------------------------


def card(s, compact=False, extra=False):
    cls = 'site-card' + (' is-extra' if extra else '')
    th = ' style="height:140px;"' if compact else ''
    ts = ' style="font-size:16px;"' if compact else ''
    ds = ' style="font-size:13px;"' if compact else ''
    meta = '' if compact else (
        f'<div class="site-card-meta"><span>{e(s["author"])}</span><span>{e(s["when"])}</span></div>')
    return (
        f'<div class="{cls}">'
        f'<div class="site-card-thumb"{th}><div class="card-img-cover {s["img"]}" role="img" '
        f'aria-label="{e(IMG_LABELS[s["img"]])}"></div></div>'
        f'<div class="site-card-body">'
        f'<a class="site-card-kicker" href="#{s["sec"]}">{e(s["kicker"])}</a>'
        f'<h3 class="site-card-title"{ts}><a class="site-card-link" href="#{s["id"]}">{e(s["title"])}</a></h3>'
        f'<p class="site-card-desc"{ds}>{e(s["desc"])}</p>{meta}</div></div>'
    )


def published_of(s):
    if s['time']:
        return f"{'I går' if s['when'] == 'I går' else 'I dag'} kl. {s['time']}"
    return s['when']


def article(c, s, order):
    i = order.index(s)
    cu = s['custom']
    navn, kommune = c['navn'], c['kommune']
    if cu:
        lead, role, published, read, paras = cu['lead'], cu['role'], cu['published'], cu['read'], cu['paras']
        cta = cu.get('cta') or SEC_CTA[s['sec']]
    else:
        lead, role, published, read = s['desc'], 'Eksempelartikel', published_of(s), 2
        cta = SEC_CTA[s['sec']]
        paras = [
            f"Dette er en eksempelartikel på {navn}. Den viser, hvordan en lokal historie i sektionen "
            f"{SEC_SHORT[s['sec']]} tager sig ud i layoutet, men beskriver ikke en faktisk begivenhed.",
            f"Overskriften og indledningen er pladsholdere. I en rigtig udgave ville redaktionen her skrive journalistisk "
            f"tekst med kilder, billeder og faktabokse om emnet i {kommune}.",
            ('fakta', 'Om eksempelindholdet', [
                'Alle navne, tal og hændelser er opdigtede til prototypen.',
                'Teksten indeholder ingen citater fra rigtige personer.',
                'Har du en rigtig historie? Brug Tip os-formularen.']),
        ]
    body = []
    for p in paras:
        if isinstance(p, tuple):
            items = ''.join(f'<li>{e(x)}</li>' for x in p[2])
            body.append(
                f'<div class="article-faktaboks"><div class="article-faktaboks-title">{e(p[1])}</div>'
                f'<ul style="padding-left:18px; font-size:13.5px; color:var(--ink-2); line-height:1.6;">{items}</ul></div>')
        else:
            body.append(f'<p>{e(p)}</p>')
    # relaterede
    same = [x for x in order if x is not s and x['sec'] == s['sec']]
    other = [x for x in order if x is not s and x['sec'] != s['sec']]
    related = (same + other)[:3]
    rel_html = ''.join(
        f'<li><a class="rel-title" href="#{x["id"]}">{e(x["title"])}</a>'
        f'<span class="rel-kicker">{e(x["kicker"])}</span></li>' for x in related)
    prev_s = order[i - 1] if i > 0 else None
    next_s = order[i + 1] if i < len(order) - 1 else None
    pn = ''
    if prev_s:
        pn += (f'<a href="#{prev_s["id"]}" rel="prev"><span class="pn-dir">← Forrige historie</span>'
               f'{e(prev_s["title"])}</a>')
    if next_s:
        pn += (f'<a href="#{next_s["id"]}" rel="next" class="pn-next"><span class="pn-dir">Næste historie →</span>'
               f'{e(next_s["title"])}</a>')
    tip = f' data-tipmode="{cta[2]}"' if cta[2] else ''
    secname = SEC_SHORT[s['sec']]
    return (
        f'<article id="{s["id"]}" class="article-full-page" data-sec="{s["sec"]}" aria-labelledby="{s["id"]}-h">'
        f'<div class="article-top-nav-bar">'
        f'<a href="#{s["sec"]}" class="article-back-link" data-back="{s["sec"]}">← Tilbage til <span data-back-label>{e(secname)}</span></a>'
        f'<span class="sample-badge">Eksempelindhold</span></div>'
        f'<a class="section-kicker" href="#{s["sec"]}">{e(s["kicker"])}</a>'
        f'<h2 class="article-heading" id="{s["id"]}-h">{e(s["title"])}</h2>'
        f'<p class="article-lead">{e(lead)}</p>'
        f'<div class="article-byline-bar"><div>Af <strong>{e(s["author"])}</strong> · {e(role)}</div>'
        f'<div>Publiceret: {e(published)} · {read} min. læsetid</div></div>'
        f'<div class="article-hero-box"><div class="card-img-cover {s["img"]}" role="img" '
        f'aria-label="{e(IMG_LABELS[s["img"]])}"></div></div>'
        f'<div class="article-prose">{"".join(body)}</div>'
        f'<aside class="article-related" aria-label="Læs også"><h3>Læs også</h3><ul>{rel_html}</ul></aside>'
        f'<nav class="article-prevnext" aria-label="Forrige og næste historie">{pn}</nav>'
        f'<div class="article-bottom-actions">'
        f'<a href="#{s["sec"]}" class="article-back-link" data-back="{s["sec"]}">← Tilbage til <span data-back-label>{e(secname)}</span></a>'
        f'<div class="actions-right"><a href="{cta[1]}" class="btn-soft"{tip}>{e(cta[0])}</a>'
        f'<a href="#stoet" class="site-header-btn-stoet">Støt {e(navn)}</a></div></div>'
        f'</article>'
    )


def fragments(c):
    st = c['stories_full']
    ids = lambda lst: ''.join(lst)
    out = {}
    out['mid'] = ''.join(card(s) for s in st[1:4])
    out['grid4'] = ''.join(card(s, compact=True) for s in st[4:8])
    ny = [s for s in st if s['sec'] == 'nyheder'] + [s for s in st if s['sec'] != 'nyheder']
    out['nyheder'] = ''.join(card(s, extra=(i >= 3)) for i, s in enumerate(ny))
    for sec in SEC_ORDER[1:]:
        out[sec] = ''.join(card(s) for s in st if s['sec'] == sec)
    out['articles'] = ''.join(article(c, s, st) for s in st)
    return out


def render_wire(c):
    return ''.join(
        f'<a href="{w["href"]}" class="site-wire-item"><span class="site-wire-time">{e(w["time"])}</span>'
        f'<p class="site-wire-headline">{e(w["title"])}</p></a>' for w in c['wire'])


def render_area_box(c, idx):
    o = c['omraader'][idx]
    box = f'<strong>{e(o["navn"])}:</strong> {e(o["tekst"])}'
    if o['stories']:
        box += '<ul class="nabolag-links">' + ''.join(
            f'<li><a href="#{x["id"]}">{e(x["title"])}</a></li>' for x in o['stories']) + '</ul>'
    else:
        box += (f'<p class="nabolag-links">Ingen historier fra {e(o["navn"])} endnu. '
                f'<a href="#indsend" data-tipmode="tip">Tip os om {e(o["navn"])}</a></p>')
    return box


def render_pills(c):
    return ''.join(
        f'<button type="button" class="site-nabolag-pill{" is-active" if i == 0 else ""}" data-area="{i}" '
        f'aria-pressed="{"true" if i == 0 else "false"}">{e(o["navn"])}</button>'
        for i, o in enumerate(c['omraader']))


def render_chips(c):
    return ''.join(f'<button type="button" class="site-subnav-pill" data-term="{e(t)}">{e(t)}</button>'
                   for t in c['chips'])


def render_topics(c):
    return ''.join(f'<option value="{e(t)}">{e(t)}</option>' for t in c['topics']) + \
        '<option value="Andet lokalt emne">Andet lokalt emne (skriv nedenfor)</option>'


def favicon_uri(accent):
    from urllib.parse import quote
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' "
           f"fill='{accent}'/><text x='32' y='46' font-size='40' text-anchor='middle' font-family='Georgia,serif' "
           "font-weight='700' fill='#fff'>L</text></svg>")
    return 'data:image/svg+xml,' + quote(svg, safe='')


def jsonld(c):
    org = {'@type': 'NewsMediaOrganization', '@id': (SITE_URL + '/#organization') if SITE_URL else '#organization',
           'name': c['navn'], 'description': c['tagline'],
           'areaServed': {'@type': 'AdministrativeArea', 'name': c['kommune']}}
    site = {'@type': 'WebSite', 'name': c['navn'], 'description': c['desc'], 'inLanguage': 'da',
            'publisher': {'@id': org['@id']}}
    if SITE_URL:
        org['url'] = SITE_URL + '/'
        site['url'] = SITE_URL + '/'
    return {'@context': 'https://schema.org', '@graph': [org, site]}


def safe_json(obj):
    return json.dumps(obj, ensure_ascii=False).replace('</', '<\\/')


# ---------------------------------------------------------------------------
# TRANSFORMATION AF GENBRUGTE BLOKKE (priser, profil)
# ---------------------------------------------------------------------------
PRODUCTS = [
    ('event', 'Event i kalenderen', '125 kr.'),
    ('sponsor', 'Sponsoreret artikel', '4.995 kr.'),
    ('sponsor', 'Profil i Lokalguiden', '249 kr./md'),
    ('sponsor', 'Ugens Sponsorat', '895 kr./uge'),
    ('sponsor', 'Partnerskab: Naboskab', '795 kr./md'),
    ('sponsor', 'Partnerskab: Fællesskab', '1.995 kr./md'),
    ('sponsor', 'Partnerskab: Fyrtårn', '4.495 kr./md'),
]


def transform_priser(raw):
    it = iter(PRODUCTS)

    def rep(m):
        mode, name, price = next(it)
        assert m.group(1) == mode, (m.group(1), mode)
        return (f'<button type="button" data-mode="{mode}" data-product="{e(name)}" data-price="{e(price)}" '
                f'class="site-header-btn-stoet js-product"')
    out = re.sub(r'<button onclick="selectPriceProduct\(\'(\w+)\'\)" class="site-header-btn-stoet"', rep, raw)
    assert out.count('js-product') == 7
    assert 'På SlagelseLokalt' in out
    out = out.replace('På SlagelseLokalt', 'På <span id="price-city-name">SlagelseLokalt</span>')
    out = out.replace('<section id="priser" class="content-section">', '<section id="priser" class="content-section" aria-labelledby="price-section-title">')
    return out


def transform_profil(raw):
    out = raw
    for fid, lab in (('input-profile-name', 'Dit navn'), ('input-profile-area', 'Dit lokalområde')):
        old = f'<label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">{lab}</label>\n              <input type="text" id="{fid}"'
        assert old in out, fid
        out = out.replace(old, f'<label for="{fid}" style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">{lab}</label>\n              <input type="text" id="{fid}"')
    out = out.replace('Slagelse · Fri læseradgang', '<span id="profile-area-text">Slagelse</span> · Fri læseradgang')
    out = out.replace('value="Slagelse By"', 'value="Slagelse C"')
    out = out.replace('<section id="profil" class="content-section">', '<section id="profil" class="content-section" aria-labelledby="profil-title">')
    out = out.replace('<h2 style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:8px;">Min Brugerprofil</h2>',
                      '<h2 id="profil-title" style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:8px;">Min Brugerprofil</h2>')
    assert 'id="profil-title"' in out
    out = out.replace('<button onclick="toggleProfileEdit()" id="btn-edit-profile" class="site-subnav-pill"',
                      '<button type="button" onclick="toggleProfileEdit()" id="btn-edit-profile" aria-expanded="false" aria-controls="profile-edit-box" class="site-subnav-pill"')
    out = out.replace('<button onclick="toggleProfileEdit()" style=', '<button type="button" onclick="toggleProfileEdit()" style=')
    out = out.replace('<button onclick="saveProfile()"', '<button type="button" onclick="saveProfile()"')
    # emne-piller bliver rigtige til/fra-knapper
    out = re.sub(r'<span class="site-subnav-pill( is-active)?" style="font-size:12px; padding:4px 10px;">([^<]+)</span>',
                 lambda m: f'<button type="button" class="site-subnav-pill{m.group(1) or ""}" data-topic="{e(m.group(2).lstrip("✓+ ").strip())}" aria-pressed="{"true" if m.group(1) else "false"}" style="font-size:12px; padding:4px 10px;">{m.group(2)}</button>',
                 out)
    assert out.count('data-topic=') == 5
    out = out.replace('<div style="display:flex; justify-content:flex-end; gap:8px;">',
                      '<div id="profile-status" class="form-status" role="status" aria-live="polite" hidden tabindex="-1"></div>\n          <div style="display:flex; justify-content:flex-end; gap:8px;">', 1)
    out = out.replace('<div style="font-size:14.5px; font-weight:700; color:var(--ink); margin-bottom:8px;">🏷️ Følg emner</div>',
                      '<div style="font-size:14.5px; font-weight:700; color:var(--ink); margin-bottom:8px;"><span aria-hidden="true">🏷️</span> Følg emner</div>')
    return out

# ---------------------------------------------------------------------------
# HTML-SKELET (almindelig streng; tokens @@NAVN@@ udskiftes ved bygning)
# ---------------------------------------------------------------------------
SK_HEAD = '''<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title id="doc-title">@@TITLE@@</title>
  <meta name="description" id="meta-description" content="@@DESC@@">
  <meta name="theme-color" id="meta-theme-color" content="@@ACCENT@@">
  <link rel="icon" id="favicon" type="image/svg+xml" href="@@FAVICON@@">
@@CANONICAL@@  <meta property="og:type" content="website">
  <meta property="og:locale" content="da_DK">
  <meta property="og:site_name" id="og-site-name" content="@@NAVN@@">
  <meta property="og:title" id="og-title" content="@@TITLE@@">
  <meta property="og:description" id="og-description" content="@@DESC@@">
@@OGURL@@  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" id="tw-title" content="@@TITLE@@">
  <meta name="twitter:description" id="tw-description" content="@@DESC@@">
  <script type="application/ld+json" id="jsonld">@@JSONLD@@</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
@@CSS@@
  </style>
</head>
<body>
  <a href="#main" class="skip-link">Spring til hovedindholdet</a>

  <!-- 1. TOP NETWORK STRIP WITH ALL CITIES -->
  <div class="site-network-bar">
    <div class="site-container site-network-inner">
      <nav class="site-network-left" aria-label="Skift by i netværket">
        <span class="site-network-badge"><span class="site-network-dot" style="background:var(--site-accent);"></span> Lokalt-netværket:</span>
@@NETBTNS@@
      </nav>
      <div class="site-network-right">
        <a href="@@TICKER_HREF@@" id="net-ticker-text">
          <span class="live-dot-pulse"></span>
          <span><strong>LIVE:</strong> <span id="ticker-label">@@TICKER_TEXT@@</span></span>
        </a>
      </div>
    </div>
  </div>

  <!-- 2. STICKY HEADER -->
  <header class="site-header-wrapper">
    <div class="site-container site-header-inner">
      <div class="site-brand-container">
        <div>
          <a href="#forside" class="site-brand-logo" aria-label="@@NAVN@@ – til forsiden" id="brand-link">
            <span id="site-logo-prefix">@@PREFIX@@</span><span class="site-brand-logo-accent">Lokalt</span>
          </a>
          <span id="site-brand-tagline" class="site-brand-tagline">@@TAGLINE@@</span>
        </div>

        <!-- City switcher dropdown in header -->
        <div style="position:relative;">
          <button type="button" onclick="toggleCityDropdown()" id="header-city-btn" class="site-city-picker-btn" title="Skift til en anden by/kommune" aria-haspopup="true" aria-expanded="false" aria-controls="city-dropdown">
            <span id="header-city-name">@@BY@@</span> <span aria-hidden="true">▾</span>
          </button>

          <!-- Dropdown menu popup -->
          <div id="city-dropdown" class="city-dropdown-menu" role="group" aria-label="Vælg by / kommune">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--ink-3); padding:4px 8px 6px 8px; border-bottom:1px solid var(--line);">Vælg by / kommune</div>
@@DROPITEMS@@
          </div>
        </div>

        <!-- Desktop Navigation Links -->
        <nav class="site-header-primary-nav" aria-label="Hovednavigation">
          <ul class="site-header-primary-list">
            <li><a href="#forside" class="site-header-primary-link is-active" aria-current="true">Forside</a></li>
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
        <a href="#soeg" class="site-btn-icon" title="Søg i nyheder" aria-label="Søg i nyheder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </a>

        <!-- User profile icon button (Public reader profile, NOT CMS login) -->
        <a href="#profil" class="site-btn-icon" title="Min brugerprofil" aria-label="Min brugerprofil">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </a>

        <!-- Support compact button with dynamic site name -->
        <a href="#stoet" id="header-stoet-btn" class="site-header-btn-stoet">
          <span aria-hidden="true">❤️</span>
          <span id="header-stoet-label">Støt @@BY@@</span>
        </a>

        <!-- Mobile hamburger button -->
        <button type="button" onclick="toggleMobileMenu()" class="site-hamburger-btn" aria-label="Åbn menu" aria-expanded="false" aria-controls="mobile-drawer" data-drawer-toggle>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- 3. MOBILE SUBNAV PILLS (HORIZONTALLY SCROLLABLE) -->
  <nav class="site-subnav-strip" aria-label="Sektioner">
    <div class="site-subnav-pills-list">
      <a href="#forside" class="site-subnav-pill is-active" aria-current="true">Forside</a>
      <a href="#nyheder" class="site-subnav-pill">Nyheder</a>
      <a href="#erhverv" class="site-subnav-pill">Erhverv</a>
      <a href="#sport" class="site-subnav-pill">Sport</a>
      <a href="#kultur" class="site-subnav-pill">Kultur</a>
      <a href="#foreningsliv" class="site-subnav-pill">Foreningsliv</a>
      <a href="#debat" class="site-subnav-pill">Debat</a>
      <a href="#priser" class="site-subnav-pill" style="color:var(--site-accent); font-weight:700;">Priser &amp; Annoncer</a>
      <a href="#stoet" class="site-subnav-pill">Støt os</a>
      <a href="#indsend" class="site-subnav-pill">Tip os</a>
      <button type="button" onclick="toggleMobileMenu()" class="site-subnav-pill" aria-expanded="false" aria-controls="mobile-drawer" data-drawer-toggle>Mere</button>
    </div>
  </nav>

  <!-- 4. MOBILE DRAWER OVERLAY -->
  <div id="mobile-drawer" class="mobile-drawer-overlay" data-drawer-overlay>
    <div class="mobile-drawer-content" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="mobile-drawer-header">
        <div class="site-brand-logo" style="font-size:20px;">
          <span id="drawer-logo-prefix">@@PREFIX@@</span><span class="site-brand-logo-accent">Lokalt</span>
        </div>
        <button type="button" id="drawer-close" onclick="toggleMobileMenu(false)" aria-label="Luk menu" style="font-size:24px; color:var(--ink-3);"><span aria-hidden="true">&times;</span></button>
      </div>

      <!-- Vælg by sektion i mobilskuffen -->
      <div style="background:var(--surface-2); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--line);">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--ink-3); margin-bottom:8px;">Vælg by / netværk:</div>
        <div style="display:flex; flex-wrap:wrap; gap:5px;">
@@DRAWERBTNS@@
        </div>
      </div>

      <ul class="mobile-drawer-links">
        <li><a href="#forside" class="mobile-drawer-link">Forside <span aria-hidden="true">→</span></a></li>
        <li><a href="#nyheder" class="mobile-drawer-link">Nyheder <span aria-hidden="true">→</span></a></li>
        <li><a href="#erhverv" class="mobile-drawer-link">Erhverv <span aria-hidden="true">→</span></a></li>
        <li><a href="#sport" class="mobile-drawer-link">Sport <span aria-hidden="true">→</span></a></li>
        <li><a href="#kultur" class="mobile-drawer-link">Kultur <span aria-hidden="true">→</span></a></li>
        <li><a href="#foreningsliv" class="mobile-drawer-link">Foreningsliv <span aria-hidden="true">→</span></a></li>
        <li><a href="#debat" class="mobile-drawer-link">Debat <span aria-hidden="true">→</span></a></li>
        <li><a href="#soeg" class="mobile-drawer-link">Søg i artikler <span aria-hidden="true">🔍</span></a></li>
        <li><a href="#profil" class="mobile-drawer-link">Min brugerprofil <span aria-hidden="true">👤</span></a></li>
        <li><a href="#priser" class="mobile-drawer-link" style="color:var(--site-accent); font-weight:700;">Priser &amp; Annoncering <span aria-hidden="true">🏷️</span></a></li>
        <li><a href="#indsend" class="mobile-drawer-link">Tip os &amp; Indsend <span aria-hidden="true">✍️</span></a></li>
        <li><a href="#om" class="mobile-drawer-link">Om, kontakt &amp; privatliv <span aria-hidden="true">ℹ️</span></a></li>
        <li><a href="#stoet" class="mobile-drawer-link" style="color:var(--site-accent); font-weight:700;"><span id="drawer-stoet-label">Støt @@NAVN@@</span> <span aria-hidden="true">❤️</span></a></li>
      </ul>
    </div>
  </div>

  <!-- MAIN CONTENT CONTAINER -->
  <main id="main" tabindex="-1" class="site-container site-main-content">
    <h1 class="sr-only" id="page-h1">@@H1@@</h1>

    <!-- ============================================== -->
    <!-- SEKTION 1: FORSIDE & TOP GRID                  -->
    <!-- ============================================== -->
    <section id="forside" class="content-section">
      <!-- 3-COL TOP GRID -->
      <div class="site-top-3col-grid">
        <!-- Hero Card (Native image background via CSS) -->
        <a href="@@HERO_HREF@@" id="hero-card" class="site-hero-overlay-card">
          <div id="hero-bg" class="site-hero-bg-layer card-img-cover @@HERO_IMG@@" role="img" aria-label="@@HERO_IMG_LABEL@@"></div>
          <div class="site-hero-gradient"></div>
          <div class="site-hero-content">
            <div class="site-hero-top-meta" id="hero-meta-byline">@@HERO_META@@</div>
            <span id="hero-kicker" class="site-hero-subkicker">@@HERO_KICKER@@</span>
            <h2 id="hero-title" class="site-hero-title">@@HERO_TITLE@@</h2>
            <p id="hero-manchet" class="site-hero-manchet">@@HERO_MANCHET@@</p>
            <div class="site-hero-actions-row">
              <span class="site-hero-btn-read">
                <span>Læs artiklen</span>
                <span style="font-size:14px; margin-left:3px;" aria-hidden="true">→</span>
              </span>
              <span class="site-hero-live-badge">
                <span class="hero-live-dot"></span>
                <span>LIVE</span>
              </span>
            </div>
          </div>
        </a>

        <!-- Wire Card: Seneste nyt -->
        <aside class="site-wire-card" aria-labelledby="wire-title">
          <div class="site-wire-header">
            <h2 id="wire-title" style="font-family:var(--font-body); font-size:17px; font-weight:800; color:var(--ink);">Seneste nyt<span id="wire-kommune-name" class="sr-only"> i @@KOMMUNE@@</span></h2>
            <a href="#nyheder" data-expand="nyheder" style="font-size:13px; font-weight:700; color:var(--site-accent); text-decoration:none; display:inline-flex; align-items:center; gap:3px;">Se alle <span aria-hidden="true">→</span></a>
          </div>
          <div id="wire-list-container" class="site-wire-list">@@WIRE@@</div>
        </aside>

        <!-- Dit Nabolag Card -->
        <aside id="nabolag" class="site-nabolag-card" aria-labelledby="nabolag-title">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h2 id="nabolag-title" style="font-family:var(--font-display); font-size:20px; font-weight:800;">Dit nabolag</h2>
            <span id="nabolag-kommune-tag" style="font-size:11.5px; color:var(--ink-3);">@@KOMMUNE@@</span>
          </div>
          <div class="site-nabolag-thumb">
            <div class="card-img-cover img-kort" role="img" aria-label="Kort over lokalområderne"></div>
          </div>
          <div id="nabolag-pills-container" class="site-nabolag-pills" role="group" aria-label="Vælg lokalområde">@@PILLS@@</div>
          <div id="nabolag-box" aria-live="polite" style="font-size:13px; color:var(--ink-2); line-height:1.45; padding:10px; background:var(--surface-2); border-radius:var(--radius-sm);">@@NABOLAG_BOX@@</div>
        </aside>
      </div>

      <!-- 3 MELLEM-KORT -->
      <div id="dyn-mid" class="site-middle-3cards-grid">@@FR_mid@@</div>

      <!-- FÆLLESSKABSBANNER -->
      <div class="site-community-banner">
        <div>
          <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#A7F3D0; margin-bottom:6px; display:block;">FÆLLESSKABETS MEDIE</span>
          <h2 id="community-banner-title" class="site-community-title">Vær med til at præge @@NAVN@@</h2>
          <p id="community-banner-desc" class="site-community-desc">
            Vores journalistik skabes i tæt samspil med hverdagen i kommunen. Vi finansieres og formes af borgerne og de lokale virksomheder – og vi modtager altid gerne dine idéer, spørgsmål og historier.
          </p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          <a href="#indsend" data-tipmode="tip" class="site-community-btn">Indsend historie / Tip</a>
          <a href="#stoet" data-support="valgfri" class="site-community-btn" style="background:rgba(255,255,255,0.2); color:#FFFFFF; border:1px solid rgba(255,255,255,0.4);">Støt med valgfrit beløb</a>
        </div>
      </div>

      <!-- 4-GRID (MERE FRA OMRÅDET) -->
      <div id="dyn-grid4" class="site-4grid">@@FR_grid4@@</div>

      <!-- PARTNERE (pladsholdere) -->
      <div class="site-partners-box">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--ink-3);">Lokale støttepartnere (eksempel)</span>
          <a href="#priser" style="font-size:12.5px; font-weight:700; color:var(--site-accent); transition:color 0.3s;">Vil din virksomhed også støtte? Bliv partner her →</a>
        </div>
        <div class="site-partners-logos">
          <span class="site-partner-badge">Eksempel Partner A</span>
          <span class="site-partner-badge">Eksempel Partner B</span>
          <span class="site-partner-badge">Eksempel Partner C</span>
          <span class="site-partner-badge">Eksempel Partner D</span>
          <span class="site-partner-badge">Eksempel Partner E</span>
        </div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 2: NYHEDER                             -->
    <!-- ============================================== -->
    <section id="nyheder" class="content-section" aria-labelledby="section-nyheder-title">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 id="section-nyheder-title" class="section-title">Nyheder fra @@KOMMUNE@@</h2>
        <p class="section-desc">Aktuelt overblik over politik, beredskab, infrastruktur og lokalsamfundet.</p>
      </div>

      <div id="dyn-nyheder" class="site-middle-3cards-grid is-collapsed">@@FR_nyheder@@</div>
      <div class="expand-row">
        <button type="button" id="btn-expand-nyheder" class="btn-soft" aria-expanded="false" aria-controls="dyn-nyheder">Vis alle <span id="expand-count">@@COUNT@@</span> historier</button>
      </div>
      <div class="section-cta-row"><p>Har du set eller hørt noget?</p><a href="#indsend" data-tipmode="tip" class="btn-soft">Tip redaktionen</a></div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 3: ERHVERV                             -->
    <!-- ============================================== -->
    <section id="erhverv" class="content-section" aria-labelledby="section-erhverv-title">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 id="section-erhverv-title" class="section-title">Erhverv &amp; Handel</h2>
        <p class="section-desc">Lokale virksomheder, iværksættere, arbejdspladser og handelsliv i hele kommunen.</p>
      </div>
      <div id="dyn-erhverv" class="site-middle-3cards-grid">@@FR_erhverv@@</div>
      <div class="section-cta-row"><p>Vil din virksomhed være synlig lokalt?</p><a href="#priser" class="btn-soft">Se priser på annoncering</a></div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 4: SPORT                               -->
    <!-- ============================================== -->
    <section id="sport" class="content-section" aria-labelledby="section-sport-title">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 id="section-sport-title" class="section-title">Lokalsporten</h2>
        <p class="section-desc">Fodbold, håndbold, atletik, svømning og breddeidræt i hele kommunen.</p>
      </div>
      <div id="dyn-sport" class="site-middle-3cards-grid">@@FR_sport@@</div>
      <div class="section-cta-row"><p>Spiller din klub en kamp eller holder et stævne?</p><a href="#indsend" data-tipmode="event" class="btn-soft">Indsend et arrangement</a></div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 5: KULTUR                              -->
    <!-- ============================================== -->
    <section id="kultur" class="content-section" aria-labelledby="section-kultur-title">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 id="section-kultur-title" class="section-title">Kultur &amp; Oplevelser</h2>
        <p class="section-desc">Koncerter, teater, udstillinger, biblioteker og historiske seværdigheder.</p>
      </div>
      <div id="dyn-kultur" class="site-middle-3cards-grid">@@FR_kultur@@</div>
      <div class="section-cta-row"><p>Har I et arrangement?</p><a href="#indsend" data-tipmode="event" class="btn-soft">Indsend et arrangement</a></div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 6: FORENINGSLIV                        -->
    <!-- ============================================== -->
    <section id="foreningsliv" class="content-section" aria-labelledby="section-foreningsliv-title">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 id="section-foreningsliv-title" class="section-title">Foreningsliv &amp; Frivillighed</h2>
        <p class="section-desc">Menneskene, der driver vores fællesskaber og klubber.</p>
      </div>
      <div id="dyn-foreningsliv" class="site-middle-3cards-grid">@@FR_foreningsliv@@</div>
      <div class="section-cta-row"><p>Er du en del af en forening?</p><a href="#indsend" data-tipmode="event" class="btn-soft">Indsend et arrangement</a></div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 7: DEBAT                               -->
    <!-- ============================================== -->
    <section id="debat" class="content-section" aria-labelledby="section-debat-title">
      <div class="section-header-box">
        <span class="section-kicker">SEKTION</span>
        <h2 id="section-debat-title" class="section-title">Debat &amp; Holdninger</h2>
        <p class="section-desc">Ordet er frit for alle borgere og foreninger i kommunen.</p>
      </div>
      <div id="dyn-debat" class="site-middle-3cards-grid">@@FR_debat@@</div>
      <div class="section-cta-row"><p>Har du noget på hjerte?</p><a href="#indsend" data-tipmode="debat" class="btn-soft">Skriv et debatindlæg</a></div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 8: STØT (DUAL SUPPORT MODEL)           -->
    <!-- ============================================== -->
    <section id="stoet" class="content-section" aria-labelledby="support-section-title">
      <div class="support-card-container">
        <div style="text-align:center; max-width:600px; margin:0 auto 24px auto;">
          <span class="section-kicker">FÆLLESSKAB &amp; STØTTE</span>
          <h2 id="support-section-title" style="font-family:var(--font-display); font-size:30px; font-weight:800; margin-bottom:8px;">Støt @@NAVN@@</h2>
          <p id="support-section-desc" style="font-size:14.5px; color:var(--ink-2); line-height:1.5;">Vi formes og finansieres af borgerne og erhvervslivet i @@KOMMUNE@@. Vælg en fast pakke eller støt med et valgfrit beløb.</p>
        </div>

        <!-- Toggle mode -->
        <div class="support-mode-toggle" role="tablist" aria-label="Støttemodel">
          <button type="button" role="tab" onclick="setSupportMode('fast')" id="tab-support-fast" aria-selected="true" aria-controls="support-pane-fast" class="support-toggle-btn is-active">Fast støttepakke</button>
          <button type="button" role="tab" onclick="setSupportMode('valgfri')" id="tab-support-valgfri" aria-selected="false" aria-controls="support-pane-valgfri" tabindex="-1" class="support-toggle-btn">Valgfrit beløb</button>
        </div>

        <!-- Fast pakke -->
        <div id="support-pane-fast" role="tabpanel" aria-labelledby="tab-support-fast">
          <div class="support-plans-grid" role="radiogroup" aria-label="Vælg støttepakke">
            <div role="radio" tabindex="0" aria-checked="true" data-plan="Støtte" data-price="49" data-default="Basispakke" class="support-plan-card is-selected">
              <strong style="font-size:16px;">Støtte</strong>
              <div class="support-plan-price">49 kr. <span>/ md</span></div>
              <p style="font-size:12.5px; color:var(--ink-2); line-height:1.4; margin-bottom:12px;">Fri adgang og nyhedsbrev. Du holder journalistikken tilgængelig for alle.</p>
              <span class="plan-state">✓ Valgt</span>
            </div>

            <div role="radio" tabindex="0" aria-checked="false" data-plan="Plus" data-price="79" data-default="Populært valg" class="support-plan-card">
              <strong style="font-size:16px;">Plus</strong>
              <div class="support-plan-price">79 kr. <span>/ md</span></div>
              <p style="font-size:12.5px; color:var(--ink-2); line-height:1.4; margin-bottom:12px;">Alt i Støtte + invitation til årlige redaktionsmøder og emnedialog.</p>
              <span class="plan-state">Populært valg</span>
            </div>

            <div role="radio" tabindex="0" aria-checked="false" data-plan="Lokal Helt" data-price="129" data-default="Ekstra støtte" class="support-plan-card">
              <strong style="font-size:16px;">Lokal Helt</strong>
              <div class="support-plan-price">129 kr. <span>/ md</span></div>
              <p style="font-size:12.5px; color:var(--ink-2); line-height:1.4; margin-bottom:12px;">Ekstra opbakning til dybdegående temaer i kommunen.</p>
              <span class="plan-state">Ekstra støtte</span>
            </div>
          </div>
        </div>

        <!-- Valgfrit beløb -->
        <div id="support-pane-valgfri" role="tabpanel" aria-labelledby="tab-support-valgfri" style="display:none;">
          <div style="margin-bottom:16px;">
            <div style="display:flex; gap:8px; margin-bottom:14px;" role="group" aria-label="Hyppighed">
              <button type="button" data-freq="monthly" id="btn-freq-monthly" class="custom-amt-btn is-active" aria-pressed="true" style="flex:1;">Månedligt</button>
              <button type="button" data-freq="once" id="btn-freq-once" class="custom-amt-btn" aria-pressed="false" style="flex:1;">Engangsbeløb</button>
            </div>
            <div class="custom-amt-grid" role="group" aria-label="Vælg beløb">
              <button type="button" data-amt="25" class="custom-amt-btn" aria-pressed="false">25 kr.</button>
              <button type="button" data-amt="50" class="custom-amt-btn is-active" aria-pressed="true">50 kr.</button>
              <button type="button" data-amt="100" class="custom-amt-btn" aria-pressed="false">100 kr.</button>
              <button type="button" data-amt="250" class="custom-amt-btn" aria-pressed="false">250 kr.</button>
              <button type="button" data-amt="500" class="custom-amt-btn" aria-pressed="false">500 kr.</button>
            </div>
            <label for="input-custom-amount" style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Eller indtast valgfrit beløb (kr., mindst 10):</label>
            <input type="number" id="input-custom-amount" value="50" oninput="customInputChanged(this.value)" class="form-control" style="font-size:16px; font-weight:700;" min="10" inputmode="numeric" aria-describedby="custom-amount-error">
            <div id="custom-amount-error" class="field-error" role="alert" hidden>Indtast et beløb på mindst 10 kr.</div>
          </div>
        </div>

        <!-- Submit knap -->
        <button type="button" onclick="submitSupport()" id="btn-submit-support" class="site-header-btn-stoet" style="width:100%; justify-content:center; padding:13px; font-size:15px; border-radius:var(--radius-sm); margin-top:10px;">
          Støt @@NAVN@@ med Støtte (49 kr. / md)
        </button>
        <div id="support-status" class="form-status" role="status" aria-live="polite" hidden tabindex="-1" style="margin-top:12px;"></div>
        <div style="font-size:11.5px; color:var(--ink-3); text-align:center; margin-top:8px;">
          Prototype: der gennemføres ingen rigtig betaling. I en rigtig udgave betaler du med MobilePay eller betalingskort uden binding.
        </div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 8B: PRISER & ANNONCERING (INTRO 25 %)  -->
    <!-- ============================================== -->
@@PRISER@@

    <!-- ============================================== -->
    <!-- SEKTION 9: TIP OS & DELTAGELSE (5 SPOR)        -->
    <!-- ============================================== -->
@@INDSEND@@

    <!-- ============================================== -->
    <!-- SEKTION 10: SØG                                -->
    <!-- ============================================== -->
    <section id="soeg" class="content-section" aria-labelledby="search-title">
      <div class="search-container">
        <span class="section-kicker">ARKIV</span>
        <h2 id="search-title" style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:12px;">Søg i artikler</h2>
        <div style="position:relative; margin-bottom:16px;">
          <label for="search-input" class="sr-only">Søg i artikler, sektioner og lokalområder</label>
          <input type="search" id="search-input" oninput="runLiveSearch(this.value)" placeholder="@@SEARCH_PH@@" class="search-input-field" autocomplete="off">
        </div>
        <div id="search-chips" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px;">@@CHIPS@@</div>
        <div id="search-results-list" aria-live="polite" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- SEKTION 11: BRUGERPROFIL FOR LÆSERE            -->
    <!-- ============================================== -->
@@PROFIL@@

    <!-- ============================================== -->
    <!-- SEKTION 12: OM, KONTAKT OG PRIVATLIV           -->
    <!-- ============================================== -->
    <section id="om" class="content-section" aria-labelledby="om-title">
      <div class="section-header-box">
        <span class="section-kicker">MEDIET</span>
        <h2 id="om-title" class="section-title">Om, kontakt &amp; privatliv</h2>
        <p class="section-desc">Kort om mediet, hvordan du når redaktionen, og hvad vi gør med dine data.</p>
      </div>
      <div class="om-grid">
        <div id="om-os" class="om-card">
          <h3>Om os</h3>
          <p>Dette er en prototype på et netværk af lokale nyhedsmedier. Alle nyheder, navne, tal og partnere på siden er eksempelindhold og beskriver ikke virkelige begivenheder.</p>
          <p>Den ansvarshavende redaktør angives, før en rigtig udgave offentliggøres.</p>
          <p><a href="#priser">Se priser og annoncering</a></p>
        </div>
        <div id="kontakt" class="om-card">
          <h3>Kontakt</h3>
          <p>Redaktionen: <a href="mailto:redaktion@lokalmedie.dk">redaktion@lokalmedie.dk</a></p>
          <p>Har du et tip eller en historie? <a href="#indsend" data-tipmode="tip">Giv et tip</a> eller <a href="#indsend" data-tipmode="debat">skriv et debatindlæg</a>.</p>
        </div>
        <div id="privatliv" class="om-card">
          <h3>Privatliv</h3>
          <p>Prototypen bruger hverken cookies, sporing eller tredjepartsscripts. Din valgte by gemmes kun lokalt i din browser.</p>
          <p>Formularer sender ikke data nogen steder hen i prototypen, og betaling er ikke koblet på.</p>
        </div>
      </div>
    </section>

    <!-- ========================================================= -->
    <!-- DEDIKEREDE ARTIKLER (vises når de er mål for et link)     -->
    <!-- ========================================================= -->
    <div id="dyn-articles">@@FR_articles@@</div>

  </main>

  <!-- MOBILE BOTTOM APP BAR -->
  <nav class="mobile-bottom-bar" aria-label="Mobil navigation">
    <a href="#forside" class="mobile-bottom-item is-active" id="mbar-home" aria-current="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
      <span>Hjem</span>
    </a>
    <a href="#nabolag" class="mobile-bottom-item" id="mbar-area">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span>Mit område</span>
    </a>
    <a href="#indsend" class="mobile-bottom-item" id="mbar-tip">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      <span>Tip os</span>
    </a>
    <button type="button" onclick="toggleMobileMenu()" class="mobile-bottom-item" id="mbar-more" aria-label="Mere – åbn menu" aria-expanded="false" aria-controls="mobile-drawer" data-drawer-toggle>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
      <span>Mere</span>
    </button>
  </nav>

  <!-- 5. FOOTER -->
  <footer class="site-footer">
    <div class="site-container">
      <div class="site-footer-grid">
        <div>
          <div class="site-footer-brand">
            <span id="footer-logo-prefix">@@PREFIX@@</span><span style="color:#34D399; font-style:italic;">Lokalt</span>
          </div>
          <p id="footer-tagline" style="font-size:13.5px; line-height:1.5; color:#94A3B8; margin-bottom:14px;">@@FOOTER_TAGLINE@@</p>
          <div style="font-size:12.5px; color:#CBD5E1;">
            <span aria-hidden="true">📍</span> Lokalkontor i <span id="footer-city-label">@@BY@@</span> · <span aria-hidden="true">✉️</span> <a href="mailto:redaktion@lokalmedie.dk" style="text-decoration:underline;">redaktion@lokalmedie.dk</a>
          </div>
        </div>
        <nav aria-label="Sektioner i bunden">
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
        </nav>
        <nav aria-label="Netværkssites">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#fff; margin-bottom:10px;">Netværkssites</div>
          <ul class="site-footer-links">
@@FOOTERCITIES@@
          </ul>
        </nav>
        <nav aria-label="Deltag">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#fff; margin-bottom:10px;">Deltag</div>
          <ul class="site-footer-links">
            <li><a href="#stoet">Støt med fast pris</a></li>
            <li><a href="#stoet" data-support="valgfri">Støt med valgfrit beløb</a></li>
            <li><a href="#indsend" data-tipmode="tip">Indsend historie / tip</a></li>
            <li><a href="#priser">Priser &amp; annoncering</a></li>
            <li><a href="#profil">Min profil</a></li>
            <li><a href="#soeg">Søg i arkivet</a></li>
          </ul>
        </nav>
        <nav aria-label="Om mediet">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#fff; margin-bottom:10px;">Om mediet</div>
          <ul class="site-footer-links">
            <li><a href="#om-os">Om os</a></li>
            <li><a href="#kontakt">Kontakt</a></li>
            <li><a href="#privatliv">Privatliv</a></li>
          </ul>
        </nav>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:16px; font-size:12px; color:#64748B; text-align:center;">
        &copy; 2026 <span id="footer-copy-name">@@NAVN@@</span> · En del af Lokalt-netværket.
        <div class="footer-note">Prototype: alt indhold på siden er eksempelindhold.</div>
      </div>
    </div>
  </footer>

  <!-- 6. INTERAKTIVE SCRIPTS & DYNAMISK BYSKIFTE -->
  <script>
@@JS@@
  </script>
</body>
</html>
'''

# ---------------------------------------------------------------------------
# INDSEND-SEKTION (genereres, så labels/ids/placeholders er konsistente)
# ---------------------------------------------------------------------------
LBL = 'display:block; font-size:13px; font-weight:600; margin-bottom:4px;'
INFO = ('background:var(--surface-2); padding:12px 14px; border-radius:var(--radius-sm); font-size:13px; '
        'color:var(--ink-2); border-left:3px solid var(--site-accent);')
BTN = ('width:100%; justify-content:center; padding:12px; font-size:14px; border-radius:var(--radius-sm);')


def build_indsend(c):
    def ph(key=None, text=None):
        if key:
            return f' data-ph="{key}" placeholder="{e(c["ph"][key])}"'
        return f' placeholder="{e(text)}"' if text else ''

    def inp(fid, label, *, phk=None, text=None, typ='text', req=True, aria=None):
        lab = (f'<label for="{fid}" style="{LBL}">{label}{" *" if req else ""}</label>' if label else '')
        al = f' aria-label="{e(aria)}"' if aria else ''
        r = ' required' if req else ''
        return f'<div>{lab}<input type="{typ}" class="form-control" id="{fid}"{al}{ph(phk, text)}{r}></div>'

    def area(fid, label, text, rows=3):
        return (f'<div><label for="{fid}" style="{LBL}">{label} *</label>'
                f'<textarea class="form-control" id="{fid}" rows="{rows}" placeholder="{e(text)}" required></textarea></div>')

    def row2(a, b):
        return f'<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">{a}{b}</div>'

    def status(mode):
        return f'<div id="status-{mode}" class="form-status" role="status" aria-live="polite" hidden tabindex="-1"></div>'

    def info(icon, html_):
        return f'<div style="{INFO}"><span aria-hidden="true">{icon}</span> {html_}</div>'

    def chip(mode):
        return (f'<div id="{mode}-product-chip" class="product-chip" hidden><span id="{mode}-product-text"></span>'
                f'<button type="button" data-clear-product>Fjern valg</button></div>')

    def form(mode, inner, submit):
        disp = 'flex' if mode == 'tip' else 'none'
        hid = '' if mode == 'tip' else ' hidden'
        return (f'<form id="form-tip-{mode}" role="tabpanel" aria-labelledby="tab-tip-{mode}" '
                f'onsubmit="submitTipMode(\'{mode}\', event)" style="display:{disp}; flex-direction:column; gap:14px;">'
                f'{status(mode)}{inner}'
                f'<button type="submit" class="site-header-btn-stoet" style="{BTN}">{submit}</button></form>')

    tabs = [('tip', '🚨 Giv et tip'), ('event', '📅 Arrangement'), ('sponsor', '💼 Sponsoreret artikel'),
            ('citat', '💬 Giv et citat'), ('debat', '✍️ Debatindlæg')]
    def tab_btn(m, lbl):
        sel = 'true' if m == 'tip' else 'false'
        ti = '' if m == 'tip' else 'tabindex="-1" '
        act = ' is-active' if m == 'tip' else ''
        return (f'<button type="button" role="tab" onclick="switchTipMode(\'{m}\')" id="tab-tip-{m}" '
                f'aria-selected="{sel}" aria-controls="form-tip-{m}" {ti}class="tip-tab-btn{act}">{lbl}</button>')
    tabs_html = ''.join(tab_btn(m, lbl) for m, lbl in tabs)

    f_tip = form('tip', ''.join([
        info('🚨', '<strong>Har du set eller hørt noget?</strong> Uheld, vejrudsigter, akutte hændelser eller tip om sager, redaktionen bør undersøge. Fuld kildebeskyttelse jf. medieansvarsloven.'),
        inp('tip-headline', 'Hvad handler tippet om?', text='F.eks. Trafikprop ved broen, vandstigning eller byggerod...'),
        row2(inp('tip-place', 'Hvor skete det?', phk='place'),
             inp('tip-time', 'Hvornår?', text='F.eks. Netop nu el. i morges kl. 8')),
        area('tip-desc', 'Beskrivelse af hændelsen', 'Beskriv hvad du har set, hørt eller oplevet...'),
        '<label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink-2); cursor:pointer;">'
        '<input type="checkbox" id="tip-anon" checked style="accent-color:var(--site-accent); width:16px; height:16px;">'
        '<span>Jeg ønsker kildebeskyttelse / anonymitet over for offentligheden</span></label>',
        row2(inp('tip-user-name', None, text='Dit navn', aria='Dit navn'),
             inp('tip-user-contact', None, text='Tlf. eller e-mail (kun til redaktionen)', aria='Telefon eller e-mail (kun til redaktionen)')),
    ]), 'Send tip til redaktionen')

    f_event = form('event', ''.join([
        info('📅', '<strong>Få jeres arrangement i den lokale kalender:</strong> Koncerter, foreningsmøder, teater, loppemarkeder og bylaugsmøder i hele kommunen.'),
        chip('event'),
        inp('event-title', 'Arrangementets titel', text='F.eks. Forårskoncert på Torvet eller Loppemarked på havnen'),
        row2(inp('event-datetime', 'Dato og starttidspunkt', text='F.eks. Lørdag 25. april kl. 14:00'),
             inp('event-location', 'Sted / Adresse', phk='venue')),
        row2(inp('event-organizer', 'Arrangør / Forening', phk='org'),
             inp('event-price', 'Entré / Billetpris', text='F.eks. Gratis adgang eller 50 kr.', req=False)),
        area('event-desc', 'Kort beskrivelse af programmet', 'Hvad kan gæsterne opleve?'),
        row2(inp('event-contact-name', None, text='Kontaktperson', aria='Kontaktperson'),
             inp('event-link', None, text='Evt. billetlink el. hjemmeside', req=False, aria='Billetlink eller hjemmeside')),
    ]), 'Indsend arrangement til kalenderen')

    f_sponsor = form('sponsor', ''.join([
        info('💼', '<strong>Fortæl din virksomheds historie med troværdighed:</strong> En sponsoreret artikel giver jer en professionelt skrevet profilartikel på forsiden og i relevante sektioner, tydeligt mærket med <code>◆ FINANSIERET AF...</code>.'),
        chip('sponsor'),
        '<input type="hidden" id="sponsor-product" value="">',
        row2(inp('sponsor-company', 'Virksomhedens navn', phk='company'),
             inp('sponsor-contact-name', 'Kontaktperson', text='F.eks. Hanne Eksempel')),
        row2(inp('sponsor-email', 'E-mailadresse', text='kontakt@virksomhed.dk', typ='email'),
             inp('sponsor-phone', 'Telefonnummer', text='+45 20 12 34 56', typ='tel')),
        area('sponsor-message', 'Anledning & Nøglebudskaber', 'F.eks. Jubilæum, ny afdeling, rekruttering af lærlinge eller grønne tiltag...'),
    ]), 'Send forespørgsel om sponsoreret artikel')

    f_citat = form('citat', ''.join([
        info('💬', '<strong>Giv et citat med til en aktuel sag:</strong> Hvad mener du som lokal borger? Send os dit citat, så redaktionen kan tage din stemme med, når vi skriver om emnet.'),
        f'<div><label for="citat-topic" style="{LBL}">Hvilket emne eller sag udtaler du dig om? *</label>'
        f'<select class="form-control" id="citat-topic" required>{render_topics(c)}</select></div>',
        area('citat-text', 'Dit citat — hvad vil du gerne sige?', 'Skriv med dine egne ord, hvad du mener om sagen...'),
        row2(inp('citat-author', 'Dit fulde navn', text='Dit fulde navn'),
             inp('citat-city-part', 'Bydel / By i kommunen', phk='areas')),
        '<label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink-2); cursor:pointer;">'
        '<input type="checkbox" id="citat-consent" checked required style="accent-color:var(--site-accent); width:16px; height:16px;">'
        '<span>Jeg giver samtykke til, at redaktionen må bringe mit citat med navn og bydel i redaktionelle artikler</span></label>',
    ]), 'Indsend citat til redaktionen')

    f_debat = form('debat', ''.join([
        info('✍️', '<strong>Skriv et debatindlæg:</strong> Debatindlæg er borgernes og foreningernes plads til at give deres holdning til kende. Indlæg bringes under eget navn og kan blive forkortet af redaktionen.'),
        inp('debat-title', 'Overskrift på dit indlæg', text='F.eks. Vi skal passe på de grønne områder'),
        area('debat-text', 'Dit indlæg', 'Skriv dit indlæg her (gerne under 3.000 anslag)...', rows=6),
        row2(inp('debat-author', 'Dit fulde navn', text='Dit fulde navn'),
             inp('debat-area', 'Bydel / By i kommunen', phk='areas')),
        inp('debat-contact', 'Tlf. eller e-mail (kun til redaktionen)', text='Tlf. eller e-mail'),
        '<label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink-2); cursor:pointer;">'
        '<input type="checkbox" id="debat-consent" required style="accent-color:var(--site-accent); width:16px; height:16px;">'
        '<span>Jeg giver samtykke til, at mit indlæg må bringes med navn og bydel</span></label>',
    ]), 'Indsend debatindlæg til redaktionen')

    return (
        '<section id="indsend" class="content-section" aria-labelledby="indsend-title">\n'
        '      <div class="support-card-container">\n'
        '        <span class="section-kicker">BORGER &amp; ERHVERV</span>\n'
        '        <h2 id="indsend-title" style="font-family:var(--font-display); font-size:28px; font-weight:800; margin-bottom:8px;">Tip redaktionen &amp; Vær med</h2>\n'
        '        <p style="font-size:14px; color:var(--ink-2); line-height:1.5; margin-bottom:20px;">\n'
        '          Lokaljournalistik skabes i tæt samspil med dig. Vælg herunder hvad din henvendelse drejer sig om:\n'
        '        </p>\n'
        f'        <div class="tip-mode-tabs" role="tablist" aria-label="Type af henvendelse">{tabs_html}</div>\n'
        f'        {f_tip}\n        {f_event}\n        {f_sponsor}\n        {f_citat}\n        {f_debat}\n'
        '      </div>\n    </section>'
    )

CSS_EXTRA += '''
    .drawer-city-btn { background: #FFFFFF; color: var(--ink); border: 1px solid var(--line); }
    .drawer-city-btn.is-active { background: var(--site-accent-soft); color: var(--ink); border-color: var(--site-accent); font-weight: 700; }
    .mobile-drawer-link.is-active { background: var(--site-accent-soft); color: var(--site-accent); }
'''

# ---------------------------------------------------------------------------
# JAVASCRIPT (rå streng; @@...@@ udskiftes)
# ---------------------------------------------------------------------------
JS_CODE = r'''
    const CITIES_DATA = @@CITIES_JSON@@;
    const CITY_HTML = @@CITY_HTML_JSON@@;
    const DEFAULT_CITY = 'slagelse';
    const SITE_URL = @@SITE_URL_JSON@@;
    let currentCityKey = DEFAULT_CITY;

    const $ = (id) => document.getElementById(id);
    function esc(s) {
      return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }
    function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
    function visible(el) { return !!el && el.getClientRects().length > 0; }

    const SEC_LABEL = {
      forside: 'Forsiden', nyheder: 'Nyheder', erhverv: 'Erhverv', sport: 'Sport', kultur: 'Kultur',
      foreningsliv: 'Foreningsliv', debat: 'Debat', stoet: 'Støt', priser: 'Priser', indsend: 'Tip os',
      soeg: 'Søgning', profil: 'Profil', om: 'Om os'
    };
    const SECTION_INDEX = [
      { href: '#nyheder', title: 'Sektion: Nyheder', cat: 'Sektion', hay: 'nyheder aktuelt politik beredskab infrastruktur lokalsamfund' },
      { href: '#erhverv', title: 'Sektion: Erhverv & Handel', cat: 'Sektion', hay: 'erhverv handel virksomheder iværksættere arbejdspladser' },
      { href: '#sport', title: 'Sektion: Lokalsporten', cat: 'Sektion', hay: 'sport lokalsport fodbold håndbold atletik svømning' },
      { href: '#kultur', title: 'Sektion: Kultur & Oplevelser', cat: 'Sektion', hay: 'kultur oplevelser koncert teater udstilling bibliotek' },
      { href: '#foreningsliv', title: 'Sektion: Foreningsliv & Frivillighed', cat: 'Sektion', hay: 'foreningsliv frivillighed forening klub frivillige' },
      { href: '#debat', title: 'Sektion: Debat & Holdninger', cat: 'Sektion', hay: 'debat holdninger debatindlæg borgere' },
      { href: '#priser', title: 'Priser & annoncering', cat: 'Annoncering', hay: 'priser annoncering sponsor annonce partner' },
      { href: '#stoet', title: 'Støt lokaljournalistikken', cat: 'Støtte', hay: 'støt støtte medlemskab abonnement' }
    ];

    /* ---------- Dropdown og skuffe (aria-expanded, Escape, fokus) ---------- */
    function toggleCityDropdown(force) {
      const menu = $('city-dropdown');
      const btn = $('header-city-btn');
      if (!menu || !btn) return;
      const open = (typeof force === 'boolean') ? force : !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        const first = menu.querySelector('.is-active') || menu.querySelector('a');
        if (first) first.focus();
      }
    }

    let drawerReturnFocus = null;
    function toggleMobileMenu(force) {
      const d = $('mobile-drawer');
      if (!d) return;
      const open = (typeof force === 'boolean') ? force : !d.classList.contains('is-open');
      if (open === d.classList.contains('is-open')) return;
      d.classList.toggle('is-open', open);
      document.querySelectorAll('[data-drawer-toggle]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        drawerReturnFocus = document.activeElement;
        const close = $('drawer-close');
        if (close) close.focus();
      } else if (drawerReturnFocus && drawerReturnFocus.focus) {
        drawerReturnFocus.focus();
        drawerReturnFocus = null;
      }
    }

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        const d = $('mobile-drawer');
        if (d && d.classList.contains('is-open')) { toggleMobileMenu(false); return; }
        const menu = $('city-dropdown');
        if (menu && menu.classList.contains('is-open')) {
          toggleCityDropdown(false);
          const btn = $('header-city-btn');
          if (btn) btn.focus();
        }
      } else if (ev.key === 'Tab') {
        const d = $('mobile-drawer');
        if (d && d.classList.contains('is-open')) {
          const f = Array.prototype.filter.call(d.querySelectorAll('a[href], button'), visible);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        }
      } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        const tab = ev.target.closest && ev.target.closest('[role="tab"]');
        if (!tab) return;
        const tabs = Array.prototype.slice.call(tab.parentElement.querySelectorAll('[role="tab"]'));
        const i = tabs.indexOf(tab);
        const n = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        ev.preventDefault();
        n.click();
        n.focus();
      } else if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList && ev.target.classList.contains('support-plan-card')) {
        ev.preventDefault();
        ev.target.click();
      }
    });

    document.addEventListener('focusin', (ev) => {
      const menu = $('city-dropdown');
      const btn = $('header-city-btn');
      if (menu && btn && menu.classList.contains('is-open') && !menu.contains(ev.target) && !btn.contains(ev.target)) {
        toggleCityDropdown(false);
      }
    });

    /* ---------- Meta, SEO, URL ---------- */
    function canonicalUrl(key) {
      let base = '';
      if (SITE_URL) base = SITE_URL + '/';
      else if (location.protocol === 'http:' || location.protocol === 'https:') base = location.origin + location.pathname;
      if (!base) return '';
      return base + (key !== DEFAULT_CITY ? '?by=' + key : '');
    }
    function headNode(sel, tag, attrs) {
      let el = document.head.querySelector(sel);
      if (!el) {
        el = document.createElement(tag);
        Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
        document.head.appendChild(el);
      }
      return el;
    }
    function faviconUri(accent) {
      const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='" + accent +
        "'/><text x='32' y='46' font-size='40' text-anchor='middle' font-family='Georgia,serif' font-weight='700' fill='#fff'>L</text></svg>";
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    function applySeo(d, key) {
      document.title = d.title;
      const setC = (id, v) => { const el = $(id); if (el) el.setAttribute('content', v); };
      setC('meta-description', d.desc);
      setC('meta-theme-color', d.accent);
      setC('og-site-name', d.navn);
      setC('og-title', d.title);
      setC('og-description', d.desc);
      setC('tw-title', d.title);
      setC('tw-description', d.desc);
      const fav = $('favicon');
      if (fav) fav.setAttribute('href', faviconUri(d.accent));
      const cu = canonicalUrl(key);
      if (cu) {
        headNode('link[rel="canonical"]', 'link', { rel: 'canonical', id: 'canonical' }).setAttribute('href', cu);
        headNode('meta[property="og:url"]', 'meta', { property: 'og:url', id: 'og-url' }).setAttribute('content', cu);
      }
      const orgId = SITE_URL ? SITE_URL + '/#organization' : '#organization';
      const org = { '@type': 'NewsMediaOrganization', '@id': orgId, name: d.navn, description: d.tagline,
        areaServed: { '@type': 'AdministrativeArea', name: d.kommune } };
      const site = { '@type': 'WebSite', name: d.navn, description: d.desc, inLanguage: 'da', publisher: { '@id': orgId } };
      if (SITE_URL) { org.url = SITE_URL + '/'; site.url = SITE_URL + '/'; }
      const ld = $('jsonld');
      if (ld) ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, site] });
      setText('page-h1', d.navn + ' – lokale nyheder fra ' + d.kommune);
    }
    function writeUrl(key) {
      try {
        const url = new URL(location.href);
        if (key === DEFAULT_CITY) url.searchParams.delete('by'); else url.searchParams.set('by', key);
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      } catch (err) { /* file:// eller sandbox: URL kan ikke opdateres */ }
    }
    function cityFromHash(h) {
      const m = /^#(?:by[=-])?([a-z]+)$/.exec(h || '');
      return (m && CITIES_DATA[m[1]]) ? m[1] : null;
    }

    /* ---------- Byskift: alt data-drevet, så Slagelse = statisk markup ---------- */
    function renderAreaBox(d, idx) {
      const o = d.omraader[idx];
      let h = '<strong>' + esc(o.navn) + ':</strong> ' + esc(o.tekst);
      if (o.stories.length) {
        h += '<ul class="nabolag-links">' + o.stories.map((x) => '<li><a href="#' + esc(x.id) + '">' + esc(x.title) + '</a></li>').join('') + '</ul>';
      } else {
        h += '<p class="nabolag-links">Ingen historier fra ' + esc(o.navn) + ' endnu. <a href="#indsend" data-tipmode="tip">Tip os om ' + esc(o.navn) + '</a></p>';
      }
      return h;
    }
    function setNabolagArea(idx) {
      const d = CITIES_DATA[currentCityKey];
      document.querySelectorAll('.site-nabolag-pill').forEach((b) => {
        const on = Number(b.dataset.area) === Number(idx);
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const box = $('nabolag-box');
      if (box && d.omraader[idx]) box.innerHTML = renderAreaBox(d, idx);
    }
    function renderWire(d) {
      return d.wire.map((w) => '<a href="' + esc(w.href) + '" class="site-wire-item"><span class="site-wire-time">' + esc(w.time) +
        '</span><p class="site-wire-headline">' + esc(w.title) + '</p></a>').join('');
    }
    function applyHero(d) {
      const card = $('hero-card');
      if (card) card.setAttribute('href', d.hero_href);
      const bg = $('hero-bg');
      if (bg) {
        bg.className = 'site-hero-bg-layer card-img-cover ' + d.hero_img;
        bg.setAttribute('aria-label', d.hero_img_label);
      }
      setText('hero-meta-byline', d.hero_author + ' · ' + d.hero_meta);
      setText('hero-kicker', d.hero_kicker);
      setText('hero-title', d.hero_title);
      setText('hero-manchet', d.hero_manchet);
      const t = $('net-ticker-text');
      if (t) t.setAttribute('href', d.ticker.href);
      setText('ticker-label', d.ticker.text);
    }
    function setNyhederExpanded(on) {
      const grid = $('dyn-nyheder');
      const btn = $('btn-expand-nyheder');
      const d = CITIES_DATA[currentCityKey];
      if (!grid || !btn) return;
      grid.classList.toggle('is-collapsed', !on);
      btn.setAttribute('aria-expanded', String(on));
      btn.innerHTML = on ? 'Vis færre historier' : 'Vis alle <span id="expand-count">' + d.stories.length + '</span> historier';
      btn.parentElement.hidden = d.stories.length <= 3;
    }

    let profileEdited = false;
    function switchCity(cityKey, opts) {
      opts = opts || {};
      const data = CITIES_DATA[cityKey];
      if (!data) return;
      currentCityKey = cityKey;

      document.documentElement.style.setProperty('--site-accent', data.accent);
      document.documentElement.style.setProperty('--site-accent-soft', data.accent_soft);

      ['site-logo-prefix', 'drawer-logo-prefix', 'footer-logo-prefix'].forEach((id) => setText(id, data.prefix));
      setText('site-brand-tagline', data.tagline);
      setText('footer-tagline', data.footer_tagline);
      const brand = $('brand-link');
      if (brand) brand.setAttribute('aria-label', data.navn + ' – til forsiden');
      setText('header-city-name', data.by);
      toggleCityDropdown(false);

      document.querySelectorAll('.site-network-btn[data-city], .city-dropdown-item[data-city]').forEach((el) => {
        const on = el.dataset.city === cityKey;
        el.classList.toggle('is-active', on);
        if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
      });

      setText('header-stoet-label', 'Støt ' + data.by);
      setText('drawer-stoet-label', 'Støt ' + data.navn);

      applyHero(data);
      setText('wire-kommune-name', ' i ' + data.kommune);
      const wire = $('wire-list-container');
      if (wire) wire.innerHTML = renderWire(data);

      // Dit nabolag
      setText('nabolag-kommune-tag', data.kommune);
      const pills = $('nabolag-pills-container');
      if (pills) {
        pills.innerHTML = data.omraader.map((o, i) =>
          '<button type="button" class="site-nabolag-pill' + (i === 0 ? ' is-active' : '') + '" data-area="' + i +
          '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">' + esc(o.navn) + '</button>').join('');
      }
      const box = $('nabolag-box');
      if (box) box.innerHTML = renderAreaBox(data, 0);

      // Kort, sektioner og artikler (forudrenderet og escapet ved bygning)
      const frags = CITY_HTML[cityKey];
      Object.keys(frags).forEach((k) => { const el = $('dyn-' + k); if (el) el.innerHTML = frags[k]; });
      setNyhederExpanded(false);

      // Tekster
      setText('community-banner-title', 'Vær med til at præge ' + data.navn);
      setText('support-section-title', 'Støt ' + data.navn);
      setText('support-section-desc', 'Vi formes og finansieres af borgerne og erhvervslivet i ' + data.kommune + '. Vælg en fast pakke eller støt med et valgfrit beløb.');
      setText('section-nyheder-title', 'Nyheder fra ' + data.kommune);
      setText('price-city-name', data.navn);
      setText('footer-copy-name', data.navn);
      setText('footer-city-label', data.by);

      // Formularer: by-specifikke eksempler
      document.querySelectorAll('[data-ph]').forEach((el) => { if (data.ph[el.dataset.ph]) el.setAttribute('placeholder', data.ph[el.dataset.ph]); });
      const topic = $('citat-topic');
      if (topic) {
        topic.innerHTML = data.topics.map((t) => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('') +
          '<option value="Andet lokalt emne">Andet lokalt emne (skriv nedenfor)</option>';
      }
      if (!profileEdited) {
        setText('profile-area-text', data.by);
        const pa = $('input-profile-area');
        if (pa) pa.value = data.omraader[0].navn;
      }

      afterCity(cityKey);
      applySeo(data, cityKey);
      updateSubmitText();

      if (!opts.noUrl) writeUrl(cityKey);
      if (!opts.noSave) { try { localStorage.setItem('valgt_by', cityKey); } catch (err) { /* ingen lagring */ } }

      // Hash peger evt. på en artikel fra den forrige by
      if (location.hash.indexOf('#art-') === 0 && !$(location.hash.slice(1))) {
        try { history.replaceState(null, '', location.pathname + location.search + '#forside'); } catch (err) { /* ignorer */ }
      }
      requestSpy();
    }

    function afterCity(cityKey) {
      const d = CITIES_DATA[cityKey];
      buildIndex(d);
      const chips = $('search-chips');
      if (chips) chips.innerHTML = d.chips.map((t) => '<button type="button" class="site-subnav-pill" data-term="' + esc(t) + '">' + esc(t) + '</button>').join('');
      const inp = $('search-input');
      if (inp) {
        inp.setAttribute('placeholder', 'Søg f.eks. ' + d.chips.map((t) => t.toLowerCase()).join(', ') + '...');
        runLiveSearch(inp.value);
      }
    }

    /* ---------- Støtte ---------- */
    let supportMode = 'fast';
    let planName = 'Støtte';
    let planPrice = 49;
    let customAmount = 50;
    let customFreq = 'monthly';

    function showStatus(id, message, isError) {
      const el = $(id);
      if (!el) return;
      el.textContent = message;
      el.classList.toggle('is-error', !!isError);
      el.hidden = false;
      el.focus();
    }
    function hideStatus(id) { const el = $(id); if (el) el.hidden = true; }

    function setSupportMode(m) {
      supportMode = m;
      const tabFast = $('tab-support-fast');
      const tabValgfri = $('tab-support-valgfri');
      const fast = m === 'fast';
      tabFast.classList.toggle('is-active', fast);
      tabValgfri.classList.toggle('is-active', !fast);
      tabFast.setAttribute('aria-selected', String(fast));
      tabValgfri.setAttribute('aria-selected', String(!fast));
      tabFast.tabIndex = fast ? 0 : -1;
      tabValgfri.tabIndex = fast ? -1 : 0;
      $('support-pane-fast').style.display = fast ? 'block' : 'none';
      $('support-pane-valgfri').style.display = fast ? 'none' : 'block';
      hideStatus('support-status');
      updateSubmitText();
    }

    function selectPlan(name, price, el) {
      planName = name;
      planPrice = price;
      document.querySelectorAll('.support-plan-card').forEach((c) => {
        const on = c === el;
        c.classList.toggle('is-selected', on);
        c.setAttribute('aria-checked', String(on));
        const st = c.querySelector('.plan-state');
        if (st) st.textContent = on ? '✓ Valgt' : c.dataset.default;
      });
      updateSubmitText();
    }

    function setCustomFreq(f) {
      customFreq = f;
      [['monthly', $('btn-freq-monthly')], ['once', $('btn-freq-once')]].forEach((p) => {
        p[1].classList.toggle('is-active', p[0] === f);
        p[1].setAttribute('aria-pressed', String(p[0] === f));
      });
      updateSubmitText();
    }

    function markAmtButtons(amount) {
      document.querySelectorAll('[data-amt]').forEach((b) => {
        const on = amount !== null && Number(b.dataset.amt) === amount;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
    function setCustomAmt(amt, el) {
      customAmount = amt;
      const inp = $('input-custom-amount');
      inp.value = amt;
      inp.setAttribute('aria-invalid', 'false');
      $('custom-amount-error').hidden = true;
      markAmtButtons(amt);
      updateSubmitText();
    }
    function customInputChanged(val) {
      const p = parseInt(val, 10);
      const inp = $('input-custom-amount');
      const err = $('custom-amount-error');
      if (!isNaN(p) && p >= 10) {
        customAmount = p;
        inp.setAttribute('aria-invalid', 'false');
        err.hidden = true;
      } else {
        customAmount = null;
        inp.setAttribute('aria-invalid', 'true');
        err.hidden = false;
      }
      markAmtButtons(customAmount);
      updateSubmitText();
    }

    function updateSubmitText() {
      const btn = $('btn-submit-support');
      if (!btn) return;
      const cityName = CITIES_DATA[currentCityKey].navn;
      if (supportMode === 'fast') {
        btn.disabled = false;
        btn.textContent = `Støt ${cityName} med ${planName} (${planPrice} kr. / md)`;
      } else if (customAmount === null) {
        btn.disabled = true;
        btn.textContent = 'Indtast et beløb på mindst 10 kr.';
      } else {
        btn.disabled = false;
        const ft = customFreq === 'monthly' ? 'pr. md.' : 'engang';
        btn.textContent = `Støt ${cityName} med ${customAmount} kr. (${ft})`;
      }
    }

    function submitSupport() {
      const c = CITIES_DATA[currentCityKey];
      if (supportMode === 'fast') {
        showStatus('support-status', `Tak! Du har valgt ${planName} (${planPrice} kr./md) til ${c.navn}. Prototype: der er ikke gennemført nogen betaling.`);
      } else {
        if (customAmount === null) { showStatus('support-status', 'Indtast et beløb på mindst 10 kr.', true); return; }
        const ft = customFreq === 'monthly' ? 'hver måned' : 'som engangsbidrag';
        showStatus('support-status', `Tak! Du har valgt at støtte ${c.kommune} med ${customAmount} kr. ${ft}. Prototype: der er ikke gennemført nogen betaling.`);
      }
    }

    /* ---------- Tip os / indsend ---------- */
    const TIP_MODES = ['tip', 'event', 'sponsor', 'citat', 'debat'];
    let selectedProduct = null;

    function switchTipMode(mode) {
      TIP_MODES.forEach((m) => {
        const btn = $('tab-tip-' + m);
        const form = $('form-tip-' + m);
        if (btn) {
          btn.classList.toggle('is-active', m === mode);
          btn.setAttribute('aria-selected', String(m === mode));
          btn.tabIndex = m === mode ? 0 : -1;
        }
        if (form) form.style.display = (m === mode) ? 'flex' : 'none';
      });
    }

    function clearProduct() {
      selectedProduct = null;
      ['event', 'sponsor'].forEach((m) => { const c = $(m + '-product-chip'); if (c) c.hidden = true; });
      const h = $('sponsor-product');
      if (h) h.value = '';
    }

    function selectPriceProduct(mode, product, price) {
      clearProduct();
      if (product) {
        selectedProduct = { name: product, price: price || '', mode: mode };
        const chip = $(mode + '-product-chip');
        if (chip) {
          setText(mode + '-product-text', 'Valgt produkt: ' + product + (price ? ' · ' + price : ''));
          chip.hidden = false;
        }
        const h = $('sponsor-product');
        if (h && mode === 'sponsor') h.value = product + (price ? ' (' + price + ')' : '');
      }
      switchTipMode(mode);
      const el = $('indsend');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      const first = $('form-tip-' + mode) && $('form-tip-' + mode).querySelector('input:not([type=hidden]), textarea, select');
      if (first) first.focus({ preventScroll: true });
    }

    function val(id) { const el = $(id); return el ? el.value.trim() : ''; }

    function submitTipMode(mode, ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      const c = CITIES_DATA[currentCityKey] || CITIES_DATA[DEFAULT_CITY];
      let msg = '';
      if (mode === 'tip') {
        msg = `Tusind tak, ${val('tip-user-name') || 'læser'}! Dit tip "${val('tip-headline') || 'uden titel'}" er modtaget hos redaktionen for ${c.navn}. Kildebeskyttelse er sikret. (Prototype: intet er sendt.)`;
      } else if (mode === 'event') {
        const prod = selectedProduct && selectedProduct.mode === 'event' ? ` Valgt produkt: ${selectedProduct.name}${selectedProduct.price ? ' (' + selectedProduct.price + ')' : ''}.` : '';
        msg = `Mange tak, ${val('event-contact-name') || 'arrangør'}! Jeres arrangement "${val('event-title') || 'uden titel'}" er modtaget og klargøres til kalenderen på ${c.navn}.${prod} (Prototype: intet er sendt.)`;
      } else if (mode === 'sponsor') {
        const prod = selectedProduct && selectedProduct.mode === 'sponsor' ? ` Valgt produkt: ${selectedProduct.name}${selectedProduct.price ? ' (' + selectedProduct.price + ')' : ''}.` : '';
        msg = `Mange tak, ${val('sponsor-contact-name') || 'kontaktperson'}! Jeres forespørgsel for ${val('sponsor-company') || 'virksomheden'} er modtaget.${prod} Redaktionen for ${c.navn} kontakter jer hurtigst muligt. (Prototype: intet er sendt.)`;
      } else if (mode === 'citat') {
        msg = `Tak for dit citat, ${val('citat-author') || 'læser'}! Dit bidrag til emnet "${val('citat-topic')}" er overdraget til redaktionen for ${c.navn}. (Prototype: intet er sendt.)`;
      } else if (mode === 'debat') {
        msg = `Tak, ${val('debat-author') || 'debattør'}! Dit debatindlæg "${val('debat-title') || 'uden titel'}" er modtaget af redaktionen for ${c.navn} og vurderes til Debat-sektionen. (Prototype: intet er sendt.)`;
      } else {
        return;
      }
      const form = $('form-tip-' + mode);
      if (form) form.reset();
      if (mode === 'event' || mode === 'sponsor') clearProduct();
      showStatus('status-' + mode, msg);
    }

    document.addEventListener('input', (ev) => {
      const f = ev.target.closest && ev.target.closest('form[id^="form-tip-"]');
      if (f) hideStatus('status-' + f.id.replace('form-tip-', ''));
    });

    /* ---------- Søgning ---------- */
    let searchIndex = [];
    function buildIndex(d) {
      searchIndex = d.stories.map((s) => ({
        href: s.href, title: s.title, cat: s.cat,
        hay: (s.title + ' ' + s.cat + ' ' + s.tags + ' ' + s.secname).toLowerCase(), isStory: true
      }));
      SECTION_INDEX.forEach((s) => searchIndex.push(s));
      d.omraader.forEach((o) => searchIndex.push({ href: '#nabolag', title: 'Område: ' + o.navn, cat: 'Dit nabolag', hay: o.navn.toLowerCase() }));
    }
    function runLiveSearch(query) {
      const q = (query || '').toLowerCase().trim();
      const list = $('search-results-list');
      if (!list) return;
      const filtered = q ? searchIndex.filter((s) => s.hay.includes(q)) : searchIndex.filter((s) => s.isStory).slice(0, 6);
      if (filtered.length === 0) {
        list.innerHTML = '<div class="search-empty">Ingen resultater matchede. <a href="#indsend" data-tipmode="tip">Foreslå et emne eller tip redaktionen</a></div>';
        return;
      }
      list.innerHTML = filtered.map((s) =>
        '<a href="' + esc(s.href) + '" class="search-result"><div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--site-accent); margin-bottom:3px;">' +
        esc(s.cat) + '</div><div style="font-size:15px; font-weight:700; color:var(--ink);">' + esc(s.title) + '</div></a>').join('');
    }
    function setSearchTerm(t) {
      const inp = $('search-input');
      if (inp) { inp.value = t; runLiveSearch(t); }
    }

    /* ---------- Profil ---------- */
    function toggleProfileEdit() {
      const box = $('profile-edit-box');
      const btn = $('btn-edit-profile');
      if (!box) return;
      const open = box.style.display === 'none' || !box.style.display;
      box.style.display = open ? 'block' : 'none';
      if (btn) btn.setAttribute('aria-expanded', String(open));
      hideStatus('profile-status');
    }
    function saveProfile() {
      const name = val('input-profile-name');
      const area = val('input-profile-area');
      if (name) setText('profile-display-name', name);
      if (area) { setText('profile-area-text', area); profileEdited = true; }
      showStatus('profile-status', 'Dine profiloplysninger er opdateret (kun i denne visning – intet gemmes).');
    }

    /* ---------- Navigation: aktiv-state (scroll-spy) og tilbage-links ---------- */
    const SPY_IDS = ['forside', 'nyheder', 'erhverv', 'sport', 'kultur', 'foreningsliv', 'debat', 'stoet', 'priser', 'indsend', 'soeg', 'profil', 'om'];
    function setActiveNav(cur, areaActive) {
      document.querySelectorAll('.site-header-primary-link, .site-subnav-pill[href], .mobile-bottom-item[href], .mobile-drawer-link').forEach((a) => {
        const h = a.getAttribute('href') || '';
        if (h.charAt(0) !== '#') return;
        let on = h === '#' + cur;
        if (a.id === 'mbar-area') on = !!areaActive;
        if (a.id === 'mbar-home') on = cur === 'forside' && !areaActive;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    function spy() {
      spyQueued = false;
      const line = 140;
      let cur = 'forside';
      SPY_IDS.forEach((id) => {
        const el = $(id);
        if (visible(el) && el.getBoundingClientRect().top <= line) cur = id;
      });
      const art = document.querySelector('.article-full-page:target');
      if (art && visible(art) && art.getBoundingClientRect().top <= line) cur = art.dataset.sec || cur;
      let areaActive = false;
      const nb = $('nabolag');
      if (nb && cur === 'forside') {
        const r = nb.getBoundingClientRect();
        areaActive = r.top <= line && r.bottom > line;
      }
      setActiveNav(cur, areaActive);
    }
    let spyQueued = false;
    function requestSpy() {
      if (spyQueued) return;
      spyQueued = true;
      window.requestAnimationFrame(spy);
    }

    let returnTo = null;
    function placeOf(el) {
      const sec = el.closest('section[id]');
      const id = sec && SEC_LABEL[sec.id] ? sec.id : 'forside';
      return { id: id, label: SEC_LABEL[id] };
    }

    document.addEventListener('click', (ev) => {
      const t = ev.target;
      if (!t.closest) return;

      // Byskift (rigtige links med ?by=)
      const cityEl = t.closest('[data-city]');
      if (cityEl) {
        ev.preventDefault();
        switchCity(cityEl.dataset.city);
        toggleMobileMenu(false);
        return;
      }

      // Luk dropdown ved klik udenfor
      const menu = $('city-dropdown');
      const cbtn = $('header-city-btn');
      if (menu && cbtn && menu.classList.contains('is-open') && !cbtn.contains(t) && !menu.contains(t)) toggleCityDropdown(false);

      // Skuffen: klik på overlay eller et link lukker den
      const drawer = $('mobile-drawer');
      if (drawer && drawer.classList.contains('is-open')) {
        if (t === drawer || t.closest('.mobile-drawer-link')) toggleMobileMenu(false);
      }

      const exp = t.closest('[data-expand]');
      if (exp) setNyhederExpanded(true);
      const sup = t.closest('[data-support]');
      if (sup) setSupportMode(sup.dataset.support);
      const tm = t.closest('[data-tipmode]');
      if (tm) switchTipMode(tm.dataset.tipmode);

      const prod = t.closest('.js-product');
      if (prod) selectPriceProduct(prod.dataset.mode, prod.dataset.product, prod.dataset.price);
      if (t.closest('[data-clear-product]')) clearProduct();

      const pill = t.closest('.site-nabolag-pill');
      if (pill) setNabolagArea(pill.dataset.area);
      const chip = t.closest('[data-term]');
      if (chip) setSearchTerm(chip.dataset.term);
      const plan = t.closest('.support-plan-card');
      if (plan) selectPlan(plan.dataset.plan, Number(plan.dataset.price), plan);
      const amt = t.closest('[data-amt]');
      if (amt) setCustomAmt(Number(amt.dataset.amt), amt);
      const fq = t.closest('[data-freq]');
      if (fq) setCustomFreq(fq.dataset.freq);
      const tp = t.closest('[data-topic]');
      if (tp) {
        const on = tp.getAttribute('aria-pressed') !== 'true';
        tp.setAttribute('aria-pressed', String(on));
        tp.classList.toggle('is-active', on);
        tp.textContent = (on ? '✓ ' : '+ ') + tp.dataset.topic;
      }

      // Tilbage-links: gå tilbage til det sted, brugeren kom fra
      const back = t.closest('[data-back]');
      if (back && returnTo) {
        ev.preventDefault();
        const r = returnTo;
        returnTo = null;
        location.hash = '#' + r.id;
        window.requestAnimationFrame(() => window.scrollTo({ top: r.y, behavior: 'instant' }));
        return;
      }

      // Husk hvor man kom fra, når man åbner en artikel
      const link = t.closest('a[href^="#art-"]');
      if (link) {
        if (!link.closest('.article-full-page')) {
          const p = placeOf(link);
          returnTo = { id: p.id, y: window.scrollY, label: p.label };
        }
        const target = $(link.getAttribute('href').slice(1));
        if (target && returnTo) {
          target.querySelectorAll('[data-back-label]').forEach((s) => { s.textContent = returnTo.label; });
        }
      }
    });

    window.addEventListener('scroll', requestSpy, { passive: true });
    window.addEventListener('resize', requestSpy);
    window.addEventListener('hashchange', () => {
      const ck = cityFromHash(location.hash);
      if (ck) {
        try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* ignorer */ }
        switchCity(ck);
        return;
      }
      if (location.hash === '#soeg') { const i = $('search-input'); if (i) i.focus({ preventScroll: true }); }
      requestSpy();
    });

    window.addEventListener('DOMContentLoaded', () => {
      let key = null;
      try {
        const p = new URLSearchParams(location.search).get('by');
        if (p && CITIES_DATA[p]) key = p;
      } catch (err) { /* ignorer */ }
      if (!key) {
        const hk = cityFromHash(location.hash);
        if (hk) {
          key = hk;
          try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* ignorer */ }
        }
      }
      if (!key) {
        try {
          const saved = localStorage.getItem('valgt_by');
          if (saved && CITIES_DATA[saved]) key = saved;
        } catch (err) { /* ingen lagring */ }
      }
      if (key && key !== DEFAULT_CITY) switchCity(key, { noSave: true });
      else afterCity(DEFAULT_CITY);
      // Deep link til en artikel i en anden by: elementet findes først efter byskiftet
      if (location.hash.length > 1) {
        const target = $(decodeURIComponent(location.hash.slice(1)));
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      requestSpy();
    });
'''


# --- Genbrugte HTML-blokke fra den oprindelige version (transformeres i render_page) ---
PRISER_RAW = r'''    <section id="priser" class="content-section">
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
'''

PROFIL_RAW = r'''    <section id="profil" class="content-section">
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
'''


# ---------------------------------------------------------------------------
# SIDE-RENDERING
# ---------------------------------------------------------------------------
CITY_HTML = {k: fragments(c) for k, c in CITIES.items()}


def city_data_json():
    keep = ('navn', 'prefix', 'by', 'kommune', 'accent', 'accent_soft', 'tagline', 'omraader', 'hero_href',
            'hero_img', 'hero_img_label', 'hero_kicker', 'hero_title', 'hero_manchet', 'hero_author', 'hero_meta',
            'ticker', 'wire', 'stories', 'topics', 'ph', 'chips', 'title', 'desc', 'footer_tagline')
    return {k: {f: c[f] for f in keep} for k, c in CITIES.items()}


def city_links(key, kind):
    out = []
    for k, c in CITIES.items():
        on = (k == key)
        dot = f'<span class="site-network-dot" style="background:{c["accent"]};"></span>'
        if kind == 'net':
            out.append(
                f'        <a href="?by={k}" data-city="{k}" id="net-btn-{k}" class="site-network-btn{" is-active" if on else ""}"'
                f'{" aria-current=" + chr(34) + "true" + chr(34) if on else ""}>{dot} {e(c["by"])}</a>')
        elif kind == 'drop':
            out.append(
                f'            <a href="?by={k}" data-city="{k}" class="city-dropdown-item{" is-active" if on else ""}" id="drop-item-{k}"'
                f'{" aria-current=" + chr(34) + "true" + chr(34) if on else ""}>'
                f'<span style="display:flex; align-items:center; gap:8px;">{dot} {e(c["navn"])}</span>'
                f'<span style="font-size:11.5px; color:var(--ink-3);">{e(c["by"])}</span></a>')
        elif kind == 'drawer':
            out.append(
                f'          <a href="?by={k}" data-city="{k}" class="site-network-btn drawer-city-btn{" is-active" if on else ""}"'
                f'{" aria-current=" + chr(34) + "true" + chr(34) if on else ""}>{dot} {e(c["by"])}</a>')
        elif kind == 'footer':
            out.append(f'            <li><a href="?by={k}" data-city="{k}">{e(c["navn"])}</a></li>')
    return '\n'.join(out)


def render_js():
    js = JS_CODE
    js = js.replace('@@CITIES_JSON@@', safe_json(city_data_json()))
    js = js.replace('@@CITY_HTML_JSON@@', safe_json(CITY_HTML))
    js = js.replace('@@SITE_URL_JSON@@', json.dumps(SITE_URL))
    return js


def render_page(key, js=None):
    c = CITIES[key]
    fr = CITY_HTML[key]
    page = SK_HEAD
    page = page.replace('@@CSS@@', CSS_BASE + CSS_EXTRA)
    page = page.replace('@@PRISER@@', transform_priser(PRISER_RAW))
    page = page.replace('@@INDSEND@@', build_indsend(c))
    page = page.replace('@@PROFIL@@', transform_profil(PROFIL_RAW))
    page = page.replace('@@JS@@', js if js is not None else render_js())
    canon = f'  <link rel="canonical" id="canonical" href="{SITE_URL}/">\n' if SITE_URL else ''
    ogurl = f'  <meta property="og:url" id="og-url" content="{SITE_URL}/">\n' if SITE_URL else ''
    tokens = {
        'TITLE': e(c['title']), 'DESC': e(c['desc']), 'ACCENT': e(c['accent']),
        'FAVICON': favicon_uri(c['accent']), 'CANONICAL': canon, 'OGURL': ogurl,
        'JSONLD': safe_json(jsonld(c)),
        'NAVN': e(c['navn']), 'PREFIX': e(c['prefix']), 'BY': e(c['by']), 'KOMMUNE': e(c['kommune']),
        'TAGLINE': e(c['tagline']), 'FOOTER_TAGLINE': e(c['footer_tagline']),
        'H1': e(f"{c['navn']} – lokale nyheder fra {c['kommune']}"),
        'NETBTNS': city_links(key, 'net'), 'DROPITEMS': city_links(key, 'drop'),
        'DRAWERBTNS': city_links(key, 'drawer'), 'FOOTERCITIES': city_links(key, 'footer'),
        'TICKER_HREF': e(c['ticker']['href']), 'TICKER_TEXT': e(c['ticker']['text']),
        'HERO_HREF': e(c['hero_href']), 'HERO_IMG': c['hero_img'], 'HERO_IMG_LABEL': e(c['hero_img_label']),
        'HERO_META': e(f"{c['hero_author']} · {c['hero_meta']}"), 'HERO_KICKER': e(c['hero_kicker']),
        'HERO_TITLE': e(c['hero_title']), 'HERO_MANCHET': e(c['hero_manchet']),
        'WIRE': render_wire(c), 'PILLS': render_pills(c), 'NABOLAG_BOX': render_area_box(c, 0),
        'COUNT': str(len(c['stories'])),
        'SEARCH_PH': e('Søg f.eks. ' + ', '.join(t.lower() for t in c['chips']) + '...'),
        'CHIPS': render_chips(c),
    }
    for k, v in fr.items():
        tokens['FR_' + k] = v
    for k, v in tokens.items():
        page = page.replace('@@' + k + '@@', v)
    left = re.findall(r'@@[A-Za-z_]+@@', page)
    if left:
        raise SystemExit(f'Ikke-udskiftede tokens: {sorted(set(left))}')
    return page


# ---------------------------------------------------------------------------
# BYGGE-TJEK: døde ankre, dublerede id'er, ukendte by-nøgler, tomme søgechips
# ---------------------------------------------------------------------------
class _Collect(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.hrefs, self.cities, self.tipmodes, self.supports, self.prodmodes = [], [], [], [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        if tag == 'a' and (a.get('href') or '').startswith('#') and len(a['href']) > 1:
            self.hrefs.append(a['href'][1:])
        if a.get('data-city'):
            self.cities.append(a['data-city'])
        if a.get('data-tipmode'):
            self.tipmodes.append(a['data-tipmode'])
        if a.get('data-support'):
            self.supports.append(a['data-support'])
        if 'js-product' in (a.get('class') or '').split():
            self.prodmodes.append(a.get('data-mode'))


def check_all(js):
    errors = []
    tip_ok = {'tip', 'event', 'sponsor', 'citat', 'debat'}
    for key, c in CITIES.items():
        page = render_page(key, js)
        p = _Collect()
        p.feed(page)
        ids = set(p.ids)
        dup = {i for i in p.ids if p.ids.count(i) > 1}
        if dup:
            errors.append(f'[{key}] dublerede id: {sorted(dup)}')
        for h in sorted(set(p.hrefs)):
            if h not in ids:
                errors.append(f'[{key}] dødt internt anker: #{h}')
        for k in set(p.cities):
            if k not in CITIES:
                errors.append(f'[{key}] ukendt by-nøgle i data-city: {k}')
        for m in set(p.tipmodes):
            if m not in tip_ok:
                errors.append(f'[{key}] ukendt data-tipmode: {m}')
        for m in set(p.supports):
            if m not in ('fast', 'valgfri'):
                errors.append(f'[{key}] ukendt data-support: {m}')
        for m in set(p.prodmodes):
            if m not in ('event', 'sponsor'):
                errors.append(f'[{key}] ukendt produkt-mode: {m}')
        # data, som JS skriver ind i DOM'en ved byskift, skal pege på eksisterende ids
        dyn = [c['hero_href'], c['ticker']['href']] + [w['href'] for w in c['wire']] + \
              [s['href'] for s in c['stories']] + ['#' + x['id'] for o in c['omraader'] for x in o['stories']]
        for h in dyn:
            if h[1:] not in ids:
                errors.append(f'[{key}] data peger på manglende id: {h}')
        # ét kort = én artikel; hver sektion har indhold
        for s in c['stories_full']:
            if s['id'] not in ids:
                errors.append(f'[{key}] historie uden artikel: {s["id"]}')
        titles = [s['title'] for s in c['stories_full']]
        if len(set(titles)) != len(titles):
            errors.append(f'[{key}] dublerede overskrifter')
        for sec in SEC_ORDER:
            if not any(s['sec'] == sec for s in c['stories_full']):
                errors.append(f'[{key}] sektion uden historier: {sec}')
        # søgechips må ikke give 0 resultater
        for chip in c['chips']:
            q = chip.lower()
            if not any(q in (s['title'] + ' ' + s['cat'] + ' ' + s['tags'] + ' ' + s['secname']).lower()
                       for s in c['stories']):
                errors.append(f'[{key}] søgechip uden resultater: {chip}')
        if c['key'] not in CITIES:
            errors.append(f'[{key}] by-nøgle mangler')
    # JS: hårdkodede ankre og switchCity-nøgler
    for h in re.findall(r"href: '#([a-z0-9_-]+)'", JS_CODE):
        pg = render_page(DEFAULT_CITY, js)
        if f'id="{h}"' not in pg and h != 'nabolag':
            errors.append(f'[js] SECTION_INDEX peger på manglende id: #{h}')
    full = render_page(DEFAULT_CITY, js)
    for k in re.findall(r"switchCity\('([a-z]+)'", full):
        if k not in CITIES:
            errors.append(f'[html] switchCity med ukendt nøgle: {k}')
    return errors


def main():
    js = render_js()
    errors = check_all(js)
    if errors:
        print('BYGGET FEJLEDE:', file=sys.stderr)
        for er in errors:
            print('  - ' + er, file=sys.stderr)
        sys.exit(1)
    html_content = render_page(DEFAULT_CITY, js)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)
    n_art = sum(len(c['stories_full']) for c in CITIES.values())
    print(f'nyhedssite.html opdateret. {len(html_content):,} bytes, {len(CITIES)} byer, {n_art} artikler, '
          f'ingen døde ankre.')


if __name__ == '__main__':
    main()
