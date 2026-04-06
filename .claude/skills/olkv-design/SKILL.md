---
name: olkv-design
description: |
  OLKV design system og CSS styling regler. Bruk denne skill-en når du endrer
  .css-filer, HTML-templates, eller JS som rører DOM.
  Aktiveres automatisk for alt frontend-arbeid.
---

# OLKV Design System

## Kontekst
OLKV er en norsk plattform for lærlinger (16-20 år) og lærebedrifter.
Stil: Vipps, Finn.no, Linear — clean, norsk, tillitsvekkende.
Tech: Vanilla JS + plain CSS. Ingen Tailwind. Ingen React.

## FORBUDT
- Emojier i UI (bruk Lucide SVG-ikoner)
- Inter, Roboto, Arial som font (bruk DM Sans)
- Lilla gradients, gradient-tekst, neon-glow
- Glassmorphism (blur/glass-kort)
- Kort med ::before gradient-linje på toppen
- translateY på kort-hover
- border-radius: 999px (pill) unntatt små badges
- font-weight over 600 i dashboard
- ALL CAPS tekst unntatt korte badges
- Playfair Display i dashboard (kun landing page)
- Identiske 3-kolonners kort-grid
- Store ikoner med avrundede hjørner over headings
- Modals med mindre absolutt nødvendig
- bounce/elastic easing
- Hardkodede hex-farger (bruk CSS-variabler)

## Farger (CSS-variabler)
--color-primary: #1B3A6B (mørk blå, bruk sparsomt)
--color-primary-hover: #15305A
--color-primary-light: #EFF6FF
--color-text: #0F172A
--color-text-secondary: #64748B
--color-text-muted: #94A3B8
--color-bg: #FAFBFC
--color-bg-card: #FFFFFF
--color-bg-hover: #F8FAFC
--color-bg-active: #F1F5F9
--color-border: rgba(0,0,0,0.06)
--color-border-strong: rgba(0,0,0,0.12)
--color-success: #16A34A / bg: #F0FDF4
--color-error: #DC2626 / bg: #FEF2F2
--color-warning: #CA8A04 / bg: #FEFCE8
--color-accent: #E74C3C (kun logo + destruktive handlinger)

## Typografi
Font: DM Sans (400, 500, 600)
h1: 1.5rem/600  h2: 1.25rem/600  h3: 1rem/600
body: 0.875rem/400  small: 0.8rem  badge: 0.75rem/500

## Spacing (4px grid)
4, 8, 12, 16, 20, 24, 32, 40 — ingen magiske tall

## Knapper
Primær: bg #1B3A6B, hvit tekst, 8px radius, 10px 20px padding
Sekundær: transparent bg, 1px border rgba(0,0,0,0.12)
Ghost: ingen border, hover bg rgba(0,0,0,0.04)
Destruktiv: bg #FEF2F2, tekst #991B1B (ALDRI rød bg + hvit tekst)
Alle: font-weight 500, 0.875rem, min-height 40px

## Kort
border: 1px solid rgba(0,0,0,0.06), radius 10px, padding 20px
shadow: 0 1px 3px rgba(0,0,0,0.04)
hover: shadow 0 2px 8px rgba(0,0,0,0.06) — INGEN transform

## Badges
radius: 6px, padding: 2px 8px, 0.75rem/500
Lys bakgrunn + mørk tekst av samme farge (f.eks #EFF6FF + #1E40AF)

## Tabell
Header: bg #F8FAFC, weight 500, 0.8rem, IKKE uppercase
Rader: hover bg #FAFBFC, border rgba(0,0,0,0.04)

## Sidebar
Hvit bg, aktiv: bg #F1F5F9 + color primary, INGEN border-left
Hover: bg #F8FAFC

## Ikoner
Lucide SVG, 16px i knapper, 18px i nav, stroke-width 1.5, color currentColor

## Mobil
Bunn-nav: hvit bg, 1px top border, INGEN shadow
Aktiv: farge primary + 4px dot under ikon
Slide-meny: fra høyre, hvit bg, SVG-ikoner

## Animasjon
100ms hover, 150ms expand, 250ms slide
Easing: ease-out ALLTID. ALDRI bounce/elastic
Kun transform + opacity. Ingen translateY på kort

## Regler
1. Én endring om gangen
2. Ikke !important
3. Maks 2 nivåer nesting
4. Test 375px + 1440px
5. WCAG AA kontrast (4.5:1)
6. Lav spesifisitet (klasser, ikke ID)

## Sjekkliste før commit
- Ingen emojier i UI
- Alle farger = CSS-variabler
- Ingen ::before gradient på kort
- Ingen translateY hover
- Ingen pill-shapes unntatt badges
- Shadow maks 0 2px 8px rgba(0,0,0,0.06)
- Fungerer på 375px og 1440px
