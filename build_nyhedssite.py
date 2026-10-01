import re
import json

# Read base64 images from current nyhedssite.html
with open('nyhedssite.html', 'r', encoding='utf-8') as f:
    existing_content = f.read()

match = re.search(r'window\.SL_IMAGES\s*=\s*(\{.*?\});', existing_content, re.DOTALL)
if not match:
    raise ValueError("Could not find window.SL_IMAGES in nyhedssite.html")

sl_images_json = match.group(1)

html_template = '''<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SlagelseLokalt – Lokaljournalistik, der sætter fællesskabet først</title>
  <meta name="description" content="Nyheder, debat, erhverv, sport, kultur og fællesskab i Slagelse Kommune. Skabt i tæt dialog med borgere og lokalt erhvervsliv.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
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
      --live-red-soft: #FEF3F2;
      --blue-accent: #0284C7;
      --blue-soft: #F0F9FF;
      --gold-accent: #B45309;
      --gold-soft: #FEF3C7;
      
      --font-display: 'Newsreader', Georgia, serif;
      --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
      --shadow-md: 0 4px 14px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03);
      --shadow-lg: 0 10px 30px rgba(0,0,0,0.09), 0 4px 10px rgba(0,0,0,0.04);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 18px;
      --radius-xl: 24px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--ink);
      font-family: var(--font-body);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    a { color: inherit; text-decoration: none; cursor: pointer; }
    button { font-family: inherit; cursor: pointer; border: none; background: none; }
    img { display: block; max-width: 100%; height: auto; }

    .site-container {
      width: 100%;
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* TOP NETWORK BAR */
    .site-network-bar {
      background-color: #0F172A;
      color: #94A3B8;
      font-size: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .site-network-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 38px;
      gap: 16px;
    }
    .site-network-left {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow-x: auto;
      white-space: nowrap;
    }
    .site-network-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      color: #F8FAFC;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      font-size: 11px;
    }
    .site-network-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--site-accent);
    }
    .site-network-link {
      color: #94A3B8;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    .site-network-link:hover { color: #FFFFFF; background: rgba(255,255,255,0.1); }
    .site-network-link.is-current {
      color: #FFFFFF;
      font-weight: 600;
      background: rgba(255,255,255,0.15);
    }
    .site-network-right {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 12px;
      white-space: nowrap;
    }
    .site-live-ticker-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #E2E8F0;
      cursor: pointer;
    }
    .live-dot-pulse {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #EF4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.4);
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }

    /* HEADER */
    .site-header-wrapper {
      background: var(--surface);
      border-bottom: 1px solid var(--line);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: var(--shadow-sm);
    }
    .site-header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 72px;
      gap: 20px;
    }
    .site-header-left {
      display: flex;
      align-items: center;
      gap: 32px;
    }
    .site-brand-logo {
      display: flex;
      align-items: baseline;
      font-family: var(--font-display);
      font-size: 29px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--ink);
      user-select: none;
    }
    .site-brand-logo-accent {
      color: var(--site-accent);
      font-weight: 700;
      font-style: italic;
      margin-left: 1px;
    }
    .site-brand-tagline {
      font-size: 11px;
      font-weight: 500;
      color: var(--ink-3);
      letter-spacing: 0.02em;
      margin-top: -4px;
      display: block;
    }

    .site-header-primary-nav {
      display: flex;
      align-items: center;
    }
    .site-header-primary-list {
      display: flex;
      align-items: center;
      list-style: none;
      gap: 6px;
    }
    .site-header-primary-link {
      font-size: 14.5px;
      font-weight: 600;
      color: var(--ink-2);
      padding: 8px 13px;
      border-radius: var(--radius-sm);
      transition: all 0.15s ease;
      position: relative;
    }
    .site-header-primary-link:hover {
      color: var(--ink);
      background: var(--surface-2);
    }
    .site-header-primary-link.is-active {
      color: var(--site-accent);
      background: var(--site-accent-soft);
      font-weight: 700;
    }

    .site-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .site-header-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--ink-2);
      padding: 8px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
      background: var(--surface);
      transition: all 0.15s ease;
    }
    .site-header-action-btn:hover {
      background: var(--surface-2);
      color: var(--ink);
      border-color: #D1D5DB;
    }
    .site-header-btn-accent {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 13.5px;
      font-weight: 700;
      color: #FFFFFF;
      background: var(--site-accent);
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      transition: all 0.15s ease;
      box-shadow: 0 2px 6px rgba(0, 112, 56, 0.25);
    }
    .site-header-btn-accent:hover {
      background: var(--site-accent-hover);
      box-shadow: 0 3px 10px rgba(0, 112, 56, 0.35);
      transform: translateY(-1px);
    }
    .site-header-btn-tip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--site-accent);
      background: var(--site-accent-soft);
      padding: 8px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(0, 112, 56, 0.2);
      transition: all 0.15s ease;
    }
    .site-header-btn-tip:hover {
      background: #DDF1E2;
    }

    .site-hamburger-btn {
      display: none;
      width: 42px;
      height: 42px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
      background: var(--surface);
      align-items: center;
      justify-content: center;
      color: var(--ink);
    }
    .site-hamburger-btn:hover { background: var(--surface-2); }

    /* MOBILE SECTION BAR (HORIZONTALLY SCROLLABLE CHIPS) */
    .site-mobile-subnav {
      display: none;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
      padding: 8px 0;
      overflow-x: auto;
      white-space: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .site-mobile-subnav::-webkit-scrollbar { display: none; }
    .site-mobile-subnav-list {
      display: inline-flex;
      gap: 8px;
      padding: 0 16px;
    }
    .site-mobile-subnav-pill {
      font-size: 13px;
      font-weight: 600;
      color: var(--ink-2);
      background: var(--surface-2);
      padding: 6px 14px;
      border-radius: 999px;
      transition: all 0.15s;
    }
    .site-mobile-subnav-pill.is-active {
      color: #FFFFFF;
      background: var(--site-accent);
    }

    /* MOBILE DRAWER OVERLAY */
    .mobile-drawer-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 999;
      backdrop-filter: blur(4px);
    }
    .mobile-drawer-overlay.is-open { display: block; }
    .mobile-drawer-content {
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      max-width: 85%;
      height: 100%;
      background: var(--surface);
      z-index: 1000;
      box-shadow: var(--shadow-lg);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      transform: translateX(100%);
      transition: transform 0.25s ease-in-out;
      overflow-y: auto;
    }
    .mobile-drawer-overlay.is-open .mobile-drawer-content {
      transform: translateX(0);
    }
    .mobile-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--line);
      padding-bottom: 16px;
    }
    .mobile-drawer-nav-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .mobile-drawer-nav-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      font-size: 16px;
      font-weight: 600;
      color: var(--ink);
      border-radius: var(--radius-sm);
      transition: background 0.15s;
    }
    .mobile-drawer-nav-link:hover, .mobile-drawer-nav-link.is-active {
      background: var(--site-accent-soft);
      color: var(--site-accent);
    }

    /* VIEW PANES */
    .view-pane {
      display: none;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }
    .view-pane.is-active {
      display: block;
      opacity: 1;
    }

    /* MAIN CONTENT WRAPPER */
    .site-main-content {
      padding: 28px 0 64px 0;
    }

    /* SECTION HEADER BANNER */
    .section-banner-header {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 32px 36px;
      margin-bottom: 32px;
      box-shadow: var(--shadow-sm);
      position: relative;
      overflow: hidden;
    }
    .section-banner-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--site-accent);
    }
    .section-banner-kicker {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--site-accent);
      margin-bottom: 8px;
    }
    .section-banner-title {
      font-family: var(--font-display);
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--ink);
      line-height: 1.15;
      margin-bottom: 12px;
    }
    .section-banner-desc {
      font-size: 16px;
      color: var(--ink-2);
      max-width: 760px;
      line-height: 1.6;
    }
    .section-filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 20px;
    }
    .section-filter-pill {
      font-size: 13px;
      font-weight: 600;
      padding: 7px 15px;
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--ink-2);
      border: 1px solid var(--line);
      transition: all 0.15s ease;
    }
    .section-filter-pill:hover {
      background: var(--surface-3);
      color: var(--ink);
    }
    .section-filter-pill.is-active {
      background: var(--site-accent);
      color: #FFFFFF;
      border-color: var(--site-accent);
    }

    /* TOP 3-COL GRID (FORSIDE) */
    .site-top-3col-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 22px;
      margin-bottom: 32px;
    }
    @media (min-width: 1024px) {
      .site-top-3col-grid {
        grid-template-columns: 1.35fr 0.65fr 0.65fr;
        align-items: stretch;
      }
    }

    /* HERO CARD OVERLAY */
    .site-hero-overlay-card {
      position: relative;
      border-radius: var(--radius-lg);
      overflow: hidden;
      min-height: 480px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      box-shadow: var(--shadow-md);
      cursor: pointer;
      background: #1E293B;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .site-hero-overlay-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }
    .site-hero-overlay-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .site-hero-overlay-card:hover .site-hero-overlay-bg {
      transform: scale(1.03);
    }
    .site-hero-overlay-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.5) 45%, rgba(15, 23, 42, 0.95) 100%);
    }
    .site-hero-overlay-content {
      position: relative;
      z-index: 2;
      padding: 32px;
      color: #FFFFFF;
    }
    .site-hero-overlay-kicker {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: rgba(239, 68, 68, 0.95);
      color: #FFFFFF;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .site-hero-overlay-title {
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 800;
      line-height: 1.18;
      letter-spacing: -0.025em;
      margin-bottom: 12px;
      color: #FFFFFF;
    }
    .site-hero-overlay-manchet {
      font-size: 15.5px;
      color: #E2E8F0;
      line-height: 1.55;
      margin-bottom: 20px;
      max-width: 600px;
    }
    .site-hero-overlay-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .site-hero-btn-read {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #FFFFFF;
      color: #0F172A;
      font-size: 13.5px;
      font-weight: 700;
      padding: 9px 18px;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
    }
    .site-hero-btn-read:hover {
      background: #F1F5F9;
      transform: translateX(2px);
    }
    .site-hero-live-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      font-weight: 600;
      color: #FFFFFF;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);
      padding: 6px 12px;
      border-radius: 999px;
    }

    /* WIRE CARD (SENESTE NYT) */
    .site-wire-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
    }
    .site-wire-card-header {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 14px;
      border-bottom: 2px solid var(--line-subtle);
      margin-bottom: 16px;
    }
    .site-wire-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
    }
    .site-wire-item {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line-subtle);
      cursor: pointer;
      transition: transform 0.15s;
    }
    .site-wire-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .site-wire-item:hover {
      transform: translateX(3px);
    }
    .site-wire-time-pill {
      font-size: 11px;
      font-weight: 700;
      color: var(--ink-3);
      background: var(--surface-2);
      padding: 3px 7px;
      border-radius: 4px;
      white-space: nowrap;
      margin-top: 2px;
    }
    .site-wire-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--ink);
      line-height: 1.45;
    }
    .site-wire-item:hover .site-wire-title {
      color: var(--site-accent);
    }

    /* NABOLAG CARD */
    .site-nabolag-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
    }
    .site-nabolag-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .site-nabolag-title {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .site-nabolag-map-preview {
      border-radius: var(--radius-md);
      overflow: hidden;
      position: relative;
      margin-bottom: 16px;
      height: 140px;
    }
    .site-nabolag-map-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .site-nabolag-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
    }
    .site-nabolag-pill {
      font-size: 12px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--ink-2);
      border: 1px solid var(--line);
      cursor: pointer;
      transition: all 0.15s;
    }
    .site-nabolag-pill:hover, .site-nabolag-pill.is-active {
      background: var(--site-accent);
      color: #FFFFFF;
      border-color: var(--site-accent);
    }

    /* MIDDLE 3-CARDS GRID */
    .site-middle-3cards-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 22px;
      margin-bottom: 36px;
    }
    @media (min-width: 768px) {
      .site-middle-3cards-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    .site-middle-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .site-middle-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
    }
    .site-middle-card-thumb {
      height: 200px;
      overflow: hidden;
      position: relative;
    }
    .site-middle-card-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .site-middle-card:hover .site-middle-card-thumb img {
      transform: scale(1.04);
    }
    .site-middle-card-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .site-middle-card-kicker {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--site-accent);
      margin-bottom: 8px;
    }
    .site-middle-card-title {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.015em;
      color: var(--ink);
      margin-bottom: 10px;
    }
    .site-middle-card:hover .site-middle-card-title {
      color: var(--site-accent);
    }
    .site-middle-card-desc {
      font-size: 14px;
      color: var(--ink-2);
      line-height: 1.5;
      margin-bottom: 16px;
      flex: 1;
    }
    .site-middle-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: var(--ink-3);
      padding-top: 12px;
      border-top: 1px solid var(--line-subtle);
    }

    /* COMMUNITY PARTICIPATION BANNER */
    .site-community-banner {
      background: linear-gradient(135deg, #064E3B 0%, #065F46 100%);
      border-radius: var(--radius-lg);
      padding: 36px 40px;
      color: #FFFFFF;
      margin-bottom: 40px;
      box-shadow: var(--shadow-md);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    @media (min-width: 860px) {
      .site-community-banner {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    .site-community-left {
      max-width: 680px;
    }
    .site-community-kicker {
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #A7F3D0;
      margin-bottom: 8px;
    }
    .site-community-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.25;
      margin-bottom: 10px;
      color: #FFFFFF;
    }
    .site-community-desc {
      font-size: 15px;
      color: #D1FAE5;
      line-height: 1.55;
    }
    .site-community-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .site-community-btn-main {
      background: #FFFFFF;
      color: #064E3B;
      font-size: 14px;
      font-weight: 700;
      padding: 12px 22px;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .site-community-btn-main:hover {
      background: #F0FDF4;
      transform: translateY(-1px);
    }
    .site-community-btn-secondary {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 20px;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .site-community-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* 4-COLUMN CARDS GRID */
    .site-section-heading-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .site-section-title {
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .site-bottom-4grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      margin-bottom: 40px;
    }
    @media (min-width: 640px) {
      .site-bottom-4grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (min-width: 1024px) {
      .site-bottom-4grid { grid-template-columns: repeat(4, 1fr); }
    }
    .site-bottom-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .site-bottom-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
    }
    .site-bottom-card-thumb {
      height: 160px;
      overflow: hidden;
      position: relative;
    }
    .site-bottom-card-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .site-bottom-card:hover .site-bottom-card-thumb img {
      transform: scale(1.04);
    }
    .site-bottom-card-body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .site-bottom-card-kicker {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--site-accent);
      margin-bottom: 6px;
    }
    .site-bottom-card-title {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.015em;
      color: var(--ink);
      margin-bottom: 8px;
    }
    .site-bottom-card:hover .site-bottom-card-title {
      color: var(--site-accent);
    }
    .site-bottom-card-desc {
      font-size: 13.5px;
      color: var(--ink-2);
      line-height: 1.45;
      margin-bottom: 12px;
      flex: 1;
    }
    .site-bottom-card-meta {
      font-size: 11.5px;
      color: var(--ink-3);
      padding-top: 10px;
      border-top: 1px solid var(--line-subtle);
    }

    /* BEACON PARTNERS SECTION */
    .site-partners-box {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 28px 32px;
      box-shadow: var(--shadow-sm);
      margin-bottom: 40px;
    }
    .site-partners-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
    }
    .site-partners-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-3);
    }
    .site-partners-logos {
      display: flex;
      align-items: center;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 24px;
      padding: 16px 0;
      border-top: 1px solid var(--line-subtle);
      border-bottom: 1px solid var(--line-subtle);
      margin-bottom: 16px;
    }
    .site-partner-badge {
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 700;
      color: #475569;
      opacity: 0.85;
      letter-spacing: -0.02em;
      transition: opacity 0.15s;
    }
    .site-partner-badge:hover { opacity: 1; color: var(--ink); }

    /* ARTICLE DETAIL VIEWS */
    .article-detail-container {
      max-width: 820px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 44px;
      box-shadow: var(--shadow-sm);
      margin-bottom: 40px;
    }
    @media (max-width: 640px) {
      .article-detail-container { padding: 24px 20px; }
    }
    .article-back-nav {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--site-accent);
      background: var(--site-accent-soft);
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 24px;
      transition: background 0.15s;
    }
    .article-back-nav:hover { background: #DDF1E2; }
    .article-kicker-badge {
      display: inline-block;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--site-accent);
      margin-bottom: 12px;
    }
    .article-heading {
      font-family: var(--font-display);
      font-size: 38px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.025em;
      color: var(--ink);
      margin-bottom: 16px;
    }
    @media (max-width: 640px) {
      .article-heading { font-size: 28px; }
    }
    .article-lead {
      font-size: 18px;
      font-weight: 500;
      color: var(--ink-2);
      line-height: 1.6;
      margin-bottom: 24px;
      border-left: 3px solid var(--site-accent);
      padding-left: 16px;
    }
    .article-byline-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 14px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      margin-bottom: 28px;
      font-size: 13px;
      color: var(--ink-3);
    }
    .article-author-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .article-author-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--surface-2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: var(--site-accent);
    }
    .article-hero-figure {
      margin-bottom: 32px;
      border-radius: var(--radius-lg);
      overflow: hidden;
      position: relative;
    }
    .article-hero-figure img {
      width: 100%;
      max-height: 480px;
      object-fit: cover;
    }
    .article-caption {
      font-size: 12.5px;
      color: var(--ink-3);
      padding: 8px 12px;
      background: var(--surface-2);
      border-bottom-left-radius: var(--radius-lg);
      border-bottom-right-radius: var(--radius-lg);
    }
    .article-prose {
      font-size: 16.5px;
      line-height: 1.75;
      color: #27272A;
    }
    .article-prose p {
      margin-bottom: 20px;
    }
    .article-pullquote {
      font-family: var(--font-display);
      font-size: 22px;
      font-style: italic;
      color: var(--ink);
      line-height: 1.45;
      margin: 32px 0;
      padding: 20px 24px;
      background: var(--surface-2);
      border-left: 4px solid var(--site-accent);
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
    }
    .article-faktaboks {
      background: var(--blue-soft);
      border: 1px solid #BAE6FD;
      border-radius: var(--radius-md);
      padding: 22px;
      margin: 30px 0;
    }
    .article-faktaboks-title {
      font-size: 14px;
      font-weight: 700;
      color: #0369A1;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .article-faktaboks ul {
      padding-left: 20px;
      font-size: 14px;
      color: #0C4A6E;
      line-height: 1.6;
    }
    .article-share-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid var(--line);
    }
    .article-share-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--ink-2);
      background: var(--surface-2);
      border: 1px solid var(--line);
      padding: 8px 14px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s;
    }
    .article-share-btn:hover { background: var(--surface-3); color: var(--ink); }

    /* SUPPORT PAGE */
    .support-card-container {
      max-width: 860px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 44px;
      box-shadow: var(--shadow-sm);
      margin-bottom: 40px;
    }
    .support-mode-toggle {
      display: flex;
      background: var(--surface-2);
      padding: 5px;
      border-radius: var(--radius-md);
      margin-bottom: 28px;
      gap: 6px;
    }
    .support-toggle-btn {
      flex: 1;
      text-align: center;
      padding: 12px;
      font-size: 14.5px;
      font-weight: 700;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
      cursor: pointer;
    }
    .support-toggle-btn.is-active {
      background: var(--surface);
      color: var(--ink);
      box-shadow: var(--shadow-sm);
    }
    .support-plans-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-bottom: 28px;
    }
    @media (min-width: 680px) {
      .support-plans-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .support-plan-card {
      background: var(--surface);
      border: 2px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 24px 20px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
    }
    .support-plan-card:hover {
      border-color: #9CA3AF;
      transform: translateY(-2px);
    }
    .support-plan-card.is-selected {
      border-color: var(--site-accent);
      background: var(--site-accent-light);
    }
    .support-plan-name {
      font-size: 17px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 6px;
    }
    .support-plan-price {
      font-size: 28px;
      font-weight: 800;
      color: var(--site-accent);
      margin-bottom: 12px;
    }
    .support-plan-price span {
      font-size: 13px;
      font-weight: 500;
      color: var(--ink-3);
    }
    .support-plan-features {
      list-style: none;
      font-size: 13px;
      color: var(--ink-2);
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      margin-bottom: 16px;
    }

    .custom-amt-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    @media (min-width: 600px) {
      .custom-amt-grid { grid-template-columns: repeat(5, 1fr); }
    }
    .custom-amt-btn {
      padding: 12px 10px;
      font-size: 15px;
      font-weight: 700;
      border: 1px solid var(--line);
      background: var(--surface);
      border-radius: var(--radius-sm);
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    .custom-amt-btn:hover { background: var(--surface-2); }
    .custom-amt-btn.is-active {
      background: var(--site-accent);
      color: #FFFFFF;
      border-color: var(--site-accent);
    }

    /* SUBMIT / INDSEND FORM */
    .submit-form-container {
      max-width: 760px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 40px;
      box-shadow: var(--shadow-sm);
      margin-bottom: 40px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-label {
      display: block;
      font-size: 13.5px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 6px;
    }
    .form-control {
      width: 100%;
      padding: 11px 14px;
      font-size: 14.5px;
      font-family: inherit;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--ink);
      transition: border 0.15s;
    }
    .form-control:focus {
      outline: none;
      border-color: var(--site-accent);
      box-shadow: 0 0 0 3px var(--site-accent-soft);
    }
    .form-dropzone {
      border: 2px dashed #D1D5DB;
      border-radius: var(--radius-md);
      padding: 28px;
      text-align: center;
      background: var(--surface-2);
      cursor: pointer;
      transition: all 0.15s;
    }
    .form-dropzone:hover {
      border-color: var(--site-accent);
      background: var(--site-accent-light);
    }

    /* SEARCH VIEW */
    .search-view-container {
      max-width: 860px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 40px;
      box-shadow: var(--shadow-sm);
      margin-bottom: 40px;
    }
    .search-input-wrapper {
      position: relative;
      margin-bottom: 24px;
    }
    .search-input-field {
      width: 100%;
      padding: 16px 20px 16px 50px;
      font-size: 18px;
      font-family: inherit;
      border: 2px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface-2);
      color: var(--ink);
      transition: all 0.15s;
    }
    .search-input-field:focus {
      outline: none;
      border-color: var(--site-accent);
      background: #FFFFFF;
      box-shadow: 0 0 0 4px var(--site-accent-soft);
    }
    .search-input-icon {
      position: absolute;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--ink-3);
    }
    .search-results-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .search-result-item {
      padding: 18px 20px;
      border-radius: var(--radius-md);
      background: var(--surface-2);
      border: 1px solid var(--line);
      cursor: pointer;
      transition: all 0.15s;
    }
    .search-result-item:hover {
      background: #FFFFFF;
      border-color: var(--site-accent);
      box-shadow: var(--shadow-sm);
      transform: translateX(4px);
    }

    /* FOOTER */
    .site-footer {
      background: #0F172A;
      color: #94A3B8;
      padding: 60px 0 36px 0;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 14px;
    }
    .site-footer-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 40px;
      margin-bottom: 48px;
    }
    @media (min-width: 768px) {
      .site-footer-grid {
        grid-template-columns: 1.5fr 1fr 1fr 1fr;
      }
    }
    .site-footer-brand {
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 12px;
    }
    .site-footer-brand span { color: #34D399; font-style: italic; }
    .site-footer-text {
      line-height: 1.6;
      color: #94A3B8;
      margin-bottom: 20px;
      max-width: 320px;
    }
    .site-footer-col-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #F8FAFC;
      margin-bottom: 16px;
    }
    .site-footer-links {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .site-footer-links a {
      color: #94A3B8;
      transition: color 0.15s;
    }
    .site-footer-links a:hover { color: #FFFFFF; }
    .site-footer-bottom {
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 12.5px;
      color: #64748B;
    }
    @media (min-width: 768px) {
      .site-footer-bottom {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }
    }

    /* RESPONSIVE BREAKPOINTS */
    @media (max-width: 960px) {
      .site-header-primary-nav { display: none; }
      .site-hamburger-btn { display: inline-flex; }
      .site-mobile-subnav { display: block; }
      .site-brand-tagline { display: none; }
    }
    @media (max-width: 640px) {
      .site-header-btn-tip { display: none; }
      .site-network-right { display: none; }
      .site-hero-overlay-card { min-height: 400px; }
      .site-hero-overlay-title { font-size: 24px; }
      .section-banner-title { font-size: 26px; }
    }
  </style>
</head>
<body>

  <!-- SINGLETON IMAGE REGISTRY -->
  <script>
    window.SL_IMAGES = __IMAGES_JSON__;
  </script>

  <!-- 1. TOP NETWORK BAR -->
  <div class="site-network-bar">
    <div class="site-container site-network-inner">
      <div class="site-network-left">
        <span class="site-network-badge"><span class="site-network-dot"></span> [By]Lokalt netværk:</span>
        <a onclick="navigate('forside')" class="site-network-link is-current">Slagelse</a>
        <a onclick="alert('Skifter til KalundborgLokalt')" class="site-network-link">Kalundborg</a>
        <a onclick="alert('Skifter til NæstvedLokalt')" class="site-network-link">Næstved</a>
        <a onclick="alert('Skifter til HolbækLokalt')" class="site-network-link">Holbæk</a>
      </div>
      <div class="site-network-right">
        <a onclick="navigateArticle('storebaelt')" class="site-live-ticker-item">
          <span class="live-dot-pulse"></span>
          <span><strong>LIVE:</strong> Storebæltsbroen mod Fyn – Forventet normalisering kl. 14:15</span>
        </a>
      </div>
    </div>
  </div>

  <!-- 2. STICKY HEADER -->
  <header class="site-header-wrapper">
    <div class="site-container site-header-inner">
      <div class="site-header-left">
        <div>
          <a onclick="navigate('forside')" class="site-brand-logo">
            Slagelse<span class="site-brand-logo-accent">Lokalt</span>
          </a>
          <span class="site-brand-tagline">Lokaljournalistik, der sætter fællesskabet først</span>
        </div>

        <!-- Primary Desktop Nav -->
        <nav class="site-header-primary-nav">
          <ul class="site-header-primary-list">
            <li><a onclick="navigate('forside')" id="nav-forside" class="site-header-primary-link is-active">Forside</a></li>
            <li><a onclick="navigate('nyheder')" id="nav-nyheder" class="site-header-primary-link">Nyheder</a></li>
            <li><a onclick="navigate('erhverv')" id="nav-erhverv" class="site-header-primary-link">Erhverv</a></li>
            <li><a onclick="navigate('sport')" id="nav-sport" class="site-header-primary-link">Sport</a></li>
            <li><a onclick="navigate('kultur')" id="nav-kultur" class="site-header-primary-link">Kultur</a></li>
            <li><a onclick="navigate('foreningsliv')" id="nav-foreningsliv" class="site-header-primary-link">Foreningsliv</a></li>
            <li><a onclick="navigate('debat')" id="nav-debat" class="site-header-primary-link">Debat</a></li>
          </ul>
        </nav>
      </div>

      <div class="site-header-actions">
        <button onclick="navigate('soeg')" id="nav-soeg" class="site-header-action-btn" title="Søg i alle artikler">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Søg</span>
        </button>

        <a onclick="navigate('indsend')" class="site-header-btn-tip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <span>Indsend historie</span>
        </a>

        <a onclick="navigate('stoet')" class="site-header-btn-accent">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <span>Støt SlagelseLokalt</span>
        </a>

        <button onclick="toggleMobileMenu()" class="site-hamburger-btn" aria-label="Åbn menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- 3. MOBILE SUBNAV PILLS (HORIZONTALLY SCROLLABLE) -->
  <div class="site-mobile-subnav">
    <div class="site-mobile-subnav-list">
      <a onclick="navigate('forside')" id="mobnav-forside" class="site-mobile-subnav-pill is-active">Forside</a>
      <a onclick="navigate('nyheder')" id="mobnav-nyheder" class="site-mobile-subnav-pill">Nyheder</a>
      <a onclick="navigate('erhverv')" id="mobnav-erhverv" class="site-mobile-subnav-pill">Erhverv</a>
      <a onclick="navigate('sport')" id="mobnav-sport" class="site-mobile-subnav-pill">Sport</a>
      <a onclick="navigate('kultur')" id="mobnav-kultur" class="site-mobile-subnav-pill">Kultur</a>
      <a onclick="navigate('foreningsliv')" id="mobnav-foreningsliv" class="site-mobile-subnav-pill">Foreningsliv</a>
      <a onclick="navigate('debat')" id="mobnav-debat" class="site-mobile-subnav-pill">Debat</a>
      <a onclick="navigate('stoet')" id="mobnav-stoet" class="site-mobile-subnav-pill" style="color:var(--site-accent); font-weight:700;">❤️ Støt</a>
      <a onclick="navigate('indsend')" id="mobnav-indsend" class="site-mobile-subnav-pill">✍️ Indsend</a>
    </div>
  </div>

  <!-- 4. MOBILE DRAWER MENU -->
  <div id="mobile-drawer" class="mobile-drawer-overlay" onclick="toggleMobileMenu()">
    <div class="mobile-drawer-content" onclick="event.stopPropagation()">
      <div class="mobile-drawer-header">
        <div class="site-brand-logo" style="font-size:22px;">Slagelse<span class="site-brand-logo-accent">Lokalt</span></div>
        <button onclick="toggleMobileMenu()" style="font-size:24px; color:var(--ink-3);">&times;</button>
      </div>

      <ul class="mobile-drawer-nav-list">
        <li><a onclick="navigate('forside'); toggleMobileMenu()" class="mobile-drawer-nav-link">Forside <span>→</span></a></li>
        <li><a onclick="navigate('nyheder'); toggleMobileMenu()" class="mobile-drawer-nav-link">Nyheder <span>→</span></a></li>
        <li><a onclick="navigate('erhverv'); toggleMobileMenu()" class="mobile-drawer-nav-link">Erhverv <span>→</span></a></li>
        <li><a onclick="navigate('sport'); toggleMobileMenu()" class="mobile-drawer-nav-link">Sport <span>→</span></a></li>
        <li><a onclick="navigate('kultur'); toggleMobileMenu()" class="mobile-drawer-nav-link">Kultur <span>→</span></a></li>
        <li><a onclick="navigate('foreningsliv'); toggleMobileMenu()" class="mobile-drawer-nav-link">Foreningsliv <span>→</span></a></li>
        <li><a onclick="navigate('debat'); toggleMobileMenu()" class="mobile-drawer-nav-link">Debat <span>→</span></a></li>
        <li><a onclick="navigate('soeg'); toggleMobileMenu()" class="mobile-drawer-nav-link">Søg i arkivet <span>🔍</span></a></li>
        <li><a onclick="navigate('indsend'); toggleMobileMenu()" class="mobile-drawer-nav-link">Indsend historie <span>✍️</span></a></li>
        <li><a onclick="navigate('stoet'); toggleMobileMenu()" class="mobile-drawer-nav-link" style="color:var(--site-accent); font-weight:700;">Støt SlagelseLokalt <span>❤️</span></a></li>
      </ul>

      <div style="margin-top:auto; padding-top:20px; border-top:1px solid var(--line); font-size:12.5px; color:var(--ink-3);">
        <strong>SlagelseLokalt</strong><br>
        Lokaljournalistik, der sætter fællesskabet først.<br>
        Slagelse · Korsør · Skælskør
      </div>
    </div>
  </div>

  <!-- MAIN CONTAINER -->
  <main class="site-container site-main-content">

    <!-- ========================================== -->
    <!-- VIEW: FORSIDE                              -->
    <!-- ========================================== -->
    <div id="view-forside" class="view-pane is-active">
      
      <!-- ZONE 1: TOP 3-KOLONNER -->
      <section class="site-top-3col-grid">
        <!-- Kolonne 1: Hero Card -->
        <article class="site-hero-overlay-card" onclick="navigateArticle('storebaelt')">
          <img data-img="storebaelt_hero" alt="Storebæltsbroen i solnedgang" class="site-hero-overlay-bg">
          <div class="site-hero-overlay-gradient"></div>
          <div class="site-hero-overlay-content">
            <span class="site-hero-overlay-kicker">TRAFIK · STOREBÆLT</span>
            <h1 class="site-hero-overlay-title">Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld</h1>
            <p class="site-hero-overlay-manchet">Et trafikuheld spærrer et spor på Storebæltsbroen. Bilister skal forvente 20-30 minutters ekstra rejsetid.</p>
            <div class="site-hero-overlay-actions">
              <span class="site-hero-btn-read">
                <span>Læs hele historien</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </span>
              <span class="site-hero-live-pill">
                <span class="live-dot-pulse"></span>
                <span>Opdateret kl. 11:42</span>
              </span>
            </div>
          </div>
        </article>

        <!-- Kolonne 2: Seneste Nyt (Wire) -->
        <aside class="site-wire-card">
          <div class="site-wire-card-header">
            <span>Seneste nyt</span>
            <span style="font-size:12px; font-weight:600; color:var(--site-accent);">Slagelse Kommune</span>
          </div>
          <div class="site-wire-list">
            <div class="site-wire-item" onclick="navigateArticle('byraad')">
              <span class="site-wire-time-pill">08:12</span>
              <p class="site-wire-title">Nyt flertal på rådhuset vil investere 45 millioner i bymidten</p>
            </div>
            <div class="site-wire-item" onclick="navigateArticle('sommerhuse')">
              <span class="site-wire-time-pill">07:48</span>
              <p class="site-wire-title">Flere sommerhuse udsat for indbrud ved Skælskør Næs</p>
            </div>
            <div class="site-wire-item" onclick="navigateArticle('butik')">
              <span class="site-wire-time-pill">06:32</span>
              <p class="site-wire-title">Ny grøn detailbutik rykker ind på Schweizerpladsen til foråret</p>
            </div>
            <div class="site-wire-item" onclick="navigateArticle('sport')">
              <span class="site-wire-time-pill">22:15</span>
              <p class="site-wire-title">Slagelse B&I tager vigtig sejr i topopgøret på Harboe Arena</p>
            </div>
            <div class="site-wire-item" onclick="navigateArticle('tudeaa')">
              <span class="site-wire-time-pill">21:05</span>
              <p class="site-wire-title">Stort naturprojekt ved Tude Å skal sikre mod fremtidige oversvømmelser</p>
            </div>
          </div>
        </aside>

        <!-- Kolonne 3: Nabolag & Områder -->
        <aside class="site-nabolag-card">
          <div class="site-nabolag-header">
            <h2 class="site-nabolag-title">Dit nabolag</h2>
            <span style="font-size:12px; color:var(--ink-3);">Lokalt overblik</span>
          </div>
          <div class="site-nabolag-map-preview">
            <img data-img="nabolag_kort" alt="Kort over Slagelse Kommune">
          </div>
          <div class="site-nabolag-pills">
            <button onclick="filterNabolag('Slagelse C', this)" class="site-nabolag-pill is-active">Slagelse C</button>
            <button onclick="filterNabolag('Korsør', this)" class="site-nabolag-pill">Korsør</button>
            <button onclick="filterNabolag('Skælskør', this)" class="site-nabolag-pill">Skælskør</button>
            <button onclick="filterNabolag('Dalmose', this)" class="site-nabolag-pill">Dalmose</button>
            <button onclick="filterNabolag('Vemmelev', this)" class="site-nabolag-pill">Vemmelev</button>
          </div>
          <div id="nabolag-story" style="font-size:13.5px; color:var(--ink-2); line-height:1.5; padding:12px; background:var(--surface-2); border-radius:var(--radius-sm); border:1px solid var(--line);">
            <strong>Slagelse C:</strong> 4 nye projekter godkendt i bymidten. Håndværkere er gået i gang med omlægning af fortove ved Nytorv.
          </div>
        </aside>
      </section>

      <!-- ZONE 2: 3 MELLEM-KORT -->
      <section class="site-middle-3cards-grid">
        <article class="site-middle-card" onclick="navigateArticle('byraad')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_bymidte" alt="Slagelse Rådhus og bymidte">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">BYUDVIKLING & POLITIK</span>
            <h3 class="site-middle-card-title">Nyt flertal på rådhuset vil investere 45 millioner i bymidten</h3>
            <p class="site-middle-card-desc">Efter måneders forhandlinger er et bredt flertal enige om en historisk investering i Slagelses handelsliv, grønne pladser og gågader.</p>
            <div class="site-middle-card-meta">
              <span>Thomas Bach</span>
              <span>4 t. siden</span>
            </div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('sommerhuse')">
          <div class="site-middle-card-thumb">
            <img data-img="skaelskoer_sommerhus" alt="Sommerhuse ved Skælskør Næs">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">KRIMI & TRYGHED</span>
            <h3 class="site-middle-card-title">Flere sommerhuse udsat for indbrud ved Skælskør Næs</h3>
            <p class="site-middle-card-desc">Politiet opfordrer sommerhusejere og naboer til øget årvågenhed efter en stribe indbrud i weekenden langs kysten.</p>
            <div class="site-middle-card-meta">
              <span>Mette Lindegaard</span>
              <span>6 t. siden</span>
            </div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('butik')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_erhverv" alt="Lokalt butiksliv på Schweizerpladsen">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">ERHVERV & HANDEL</span>
            <h3 class="site-middle-card-title">Ny butikskæde åbner på Schweizerpladsen: Vil puste liv i handelsgaden</h3>
            <p class="site-middle-card-desc">En nyskabende detailforretning med fokus på bæredygtighed slår dørene op til foråret og skaber 12 nye lokale arbejdspladser.</p>
            <div class="site-middle-card-meta">
              <span>Henrik Friis</span>
              <span>I dag</span>
            </div>
          </div>
        </article>
      </section>

      <!-- ZONE 3: FÆLLESSKABSBANNER (UDEN UAFHÆNGIG) -->
      <section class="site-community-banner">
        <div class="site-community-left">
          <span class="site-community-kicker">BORGERDREVET MEDIE</span>
          <h2 class="site-community-title">Vær med til at præge SlagelseLokalt</h2>
          <p class="site-community-desc">
            Vores journalistik skabes i tæt samspil med hverdagen i Slagelse Kommune. Vi finansieres og formes af borgerne og de lokale virksomheder – og vi modtager altid gerne dine idéer, spørgsmål og historier.
          </p>
        </div>
        <div class="site-community-actions">
          <a onclick="navigate('indsend')" class="site-community-btn-main">Indsend historie / Tip redaktionen</a>
          <a onclick="navigate('stoet')" class="site-community-btn-secondary">Støt med valgfrit beløb</a>
        </div>
      </section>

      <!-- ZONE 4: MERE FRA SLAGELSE (4-GRID) -->
      <section>
        <div class="site-section-heading-row">
          <h2 class="site-section-title">Mere fra Slagelse Kommune</h2>
          <div style="display:flex; gap:8px;">
            <button onclick="navigate('sport')" class="section-filter-pill">Se sport →</button>
            <button onclick="navigate('debat')" class="section-filter-pill">Se debat →</button>
          </div>
        </div>

        <div class="site-bottom-4grid">
          <article class="site-bottom-card" onclick="navigateArticle('sport')">
            <div class="site-bottom-card-thumb">
              <img data-img="slagelse_fodbold" alt="Slagelse B&I fodboldkamp">
            </div>
            <div class="site-bottom-card-body">
              <span class="site-bottom-card-kicker">LOKALSPORT</span>
              <h3 class="site-bottom-card-title">Slagelse B&I henter dramatisk overtidssejr</h3>
              <p class="site-bottom-card-desc">Et mål i 93. minut sikrede alle tre point foran 1.100 ellevilde tilskuere på Harboe Arena.</p>
              <div class="site-bottom-card-meta">Sport · 1 t. siden</div>
            </div>
          </article>

          <article class="site-bottom-card" onclick="navigateArticle('tudeaa')">
            <div class="site-bottom-card-thumb">
              <img data-img="tude_aa_natur" alt="Tude Å og vådområde">
            </div>
            <div class="site-bottom-card-body">
              <span class="site-bottom-card-kicker">NATUR & MILJØ</span>
              <h3 class="site-bottom-card-title">Nyt vådområdeprojekt ved Tude Å</h3>
              <p class="site-bottom-card-desc">Slagelse Kommune og lokale lodsejere etablerer 140 hektar vådområde for at mindske kvælstof og oversvømmelser.</p>
              <div class="site-bottom-card-meta">Natur · 3 t. siden</div>
            </div>
          </article>

          <article class="site-bottom-card" onclick="navigateArticle('debat')">
            <div class="site-bottom-card-thumb">
              <img data-img="debat_skriver" alt="Borger der skriver debatindlæg">
            </div>
            <div class="site-bottom-card-body">
              <span class="site-bottom-card-kicker">DEBATINDLÆG</span>
              <h3 class="site-bottom-card-title">"Vi skal bevare byens grønne åndehuller"</h3>
              <p class="site-bottom-card-desc">Lise Holm fra Korsør opfordrer byrådet til at skåne de gamle træer ved havnefronten.</p>
              <div class="site-bottom-card-meta">Debat · 5 t. siden</div>
            </div>
          </article>

          <article class="site-bottom-card" onclick="navigateArticle('foreningsliv')">
            <div class="site-bottom-card-thumb">
              <img data-img="slagelse_bymidte" alt="Frivillige til hyggeaften">
            </div>
            <div class="site-bottom-card-body">
              <span class="site-bottom-card-kicker">FORENINGSLIV</span>
              <h3 class="site-bottom-card-title">120 frivillige hædret ved årets foreningsfest</h3>
              <p class="site-bottom-card-desc">Ildsjæle fra idræt, spejdere og ældreklubber mødtes i går til fælles hyldest i Korsør Kulturhus.</p>
              <div class="site-bottom-card-meta">Fællesskab · I går</div>
            </div>
          </article>
        </div>
      </section>

      <!-- ZONE 5: ERHVERVSPARTNERE -->
      <section class="site-partners-box">
        <div class="site-partners-top">
          <span class="site-partners-title">Lokale støttepartnere & virksomheder</span>
          <a onclick="navigate('stoet')" style="font-size:13px; font-weight:700; color:var(--site-accent);">Vil din virksomhed også støtte? Bliv partner her →</a>
        </div>
        <div class="site-partners-logos">
          <span class="site-partner-badge">Harboe Bryggeri</span>
          <span class="site-partner-badge">Sparekassen Sjælland-Fyn</span>
          <span class="site-partner-badge">VKST Landbrugsrådgivning</span>
          <span class="site-partner-badge">Danbolig Slagelse</span>
          <span class="site-partner-badge">SuperBrugsen Korsør</span>
        </div>
        <div style="font-size:12px; color:var(--ink-3); text-align:center;">
          Partnere og støttemedlemmer støtter driften af SlagelseLokalt, så indholdet er frit tilgængeligt for alle borgere i Slagelse Kommune.
        </div>
      </section>

    </div><!-- /view-forside -->


    <!-- ========================================== -->
    <!-- VIEW: NYHEDER                              -->
    <!-- ========================================== -->
    <div id="view-nyheder" class="view-pane">
      <div class="section-banner-header">
        <span class="section-banner-kicker">SEKTIONSOVERBLIK</span>
        <h1 class="section-banner-title">Nyheder fra Slagelse Kommune</h1>
        <p class="section-banner-desc">
          Aktuelle begivenheder, politik, trafik, 112 og lokalsamfundet i Slagelse, Korsør, Skælskør og omegn.
        </p>
        <div class="section-filter-pills">
          <button class="section-filter-pill is-active">Alle nyheder</button>
          <button class="section-filter-pill" onclick="filterCategory('trafik')">Trafik & Veje</button>
          <button class="section-filter-pill" onclick="filterCategory('politik')">Rådhus & Politik</button>
          <button class="section-filter-pill" onclick="filterCategory('politi')">Politi & Beredskab</button>
          <button class="section-filter-pill" onclick="filterCategory('lokal')">Nærområder</button>
        </div>
      </div>

      <div class="site-middle-3cards-grid">
        <article class="site-middle-card" onclick="navigateArticle('storebaelt')">
          <div class="site-middle-card-thumb">
            <img data-img="storebaelt_hero" alt="Storebæltsbroen">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">TRAFIK</span>
            <h3 class="site-middle-card-title">Kødannelse på Storebæltsbroen mod Fyn efter trafikuheld</h3>
            <p class="site-middle-card-desc">Et uheld skabte mandag formiddag lange køer. Trafikken afvikles nu i ét spor.</p>
            <div class="site-middle-card-meta"><span>Trafik</span><span>Opdateret i dag</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('byraad')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_bymidte" alt="Slagelse Rådhus">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">POLITIK</span>
            <h3 class="site-middle-card-title">Nyt flertal på rådhuset vil investere 45 millioner i bymidten</h3>
            <p class="site-middle-card-desc">Omfattende fornyelse af gågademiljøet, grønne arealer og bedre adgang for fodgængere.</p>
            <div class="site-middle-card-meta"><span>Byråd</span><span>4 t. siden</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('sommerhuse')">
          <div class="site-middle-card-thumb">
            <img data-img="skaelskoer_sommerhus" alt="Sommerhuse Skælskør">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">BEREDSKAB & KRIMI</span>
            <h3 class="site-middle-card-title">Flere sommerhuse udsat for indbrud ved Skælskør Næs</h3>
            <p class="site-middle-card-desc">Beboere og grundejerforening advarer hinanden i Facebook-grupper efter nattens hændelser.</p>
            <div class="site-middle-card-meta"><span>Krimi</span><span>6 t. siden</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('tudeaa')">
          <div class="site-middle-card-thumb">
            <img data-img="tude_aa_natur" alt="Tude Å">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">NATUR & MILJØ</span>
            <h3 class="site-middle-card-title">Nyt vådområdeprojekt ved Tude Å skal sikre mod oversvømmelser</h3>
            <p class="site-middle-card-desc">140 hektar lavbundsjord omlægges for at beskytte landbrug og skabe levesteder for fugleliv.</p>
            <div class="site-middle-card-meta"><span>Natur</span><span>I går</span></div>
          </div>
        </article>
      </div>
    </div><!-- /view-nyheder -->


    <!-- ========================================== -->
    <!-- VIEW: ERHVERV                              -->
    <!-- ========================================== -->
    <div id="view-erhverv" class="view-pane">
      <div class="section-banner-header">
        <span class="section-banner-kicker">SEKTIONSOVERBLIK</span>
        <h1 class="section-banner-title">Erhverv & Handel i Slagelse</h1>
        <p class="section-banner-desc">
          Virksomheder, detailhandel, iværksættere og arbejdspladser i Slagelse, Korsør og Skælskør.
        </p>
      </div>

      <div class="site-middle-3cards-grid">
        <article class="site-middle-card" onclick="navigateArticle('butik')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_erhverv" alt="Butik på Schweizerpladsen">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">DETAILHANDEL</span>
            <h3 class="site-middle-card-title">Ny grøn butikskæde åbner på Schweizerpladsen</h3>
            <p class="site-middle-card-desc">Det tomme hjørnelokale får nyt liv til marts med fokus på genanvendelse og lokalt kunsthåndværk.</p>
            <div class="site-middle-card-meta"><span>Slagelse C</span><span>I dag</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('byraad')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_bymidte" alt="Erhvervsnetværk i Slagelse">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">INFRASTRUKTUR</span>
            <h3 class="site-middle-card-title">Erhvervspark ved E20 udvides med 25.000 kvm logistik</h3>
            <p class="site-middle-card-desc">Slagelse Kommune oplever stor efterspørgsel på erhvervsjord tæt ved motorvejsafkørsel 39.</p>
            <div class="site-middle-card-meta"><span>Erhverv</span><span>2 dage siden</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('sommerhuse')">
          <div class="site-middle-card-thumb">
            <img data-img="skaelskoer_sommerhus" alt="Turisme i Skælskør">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">TURISME & GÆSTER</span>
            <h3 class="site-middle-card-title">Rekordsommer i vente for kystturismen i Skælskør</h3>
            <p class="site-middle-card-desc">Sommerhusudlejere og lokale restauratører melder om tæt på fuld booking til højsæsonen.</p>
            <div class="site-middle-card-meta"><span>Turisme</span><span>3 dage siden</span></div>
          </div>
        </article>
      </div>

      <div class="site-community-banner" style="background:linear-gradient(135deg, #1E293B 0%, #334155 100%);">
        <div>
          <span class="site-community-kicker" style="color:#93C5FD;">ERHVERVSSTØTTE</span>
          <h3 class="site-community-title">Vil din virksomhed bakke op om lokaljournalistikken?</h3>
          <p class="site-community-desc">Som erhvervspartner styrker I det lokale demokrati og oplysning i kommunen.</p>
        </div>
        <a onclick="navigate('stoet')" class="site-community-btn-main">Se partnerskabsaftaler →</a>
      </div>
    </div><!-- /view-erhverv -->


    <!-- ========================================== -->
    <!-- VIEW: SPORT                                -->
    <!-- ========================================== -->
    <div id="view-sport" class="view-pane">
      <div class="section-banner-header">
        <span class="section-banner-kicker">SEKTIONSOVERBLIK</span>
        <h1 class="section-banner-title">Lokalsporten i Slagelse Kommune</h1>
        <p class="section-banner-desc">
          Fodbold, håndbold, svømning, atletik og breddeidræt. Følg de lokale hold og klubber.
        </p>
      </div>

      <div class="site-middle-3cards-grid">
        <article class="site-middle-card" onclick="navigateArticle('sport')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_fodbold" alt="Slagelse B&I fodboldhold">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">FODBOLD · HARBOE ARENA</span>
            <h3 class="site-middle-card-title">Slagelse B&I tager vigtig overtidssejr på hjemmebane</h3>
            <p class="site-middle-card-desc">En scoring i de absolut døende minutter sikrede holdet en 2-1 sejr og fastholder pladsen i toppen af tabellen.</p>
            <div class="site-middle-card-meta"><span>1.100 tilskuere</span><span>1 t. siden</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('foreningsliv')">
          <div class="site-middle-card-thumb">
            <img data-img="tude_aa_natur" alt="Løbeklub i Slagelse Lystskov">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">BREVDEIDRÆT</span>
            <h3 class="site-middle-card-title">Slagelse Løbeklub indbyder til årets store forårsløb</h3>
            <p class="site-middle-card-desc">Ruter på både 5 km, 10 km og halvmaraton gennem Slagelse Lystskov med over 400 tilmeldte deltagere.</p>
            <div class="site-middle-card-meta"><span>Motion</span><span>I går</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('byraad')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_bymidte" alt="Korsør Svømmehal">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">SVØMNING & HALLEJERE</span>
            <h3 class="site-middle-card-title">Korsør Svømmeklub sætter klubrekord ved Sjællandske Mesterskaber</h3>
            <p class="site-middle-card-desc">Fire guldmedaljer og masser af personlige rekorder til de unge talenter fra Korsør.</p>
            <div class="site-middle-card-meta"><span>Svømning</span><span>3 dage siden</span></div>
          </div>
        </article>
      </div>
    </div><!-- /view-sport -->


    <!-- ========================================== -->
    <!-- VIEW: KULTUR                               -->
    <!-- ========================================== -->
    <div id="view-kultur" class="view-pane">
      <div class="section-banner-header">
        <span class="section-banner-kicker">SEKTIONSOVERBLIK</span>
        <h1 class="section-banner-title">Kultur & Oplevelser</h1>
        <p class="section-banner-desc">
          Koncerter, teater, udstillinger, biblioteker og historiske steder i hele Slagelse Kommune.
        </p>
      </div>

      <div class="site-middle-3cards-grid">
        <article class="site-middle-card" onclick="navigateArticle('kultur')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_bymidte" alt="Musikhuset Slagelse">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">MUSIK & TEATER</span>
            <h3 class="site-middle-card-title">Musikhuset Slagelse løfter sløret for et stærkt forårsprogram</h3>
            <p class="site-middle-card-desc">Store navne inden for pop, jazz og stand-up gæster scenen på Badeanstalten og Musikhuset.</p>
            <div class="site-middle-card-meta"><span>Musikhuset</span><span>I dag</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('sommerhuse')">
          <div class="site-middle-card-thumb">
            <img data-img="skaelskoer_sommerhus" alt="Borreby Teater og Herreborg">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">HISTORIE & TEATER</span>
            <h3 class="site-middle-card-title">Borreby Herreborg åbner historiske sale for offentligheden</h3>
            <p class="site-middle-card-desc">Nyt samarbejde med lokale guider skal vise Skælskørs unikke renæssance-arv frem.</p>
            <div class="site-middle-card-meta"><span>Skælskør</span><span>2 dage siden</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('foreningsliv')">
          <div class="site-middle-card-thumb">
            <img data-img="debat_skriver" alt="Børnekulturfestival">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">BØRN & FAMILIE</span>
            <h3 class="site-middle-card-title">Gratis workshops på bibliotekerne i vinterferien</h3>
            <p class="site-middle-card-desc">Kreative værksteder, kodning for børn og højtlæsning i både Slagelse, Korsør og Skælskør.</p>
            <div class="site-middle-card-meta"><span>Bibliotek</span><span>3 dage siden</span></div>
          </div>
        </article>
      </div>
    </div><!-- /view-kultur -->


    <!-- ========================================== -->
    <!-- VIEW: FORENINGSLIV                         -->
    <!-- ========================================== -->
    <div id="view-foreningsliv" class="view-pane">
      <div class="section-banner-header">
        <span class="section-banner-kicker">SEKTIONSOVERBLIK</span>
        <h1 class="section-banner-title">Foreningsliv & Frivillighed</h1>
        <p class="section-banner-desc">
          Menneskene, der driver vores lokalsamfund. Klubber, spejdere, ældreforeninger og nabolagsinitiativer.
        </p>
      </div>

      <div class="site-middle-3cards-grid">
        <article class="site-middle-card" onclick="navigateArticle('foreningsliv')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_bymidte" alt="Foreningsfest i Korsør">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">FRIVILLIGHED</span>
            <h3 class="site-middle-card-title">120 frivillige hædret ved årets foreningsfest i Korsør</h3>
            <p class="site-middle-card-desc">Borgmesteren overrakte priser til de ildsjæle, der hver uge skaber fællesskab for tusindvis af borgere.</p>
            <div class="site-middle-card-meta"><span>Korsør Kulturhus</span><span>I går</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('tudeaa')">
          <div class="site-middle-card-thumb">
            <img data-img="tude_aa_natur" alt="Frivillig naturpleje">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">BORGERINITIATIV</span>
            <h3 class="site-middle-card-title">Naturvennerne samler 300 kg affald langs Tude Å</h3>
            <p class="site-middle-card-desc">Lokale familier og lystfiskere ryddede stierne og sluttede af med fællesspisning og bålkaffe.</p>
            <div class="site-middle-card-meta"><span>Tude Å</span><span>Søndag</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('debat')">
          <div class="site-middle-card-thumb">
            <img data-img="debat_skriver" alt="Frivilligcenter Slagelse">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">REKRUTTERING</span>
            <h3 class="site-middle-card-title">Frivilligcenter Slagelse søger nye lektiehjælpere</h3>
            <p class="site-middle-card-desc">Har du 2 timer om ugen til at hjælpe unge videre med deres uddannelse? Centret inviterer til infomøde.</p>
            <div class="site-middle-card-meta"><span>Slagelse C</span><span>4 dage siden</span></div>
          </div>
        </article>
      </div>

      <div class="site-community-banner">
        <div>
          <span class="site-community-kicker">DEL JERES AKTIVITET</span>
          <h3 class="site-community-title">Har din forening en god historie eller et arrangement?</h3>
          <p class="site-community-desc">Vi bringer gerne omtale af jeres initiativer, generalforsamlinger og jubilæer.</p>
        </div>
        <a onclick="navigate('indsend')" class="site-community-btn-main">Indsend omtale gratis →</a>
      </div>
    </div><!-- /view-foreningsliv -->


    <!-- ========================================== -->
    <!-- VIEW: DEBAT                                -->
    <!-- ========================================== -->
    <div id="view-debat" class="view-pane">
      <div class="section-banner-header">
        <span class="section-banner-kicker">SEKTIONSOVERBLIK</span>
        <h1 class="section-banner-title">Debat & Holdninger</h1>
        <p class="section-banner-desc">
          Ordet er frit. Læs indlæg fra borgere, lokalpolitikere og erhvervsfolk – eller deltag selv i den lokale samtale.
        </p>
      </div>

      <div class="site-middle-3cards-grid">
        <article class="site-middle-card" onclick="navigateArticle('debat')">
          <div class="site-middle-card-thumb">
            <img data-img="debat_skriver" alt="Lise Holm skriver debatindlæg">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">BORGERINDLÆG · KORSØR</span>
            <h3 class="site-middle-card-title">"Vi må og skal bevare de grønne åndehuller i kommunen"</h3>
            <p class="site-middle-card-desc">Lise Holm advarer mod for tæt bebyggelse ved havnearealerne. Vi har brug for lys og luft.</p>
            <div class="site-middle-card-meta"><span>Af Lise Holm</span><span>5 t. siden</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('byraad')">
          <div class="site-middle-card-thumb">
            <img data-img="slagelse_bymidte" alt="Debat om bymidten">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">POLITISK REPLIK</span>
            <h3 class="site-middle-card-title">"Investeringen på 45 mio. kr. er nødvendig for butikkerne"</h3>
            <p class="site-middle-card-desc">Byrådsmedlem Morten Nielsen forklarer, hvorfor pengene til renovering er givet godt ud.</p>
            <div class="site-middle-card-meta"><span>Af Morten Nielsen (V)</span><span>I går</span></div>
          </div>
        </article>

        <article class="site-middle-card" onclick="navigateArticle('storebaelt')">
          <div class="site-middle-card-thumb">
            <img data-img="storebaelt_hero" alt="Debat om Storebæltstakster">
          </div>
          <div class="site-middle-card-body">
            <span class="site-middle-card-kicker">PENDLERDEBAT</span>
            <h3 class="site-middle-card-title">"Pendlere over Storebælt overses i transportplanerne"</h3>
            <p class="site-middle-card-desc">Indlæg fra en vestsjællandsk pendler, der efterlyser mere fleksible togafgange og rimeligere bropriser.</p>
            <div class="site-middle-card-meta"><span>Af Søren K. Møller</span><span>2 dage siden</span></div>
          </div>
        </article>
      </div>

      <div class="site-community-banner">
        <div>
          <span class="site-community-kicker">SKRIV TIL SLAGELSELOKALT</span>
          <h3 class="site-community-title">Har du noget på hjerte om vores kommune?</h3>
          <p class="site-community-desc">Alle borgere, foreninger og erhvervsdrivende kan skrive et debatindlæg. Vi læser alle indsendelser.</p>
        </div>
        <a onclick="navigate('indsend')" class="site-community-btn-main">Send dit debatindlæg →</a>
      </div>
    </div><!-- /view-debat -->


    <!-- ========================================== -->
    <!-- VIEW: STØT (DUAL SUPPORT MODEL)            -->
    <!-- ========================================== -->
    <div id="view-stoet" class="view-pane">
      <div class="support-card-container">
        <div style="text-align:center; max-width:640px; margin:0 auto 32px auto;">
          <span class="section-banner-kicker">FÆLLESSKAB & STØTTE</span>
          <h1 style="font-family:var(--font-display); font-size:36px; font-weight:800; letter-spacing:-0.025em; margin-bottom:12px;">
            Støt SlagelseLokalt
          </h1>
          <p style="font-size:16px; color:var(--ink-2); line-height:1.6;">
            SlagelseLokalt er et borgerdrevet lokalmedie. Vi formes og finansieres af borgerne og erhvervslivet i Slagelse Kommune. Vælg mellem en fast støttepakke eller støt med et valgfrit beløb efter eget ønske.
          </p>
        </div>

        <!-- Mode Toggle -->
        <div class="support-mode-toggle">
          <div onclick="setSupportMode('fast')" id="tab-support-fast" class="support-toggle-btn is-active">
            Fast støttepakke
          </div>
          <div onclick="setSupportMode('valgfri')" id="tab-support-valgfri" class="support-toggle-btn">
            Valgfrit beløb (engang eller md.)
          </div>
        </div>

        <!-- PANE 1: FAST STØTTEPAKKE -->
        <div id="support-mode-fast">
          <div class="support-plans-grid">
            <div onclick="selectPlan('Støtte', 49, this)" class="support-plan-card is-selected">
              <span class="support-plan-name">Støtte</span>
              <div class="support-plan-price">49 kr. <span>/ måned</span></div>
              <ul class="support-plan-features">
                <li>✓ Fri adgang til alt indhold</li>
                <li>✓ Ugentligt nyhedsbrev i din indbakke</li>
                <li>✓ Du holder journalistikken åben for alle</li>
              </ul>
              <div style="font-size:12px; font-weight:700; color:var(--site-accent); text-align:center;">Valgt pakke</div>
            </div>

            <div onclick="selectPlan('Plus', 79, this)" class="support-plan-card">
              <span class="support-plan-name">Plus</span>
              <div class="support-plan-price">79 kr. <span>/ måned</span></div>
              <ul class="support-plan-features">
                <li>✓ Alt i Støtte</li>
                <li>✓ Invitation til årlige redaktionsmøder</li>
                <li>✓ Direkte dialog med redaktionen om emner</li>
              </ul>
              <div style="font-size:12px; font-weight:700; color:var(--ink-3); text-align:center;">Populært valg</div>
            </div>

            <div onclick="selectPlan('Lokal Helt', 129, this)" class="support-plan-card">
              <span class="support-plan-name">Lokal Helt</span>
              <div class="support-plan-price">129 kr. <span>/ måned</span></div>
              <ul class="support-plan-features">
                <li>✓ Alt i Plus</li>
                <li>✓ Nævnelse som supporter (valgfrit)</li>
                <li>✓ Stærk opbakning til dybdegående temaer</li>
              </ul>
              <div style="font-size:12px; font-weight:700; color:var(--ink-3); text-align:center;">Ekstra opbakning</div>
            </div>
          </div>
        </div>

        <!-- PANE 2: VALGFRIT BELØB -->
        <div id="support-mode-valgfri" style="display:none;">
          <div style="margin-bottom:20px;">
            <label class="form-label">Hvor ofte vil du støtte?</label>
            <div style="display:flex; gap:10px;">
              <button onclick="setCustomFreq('monthly')" id="btn-freq-monthly" class="support-toggle-btn is-active" style="flex:1; border:1px solid var(--line);">
                Månedligt bidrag
              </button>
              <button onclick="setCustomFreq('once')" id="btn-freq-once" class="support-toggle-btn" style="flex:1; border:1px solid var(--line);">
                Engangsbeløb
              </button>
            </div>
          </div>

          <label class="form-label">Vælg beløb</label>
          <div class="custom-amt-grid">
            <button onclick="setCustomAmt(25)" class="custom-amt-btn">25 kr.</button>
            <button onclick="setCustomAmt(50)" class="custom-amt-btn is-active">50 kr.</button>
            <button onclick="setCustomAmt(100)" class="custom-amt-btn">100 kr.</button>
            <button onclick="setCustomAmt(250)" class="custom-amt-btn">250 kr.</button>
            <button onclick="setCustomAmt(500)" class="custom-amt-btn">500 kr.</button>
          </div>

          <div class="form-group">
            <label class="form-label">Eller indtast et helt eget beløb (kr.)</label>
            <input type="number" id="input-custom-amount" value="50" oninput="customInputChanged(this.value)" class="form-control" style="font-size:18px; font-weight:700;" min="10" step="5">
          </div>
        </div>

        <!-- BETALING & AFSLUTNING -->
        <div style="padding-top:24px; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; gap:12px; justify-content:center; align-items:center; font-size:13px; color:var(--ink-3);">
            <span>Betal nemt med:</span>
            <strong style="color:var(--ink);">MobilePay</strong> · <strong style="color:var(--ink);">Dankort / Visa / Mastercard</strong>
          </div>

          <button onclick="submitSupport()" id="btn-submit-support" class="site-header-btn-accent" style="width:100%; justify-content:center; padding:15px; font-size:16px; border-radius:var(--radius-md);">
            Støt med Støtte (49 kr. / md)
          </button>
          
          <div style="font-size:12px; color:var(--ink-3); text-align:center; line-height:1.5;">
            Ingen binding. Du kan ændre eller opsige dit bidrag når som helst med ét klik. Alle bidrag går ubeskåret til lokal dækning i Slagelse Kommune.
          </div>
        </div>
      </div>
    </div><!-- /view-stoet -->


    <!-- ========================================== -->
    <!-- VIEW: INDSEND HISTORIE                     -->
    <!-- ========================================== -->
    <div id="view-indsend" class="view-pane">
      <div class="submit-form-container">
        <div style="margin-bottom:28px;">
          <span class="section-banner-kicker">BORGERJOURNALISTIK</span>
          <h1 style="font-family:var(--font-display); font-size:32px; font-weight:800; letter-spacing:-0.025em; margin-bottom:8px;">
            Indsend historie eller tip redaktionen
          </h1>
          <p style="font-size:15px; color:var(--ink-2); line-height:1.5;">
            Har du set noget i trafikken, oplevet en god begivenhed i din forening eller vil du tippe os om en lokal sag? Udfyld felterne herunder.
          </p>
        </div>

        <form onsubmit="event.preventDefault(); submitTip();">
          <div class="form-group">
            <label class="form-label">Hvad handler din henvendelse om? *</label>
            <select class="form-control" id="tip-category" required>
              <option value="nyhed">Nyhed eller tip til historier</option>
              <option value="foreningsliv">Foreningsliv & arrangement</option>
              <option value="debat">Debatindlæg til avisen</option>
              <option value="erhverv">Erhvervsnyt eller butiksåbning</option>
              <option value="kultur">Kultur eller udstilling</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Overskrift / Kort resume *</label>
            <input type="text" class="form-control" id="tip-title" placeholder="F.eks. Frivillige søges til forårsmesse i Korsør" required>
          </div>

          <div class="form-group">
            <label class="form-label">Beskrivelse / Din historie *</label>
            <textarea class="form-control" id="tip-body" rows="6" placeholder="Fortæl os hvad der er sket, hvem der var med, tidspunkt og sted..." required></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Billeder eller dokumenter</label>
            <div class="form-dropzone" onclick="alert('Billedvælger: Du kan vedhæfte fotos direkte fra din telefon eller computer.')">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin:0 auto 8px auto; color:var(--ink-3);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              <div style="font-size:14px; font-weight:600; color:var(--ink);">Træk filer herover eller klik for at vælge</div>
              <div style="font-size:12px; color:var(--ink-3);">JPG, PNG eller PDF op til 25 MB</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr; gap:14px; margin-bottom:24px;">
            <div>
              <label class="form-label">Dit navn *</label>
              <input type="text" class="form-control" id="tip-author" placeholder="F.eks. Peter Hansen" required>
            </div>
            <div>
              <label class="form-label">Din e-mail eller telefonnummer *</label>
              <input type="text" class="form-control" id="tip-contact" placeholder="peter@example.dk / 20 30 40 50" required>
            </div>
          </div>

          <button type="submit" class="site-header-btn-accent" style="width:100%; justify-content:center; padding:14px; font-size:15px; border-radius:var(--radius-md);">
            Send indsendelse til redaktionen
          </button>
        </form>
      </div>
    </div><!-- /view-indsend -->


    <!-- ========================================== -->
    <!-- VIEW: SØG                                  -->
    <!-- ========================================== -->
    <div id="view-soeg" class="view-pane">
      <div class="search-view-container">
        <span class="section-banner-kicker">ARKIV & OVERBLIK</span>
        <h1 style="font-family:var(--font-display); font-size:32px; font-weight:800; letter-spacing:-0.025em; margin-bottom:16px;">
          Søg i SlagelseLokalt
        </h1>

        <div class="search-input-wrapper">
          <svg class="search-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="main-search-input" oninput="runLiveSearch(this.value)" placeholder="Søg efter Storebælt, byråd, erhverv, fodbold, Skælskør..." class="search-input-field">
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px;">
          <span style="font-size:12.5px; font-weight:700; color:var(--ink-3); align-self:center;">Hurtigfilter:</span>
          <button onclick="setSearchFilter('Storebælt')" class="section-filter-pill">Storebælt</button>
          <button onclick="setSearchFilter('Byråd')" class="section-filter-pill">Byråd & Økonomi</button>
          <button onclick="setSearchFilter('Skælskør')" class="section-filter-pill">Skælskør</button>
          <button onclick="setSearchFilter('Erhverv')" class="section-filter-pill">Erhverv</button>
          <button onclick="setSearchFilter('Sport')" class="section-filter-pill">Sport</button>
        </div>

        <div id="search-results-box" class="search-results-list">
          <!-- Live filled by JavaScript -->
        </div>
      </div>
    </div><!-- /view-soeg -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: STOREBÆLT                  -->
    <!-- ========================================== -->
    <div id="view-artikel-storebaelt" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('nyheder')" class="article-back-nav">← Tilbage til Nyheder</a>
        <span class="article-kicker-badge">TRAFIK · STOREBÆLT · KORSØR</span>
        <h1 class="article-heading">Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld</h1>
        <p class="article-lead">
          Et trafikuheld med to personbiler spærrer mandag formiddag det ene spor i retning mod Fyn. Politiet og redningsmandskab er på stedet, og trafikanter opfordres til at vise hensyn og beregne ekstra køretid.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">JV</div>
            <div>
              <strong>Jonas Vestergaard</strong> · Lokaljournalist i Korsør & Slagelse
            </div>
          </div>
          <div>Publiceret: Mandag kl. 09:14 · Læsetid: 3 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="storebaelt_hero" alt="Storebæltsbroen">
          <figcaption class="article-caption">Storebæltsforbindelsen forbinder Vestsjælland og Fyn. Foto: SlagelseLokalt</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Vagtchefen ved Sydsjællands og Lolland-Falsters Politi oplyser, at uheldet skete omkring klokken 08.45 lige før højbroen i vestgående retning. Der er tale om et harmonikasammenstød, hvor to biler ramte hinanden under tæt morgentrafik.
          </p>
          <p>
            Ingen personer er kommet alvorligt til skade, men vragdele og en olielækage har gjort det nødvendigt midlertidigt at lukke det højre spor, mens Falck og Vejdirektoratets bjærgningskøretøjer arbejder på at rydde kørebanen.
          </p>

          <blockquote class="article-pullquote">
            "Vi forventer, at oprydningsarbejdet er afsluttet før middag, men køen strækker sig i øjeblikket flere kilometer tilbage mod Korsør."
          </blockquote>

          <div class="article-faktaboks">
            <div class="article-faktaboks-title">Faktaboks: Trafikken på Storebælt</div>
            <ul>
              <li>Gennemsnitlig døgntrafik: Ca. 36.000 køretøjer passerer broen i døgnet.</li>
              <li>Aktuel status: 1 spor farbart mod Vest (Fyn). Hastighedsbegrænsning på 50 km/t ved uheldsstedet.</li>
              <li>Anbefaling: Følg den aktuelle trafiksituation på Sund & Bælt eller P4 Trafik.</li>
            </ul>
          </div>

          <p>
            Trafikanter, der kommer fra Slagelse og videre af motorvej E20, opfordres til at køre fra ved afkørsel 43 Korsør, hvis de ønsker at holde pause inden brooverkørslen.
          </p>
        </div>

        <div class="article-share-row">
          <span style="font-weight:700; font-size:13px;">Del artiklen:</span>
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="alert('Del på Facebook/X')" class="article-share-btn">Del på sociale medier</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-storebaelt -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: BYRÅDET                    -->
    <!-- ========================================== -->
    <div id="view-artikel-byraad" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('forside')" class="article-back-nav">← Tilbage til Forsiden</a>
        <span class="article-kicker-badge">POLITIK & BYUDVIKLING</span>
        <h1 class="article-heading">Nyt flertal på rådhuset vil investere 45 millioner i bymidten</h1>
        <p class="article-lead">
          Slagelse Byråd har vedtaget en stor fornyelsespakke, der skal revitalisere gågaderne, give plads til grønne opholdsrum og støtte de lokale handelsdrivende mod butiksdød.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">TB</div>
            <div>
              <strong>Thomas Bach</strong> · Rådhusreporter
            </div>
          </div>
          <div>Publiceret: I dag kl. 08:12 · Læsetid: 4 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="slagelse_bymidte" alt="Slagelse bymidte og rådhus">
          <figcaption class="article-caption">Slagelse rådhus og bymidte forbereder sig på en massiv fornyelse. Foto: SlagelseLokalt</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Efter måneders forhandlinger og høringer blandt borgere og handelsstanden i Slagelse Kommune er aftalen nu på plads. En investering på 45 millioner kroner over de næste tre år skal vende udviklingen i bymidten.
          </p>
          <p>
            Blandt hovedpunkterne i aftalen er en gennemgribende modernisering af belægningen på Nytorv, etablering af nye grønne byhaver med siddepladser samt bedre belysning, der skal øge trygheden i de mørke timer.
          </p>
          <blockquote class="article-pullquote">
            "Vi vil have en levende by, hvor folk har lyst til at opholde sig og handle lokalt – ikke bare haste igennem."
          </blockquote>
          <p>
            Handelsstandsforeningen Business Slagelse har rost aftalen for at tage fat om de reelle udfordringer: parkeringsvilkår og attraktive byrum for både unge og ældre.
          </p>
        </div>

        <div class="article-share-row">
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="navigate('debat')" class="article-share-btn">Læs debat om sagen →</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-byraad -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: SOMMERHUSE                 -->
    <!-- ========================================== -->
    <div id="view-artikel-sommerhuse" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('nyheder')" class="article-back-nav">← Tilbage til Nyheder</a>
        <span class="article-kicker-badge">KRIMI & TRYGHED · SKÆLSKØR</span>
        <h1 class="article-heading">Flere sommerhuse udsat for indbrud ved Skælskør Næs</h1>
        <p class="article-lead">
          Politiet efterlyser vidner efter mindst fire sommerhuse i weekenden fik opbrudt terrassedøre. Beboere rådes til at sikre værdigenstande og holde øje med mistænkelige biler.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">ML</div>
            <div>
              <strong>Mette Lindegaard</strong> · Krimijournalist
            </div>
          </div>
          <div>Publiceret: I dag kl. 07:48 · Læsetid: 3 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="skaelskoer_sommerhus" alt="Sommerhusområde ved Skælskør Næs">
          <figcaption class="article-caption">Kystområdet ved Skælskør Næs og Kobæk Strand. Foto: SlagelseLokalt</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Tyvene er gået efter designmøbler, værktøj og musikanlæg. Ifølge lokalpolitiet tyder fremgangsmåden på professionelle gerningsmænd, der har udnyttet de stille vintermåneder, hvor mange sommerhuse står ubeboede.
          </p>
          <p>
            Formanden for den lokale grundejerforening opfordrer nu til oprettelse af Nabohjælp og mere koordineret patruljering blandt de fastboende i området.
          </p>
        </div>

        <div class="article-share-row">
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="navigate('indsend')" class="article-share-btn">Tip politiet / redaktionen</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-sommerhuse -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: BUTIK / ERHVERV            -->
    <!-- ========================================== -->
    <div id="view-artikel-butik" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('erhverv')" class="article-back-nav">← Tilbage til Erhverv</a>
        <span class="article-kicker-badge">ERHVERV & HANDEL · SCHWEIZERPLADSEN</span>
        <h1 class="article-heading">Ny grøn butikskæde åbner på Schweizerpladsen til foråret</h1>
        <p class="article-lead">
          En nyskabende livsstils- og detailforretning med fokus på upcycling, lokalt håndværk og bæredygtigt design overtager lokalerne på Schweizerpladsen.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">HF</div>
            <div>
              <strong>Henrik Friis</strong> · Erhvervsjournalist
            </div>
          </div>
          <div>Publiceret: I dag kl. 06:32 · Læsetid: 3 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="slagelse_erhverv" alt="Butiksmiljø i Slagelse">
          <figcaption class="article-caption">Schweizerpladsen og handelslivet i hjertet af Slagelse. Foto: SlagelseLokalt</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Det er iværksætterne bag konceptet "Grønt Vestsjælland", der har valgt Slagelse som deres næste lokation efter succesfulde etableringer i andre sjællandske købstæder.
          </p>
          <p>
            Butikken vil desuden rumme en lille kaffebar, hvor gæster kan mødes og deltage i kreative workshops med lokale kunsthåndværkere fra Skælskør og Korsør.
          </p>
        </div>

        <div class="article-share-row">
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="navigate('erhverv')" class="article-share-btn">Se mere erhverv</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-butik -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: SPORT                      -->
    <!-- ========================================== -->
    <div id="view-artikel-sport" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('sport')" class="article-back-nav">← Tilbage til Sport</a>
        <span class="article-kicker-badge">LOKALSPORT · HARBOE ARENA</span>
        <h1 class="article-heading">Slagelse B&I henter dramatisk overtidssejr på Harboe Arena</h1>
        <p class="article-lead">
          Et pragtmål i det 93. spilleminut udløste jubelbrøl foran 1.100 tilskuere, da Slagelse B&I sikrede tre livsvigtige point i topstriden.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">MS</div>
            <div>
              <strong>Martin Simonsen</strong> · Sportsreporter
            </div>
          </div>
          <div>Publiceret: I går kl. 22:15 · Læsetid: 3 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="slagelse_fodbold" alt="Slagelse B&I jubel">
          <figcaption class="article-caption">Hjemmeholdet fejrer den sene scoring foran tribunen. Foto: SlagelseLokalt</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Kampen bølgede frem og tilbage, og gæsterne udlignede til 1-1 midtvejs i anden halvleg på et straffespark. Men Slagelse-mandskabet gav aldrig op og pressede hårdt i slutfasen.
          </p>
          <p>
            Træneren roste holdets moral og den fantastiske opbakning fra tribunen: "Når publikum står bag os på den måde, giver det ekstra ti procent i benene til det sidste fløjt."
          </p>
        </div>

        <div class="article-share-row">
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="navigate('sport')" class="article-share-btn">Se stilling og kampe</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-sport -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: TUDE Å NATUR               -->
    <!-- ========================================== -->
    <div id="view-artikel-tudeaa" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('nyheder')" class="article-back-nav">← Tilbage til Nyheder</a>
        <span class="article-kicker-badge">NATUR & MILJØ · TUDE Å</span>
        <h1 class="article-heading">Nyt vådområdeprojekt ved Tude Å beskytter mod oversvømmelser</h1>
        <p class="article-lead">
          Et historisk samarbejde mellem Slagelse Kommune, Naturstyrelsen og 14 lodsejere genslynger åen og etablerer 140 hektar vådområde.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">AL</div>
            <div>
              <strong>Astrid Lorentzen</strong> · Miljø- og naturjournalist
            </div>
          </div>
          <div>Publiceret: I går kl. 16:30 · Læsetid: 4 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="tude_aa_natur" alt="Tude Å landskab">
          <figcaption class="article-caption">Det naturskønne åløb ved Tude Å genslynges til gavn for fugle og fisk. Foto: SlagelseLokalt</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Vådområdeprojektet vil fjerne over 12 tons kvælstof årligt fra Storebælt og Tude Å-systemet, samtidig med at området fungerer som en naturlig svamp under skybrud.
          </p>
          <p>
            Lokale stier og fugletårne bliver også en del af projektet, så borgere og skoleklasser kan opleve naturen på nærmeste hold.
          </p>
        </div>

        <div class="article-share-row">
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-tudeaa -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: DEBAT                      -->
    <!-- ========================================== -->
    <div id="view-artikel-debat" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('debat')" class="article-back-nav">← Tilbage til Debat</a>
        <span class="article-kicker-badge">DEBATINDLÆG · BORGERSTEMME</span>
        <h1 class="article-heading">"Vi må og skal bevare de grønne åndehuller i Slagelse Kommune"</h1>
        <p class="article-lead">
          Debatindlæg af Lise Holm, borger i Korsør: Hvorfor vi ikke må ofre byens grønne oaser til fordel for hurtige parkeringspladser eller betonbyggeri.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">LH</div>
            <div>
              <strong>Lise Holm</strong> · Debattør og borger i Korsør
            </div>
          </div>
          <div>Publiceret: I dag kl. 10:00 · Læsetid: 3 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="debat_skriver" alt="Borger skriver debatindlæg">
          <figcaption class="article-caption">Lise Holm ved skrivebordet. Foto: Privat</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Kære byråd og kære medborgere. Hver dag går jeg tur langs havnen og gennem anlægget. Det slår mig igen og igen, hvor uvurderlige disse grønne pletter er for vores trivsel, ro og sundhed.
          </p>
          <p>
            Når vi planlægger for fremtidens Slagelse Kommune, må målet ikke kun være mursten og tal i et regneark. Vi må investere i livskvalitet, som også vores børn og børnebørn kan nyde godt af.
          </p>
        </div>

        <div class="article-share-row">
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="navigate('indsend')" class="article-share-btn">Skriv et svarindlæg</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-debat -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: FORENINGSLIV               -->
    <!-- ========================================== -->
    <div id="view-artikel-foreningsliv" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('foreningsliv')" class="article-back-nav">← Tilbage til Foreningsliv</a>
        <span class="article-kicker-badge">FÆLLESSKAB & FRIVILLIGHED</span>
        <h1 class="article-heading">120 frivillige hædret ved årets foreningsfest i Korsør</h1>
        <p class="article-lead">
          Ildsjæle fra idrætsklubber, spejdergrupper, Røde Kors og lokale nabolagsnetværk blev hyldet i går aftes for deres uundværlige indsats for fællesskabet.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">SL</div>
            <div>
              <strong>Sara Lund</strong> · Foreningsreporter
            </div>
          </div>
          <div>Publiceret: I går kl. 19:40 · Læsetid: 3 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="slagelse_bymidte" alt="Fest i Korsør Kulturhus">
          <figcaption class="article-caption">Foreningsfest i Korsør Kulturhus. Foto: SlagelseLokalt</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Stemningen var høj, da årets foreningspris blev uddelt. Borgmesteren fremhævede, at Slagelse Kommune har et af Sjællands mest aktive foreningsliv med over 350 registrerede foreninger.
          </p>
        </div>

        <div class="article-share-row">
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="navigate('foreningsliv')" class="article-share-btn">Gå til Foreningsliv</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-foreningsliv -->


    <!-- ========================================== -->
    <!-- ARTIKELVISNING: KULTUR                     -->
    <!-- ========================================== -->
    <div id="view-artikel-kultur" class="view-pane">
      <article class="article-detail-container">
        <a onclick="navigate('kultur')" class="article-back-nav">← Tilbage til Kultur</a>
        <span class="article-kicker-badge">KULTUR & OPLEVELSER</span>
        <h1 class="article-heading">Musikhuset Slagelse løfter sløret for et stærkt forårsprogram</h1>
        <p class="article-lead">
          Fra akustiske koncerter på Badeanstalten til store teateropsætninger og stand-up comedy i Musikhuset.
        </p>
        <div class="article-byline-bar">
          <div class="article-author-info">
            <div class="article-author-avatar">CK</div>
            <div>
              <strong>Camilla Krogh</strong> · Kulturjournalist
            </div>
          </div>
          <div>Publiceret: I dag kl. 11:00 · Læsetid: 3 min.</div>
        </div>

        <figure class="article-hero-figure">
          <img data-img="slagelse_bymidte" alt="Musikhuset">
          <figcaption class="article-caption">Kulturlivet i Slagelse glæder sig til et tætpakket forår. Foto: SlagelseLokalt</figcaption>
        </figure>

        <div class="article-prose">
          <p>
            Lederen af Musikhuset udtaler, at billetsalget allerede går over al forventning. "Vi mærker en enorm lyst til at komme ud og opleve kultur sammen med andre her i lokalområdet."
          </p>
        </div>

        <div class="article-share-row">
          <button onclick="copyCurrentLink()" class="article-share-btn">📋 Kopier link</button>
          <button onclick="navigate('kultur')" class="article-share-btn">Gå til Kultur</button>
          <button onclick="navigate('forside')" class="article-share-btn" style="margin-left:auto;">Gå til Forsiden</button>
        </div>
      </article>
    </div><!-- /view-artikel-kultur -->

  </main>

  <!-- 5. FOOTER -->
  <footer class="site-footer">
    <div class="site-container">
      <div class="site-footer-grid">
        <div>
          <div class="site-footer-brand">Slagelse<span>Lokalt</span></div>
          <p class="site-footer-text">
            Lokaljournalistik, der sætter fællesskabet først. Skabt i tæt dialog med borgere og lokalt erhvervsliv i Slagelse Kommune.
          </p>
          <div style="font-size:13px; color:#CBD5E1;">
            📍 Nytorv 8, 4200 Slagelse<br>
            ✉️ redaktion@slagelselokalt.dk<br>
            📞 58 12 34 56
          </div>
        </div>

        <div>
          <div class="site-footer-col-title">Sektioner</div>
          <ul class="site-footer-links">
            <li><a onclick="navigate('forside')">Forside</a></li>
            <li><a onclick="navigate('nyheder')">Nyheder</a></li>
            <li><a onclick="navigate('erhverv')">Erhverv</a></li>
            <li><a onclick="navigate('sport')">Sport</a></li>
            <li><a onclick="navigate('kultur')">Kultur</a></li>
            <li><a onclick="navigate('foreningsliv')">Foreningsliv</a></li>
            <li><a onclick="navigate('debat')">Debat</a></li>
          </ul>
        </div>

        <div>
          <div class="site-footer-col-title">Områder</div>
          <ul class="site-footer-links">
            <li><a onclick="filterNabolag('Slagelse C')">Slagelse by & centrum</a></li>
            <li><a onclick="filterNabolag('Korsør')">Korsør & Halsskov</a></li>
            <li><a onclick="filterNabolag('Skælskør')">Skælskør & Agersø/Omø</a></li>
            <li><a onclick="filterNabolag('Dalmose')">Dalmose & Flakkebjerg</a></li>
            <li><a onclick="filterNabolag('Vemmelev')">Vemmelev & Forlev</a></li>
          </ul>
        </div>

        <div>
          <div class="site-footer-col-title">Deltag & Støt</div>
          <ul class="site-footer-links">
            <li><a onclick="navigate('stoet')">Støt med fast pris</a></li>
            <li><a onclick="navigate('stoet')">Støt med valgfrit beløb</a></li>
            <li><a onclick="navigate('indsend')">Tip redaktionen</a></li>
            <li><a onclick="navigate('indsend')">Indsend debatindlæg</a></li>
            <li><a onclick="navigate('soeg')">Søg i nyhedsarkivet</a></li>
          </ul>
        </div>
      </div>

      <div class="site-footer-bottom">
        <div>
          &copy; 2026 SlagelseLokalt · En del af [By]Lokalt netværket i Danmark.
        </div>
        <div>
          Støttet af lokale borgere og virksomheder i Slagelse Kommune.
        </div>
      </div>
    </div>
  </footer>

  <!-- 6. INTERAKTIVE SCRIPTS -->
  <script>
    // Billedindsættelse fra singleton image registry
    function populateImages() {
      document.querySelectorAll('[data-img]').forEach(el => {
        const key = el.getAttribute('data-img');
        if (window.SL_IMAGES && window.SL_IMAGES[key]) {
          el.src = window.SL_IMAGES[key];
        }
      });
    }

    // Mobil menu toggle
    function toggleMobileMenu() {
      const drawer = document.getElementById('mobile-drawer');
      drawer.classList.toggle('is-open');
    }

    // Navigation mellem sektioner
    function navigate(sectionId) {
      document.querySelectorAll('.view-pane').forEach(el => el.classList.remove('is-active'));
      const target = document.getElementById('view-' + sectionId);
      if (target) {
        target.classList.add('is-active');
      } else {
        document.getElementById('view-forside').classList.add('is-active');
      }

      // Opdater desktop aktiv header link
      document.querySelectorAll('.site-header-primary-link').forEach(el => el.classList.remove('is-active'));
      const activeNav = document.getElementById('nav-' + sectionId);
      if (activeNav) activeNav.classList.add('is-active');

      // Opdater mobil subnav pill
      document.querySelectorAll('.site-mobile-subnav-pill').forEach(el => el.classList.remove('is-active'));
      const mobPill = document.getElementById('mobnav-' + sectionId);
      if (mobPill) mobPill.classList.add('is-active');

      // Scroll til top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Hvis søgning blev åbnet, fokuser input og vis standard resultater
      if (sectionId === 'soeg') {
        setTimeout(() => {
          const inp = document.getElementById('main-search-input');
          if (inp) {
            inp.focus();
            runLiveSearch(inp.value);
          }
        }, 100);
      }
    }

    // Naviger til artikel
    function navigateArticle(artId) {
      document.querySelectorAll('.view-pane').forEach(el => el.classList.remove('is-active'));
      const target = document.getElementById('view-artikel-' + artId);
      if (target) {
        target.classList.add('is-active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Fallback til artikel-storebaelt hvis id ikke findes
        const fb = document.getElementById('view-artikel-storebaelt');
        if (fb) {
          fb.classList.add('is-active');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }

    // Nabolagsfilter
    const nabolagData = {
      'Slagelse C': '4 nye projekter godkendt i bymidten. Håndværkere er gået i gang med omlægning af fortove ved Nytorv og Schweizerpladsen.',
      'Korsør': 'Storebæltstrafikken afvikles i 1 spor mod Vest. Ny skater- og multihal planlægges ved havnen i Korsør.',
      'Skælskør': 'Øget patruljering efter sommerhusindbrud ved Skælskør Næs. Borreby Teater melder om stort billetsalg.',
      'Dalmose': 'Lokalrådet inviterer til borgermøde om forbedret kollektiv bustransport mellem Dalmose og Slagelse.',
      'Vemmelev': 'Ny cykelsti mellem Vemmelev og Forlev er nu officielt indviet af kommunens tekniske udvalg.'
    };

    function filterNabolag(areaName, btnEl) {
      if (btnEl) {
        document.querySelectorAll('.site-nabolag-pill').forEach(p => p.classList.remove('is-active'));
        btnEl.classList.add('is-active');
      }
      const storyEl = document.getElementById('nabolag-story');
      if (storyEl && nabolagData[areaName]) {
        storyEl.innerHTML = '<strong>' + areaName + ':</strong> ' + nabolagData[areaName];
      }
    }

    // Støttemodel: Fast pris vs Valgfrit beløb
    let currentSupportMode = 'fast';
    let currentPlanName = 'Støtte';
    let currentPlanPrice = 49;
    let customAmount = 50;
    let customFreq = 'monthly';

    function setSupportMode(mode) {
      currentSupportMode = mode;
      const tabFast = document.getElementById('tab-support-fast');
      const tabValgfri = document.getElementById('tab-support-valgfri');
      const paneFast = document.getElementById('support-mode-fast');
      const paneValgfri = document.getElementById('support-mode-valgfri');

      if (mode === 'fast') {
        tabFast.classList.add('is-active');
        tabValgfri.classList.remove('is-active');
        paneFast.style.display = 'block';
        paneValgfri.style.display = 'none';
      } else {
        tabValgfri.classList.add('is-active');
        tabFast.classList.remove('is-active');
        paneFast.style.display = 'none';
        paneValgfri.style.display = 'block';
      }
      updateSubmitButton();
    }

    function selectPlan(name, price, cardEl) {
      currentPlanName = name;
      currentPlanPrice = price;
      document.querySelectorAll('.support-plan-card').forEach(c => c.classList.remove('is-selected'));
      cardEl.classList.add('is-selected');
      updateSubmitButton();
    }

    function setCustomFreq(freq) {
      customFreq = freq;
      const btnMonthly = document.getElementById('btn-freq-monthly');
      const btnOnce = document.getElementById('btn-freq-once');
      if (freq === 'monthly') {
        btnMonthly.classList.add('is-active');
        btnOnce.classList.remove('is-active');
      } else {
        btnOnce.classList.add('is-active');
        btnMonthly.classList.remove('is-active');
      }
      updateSubmitButton();
    }

    function setCustomAmt(amt) {
      customAmount = amt;
      document.getElementById('input-custom-amount').value = amt;
      document.querySelectorAll('.custom-amt-btn').forEach(b => b.classList.remove('is-active'));
      event.target.classList.add('is-active');
      updateSubmitButton();
    }

    function customInputChanged(val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        customAmount = parsed;
        document.querySelectorAll('.custom-amt-btn').forEach(b => b.classList.remove('is-active'));
        updateSubmitButton();
      }
    }

    function updateSubmitButton() {
      const btn = document.getElementById('btn-submit-support');
      if (currentSupportMode === 'fast') {
        btn.innerText = 'Støt med ' + currentPlanName + ' (' + currentPlanPrice + ' kr. / md)';
      } else {
        const freqText = customFreq === 'monthly' ? 'pr. måned' : 'engang';
        btn.innerText = 'Støt med ' + customAmount + ' kr. (' + freqText + ')';
      }
    }

    function submitSupport() {
      if (currentSupportMode === 'fast') {
        alert('Tusind tak! Dit medlemskab med ' + currentPlanName + ' (' + currentPlanPrice + ' kr./md) er nu oprettet. Tak fordi du bakker op om SlagelseLokalt!');
      } else {
        const freqText = customFreq === 'monthly' ? 'hver måned' : 'som engangsbidrag';
        alert('Tusind tak! Dit bidrag på ' + customAmount + ' kr. (' + freqText + ') er modtaget. Du gør en direkte forskel for lokaljournalistikken i Slagelse Kommune!');
      }
      navigate('forside');
    }

    function submitTip() {
      const title = document.getElementById('tip-title').value;
      const author = document.getElementById('tip-author').value;
      alert('Mange tak, ' + author + '! Din historie "' + title + '" er modtaget hos redaktionen. Vi kontakter dig snarest muligt.');
      navigate('forside');
    }

    function copyCurrentLink() {
      navigator.clipboard.writeText(window.location.href);
      alert('Linket er kopieret til din udklipsholder!');
    }

    // Søgefunktion
    const searchableArticles = [
      { id: 'storebaelt', title: 'Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld', category: 'Trafik · Storebælt', meta: 'Jonas Vestergaard · 2 t. siden' },
      { id: 'byraad', title: 'Nyt flertal på rådhuset vil investere 45 millioner i bymidten', category: 'Politik & Byudvikling', meta: 'Thomas Bach · 4 t. siden' },
      { id: 'sommerhuse', title: 'Flere sommerhuse udsat for indbrud ved Skælskør Næs', category: 'Krimi & Tryghed', meta: 'Mette Lindegaard · 6 t. siden' },
      { id: 'butik', title: 'Ny butikskæde åbner på Schweizerpladsen: Vil puste liv i handelsgaden', category: 'Erhverv & Handel', meta: 'Henrik Friis · I dag' },
      { id: 'sport', title: 'Slagelse B&I henter dramatisk overtidssejr på Harboe Arena', category: 'Lokalsport', meta: 'Martin Simonsen · I går' },
      { id: 'tudeaa', title: 'Nyt vådområdeprojekt ved Tude Å beskytter mod fremtidige oversvømmelser', category: 'Natur & Miljø', meta: 'Astrid Lorentzen · I går' },
      { id: 'debat', title: 'Debat: "Vi må og skal bevare de grønne åndehuller i Slagelse Kommune"', category: 'Debat & Holdninger', meta: 'Lise Holm · I dag' },
      { id: 'foreningsliv', title: '120 frivillige hædret ved årets foreningsfest i Korsør', category: 'Foreningsliv & Frivillighed', meta: 'Sara Lund · I går' },
      { id: 'kultur', title: 'Musikhuset Slagelse løfter sløret for et stærkt forårsprogram', category: 'Kultur & Oplevelser', meta: 'Camilla Krogh · I dag' }
    ];

    function runLiveSearch(query) {
      const q = (query || '').toLowerCase().trim();
      const resultsContainer = document.getElementById('search-results-box');
      if (!resultsContainer) return;

      const filtered = searchableArticles.filter(item => {
        if (!q) return true;
        return item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="padding:24px; text-align:center; color:var(--ink-3);">Ingen historier matchede din søgning. Prøv et andet ord eller nulstil søgningen.</div>';
        return;
      }

      resultsContainer.innerHTML = filtered.map(item => `
        <div class="search-result-item" onclick="navigateArticle('${item.id}')">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--site-accent); margin-bottom:4px;">${item.category}</div>
          <div style="font-family:var(--font-display); font-size:19px; font-weight:700; color:var(--ink); line-height:1.3; margin-bottom:6px;">${item.title}</div>
          <div style="font-size:12px; color:var(--ink-3);">${item.meta} · Klik for at læse artiklen →</div>
        </div>
      `).join('');
    }

    function setSearchFilter(keyword) {
      const inp = document.getElementById('main-search-input');
      if (inp) {
        inp.value = keyword;
        runLiveSearch(keyword);
      }
    }

    function filterCategory(cat) {
      // Skift til søgevisning med kategorifilter
      navigate('soeg');
      setSearchFilter(cat);
    }

    // Kør ved opstart
    window.addEventListener('DOMContentLoaded', () => {
      populateImages();
      runLiveSearch('');
    });
  </script>
</body>
</html>
'''

# Replace placeholder with singleton images JSON
final_html = html_template.replace('__IMAGES_JSON__', sl_images_json)

# Write to nyhedssite.html
with open('nyhedssite.html', 'w', encoding='utf-8') as f:
    f.write(final_html)

print(f"nyhedssite.html successfully built. File size: {len(final_html):,} bytes")
