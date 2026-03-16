# SKILL: Perfect Match — Stack & Arkitektur

## Hva denne skilen gjør
Når Claude Code skal bygge eller utvide Perfect Match-appen, les denne filen FØRST.
Den definerer stack, mappestruktur, navnekonvensjoner og regler som alltid gjelder.

---

## Prosjektbeskrivelse
Perfect Match er en norsk webapp som kobler lærlinger og lærebedrifter i Norge.
Primær bruker: Opplæringskontoret i Vestland (Jimmy Pasali).

Tre brukerroller:
1. **Lærling** — søker læreplasser, lager profil, laster opp CV
2. **Lærebedrift** — oppretter profil, legger ut læreplasser
3. **Admin / Opplæringskontor** — oversikt over søknader, bedrifter og matching

---

## Tech Stack (hold deg til dette)

| Lag | Teknologi |
|---|---|
| Backend | Node.js + Express (ESM) |
| Frontend | Vanilla JS eller React (avheng av kompleksitet) |
| Database | SQLite (MVP) → PostgreSQL (produksjon) |
| Auth | JWT tokens lagret i httpOnly cookies |
| AI | Anthropic Claude API (matching + oppsummering) |
| Fillagring | Lokal `/uploads/` mappe (MVP) → Cloudinary (prod) |
| Styling | CSS Variables + moderne CSS (ingen Bootstrap) |
| Deploy | Railway eller Render (enkel, billig, Node-vennlig) |

---

## Mappestruktur

```
onklv-app/
├── public/              # Frontend (HTML, CSS, JS)
│   ├── index.html       # Landing page
│   ├── laerling/        # Sider for lærlinger
│   ├── bedrift/         # Sider for bedrifter
│   ├── admin/           # Admin-panel
│   ├── style.css
│   └── app.js
├── routes/              # Express route-filer
│   ├── auth.js
│   ├── laerling.js
│   ├── bedrift.js
│   ├── admin.js
│   └── ai.js
├── db/
│   ├── schema.sql       # Database-struktur
│   └── database.js      # DB-tilkobling
├── middleware/
│   └── auth.js          # JWT-verifisering
├── tools/               # WAT-verktøy (scripts)
├── workflows/           # WAT-dokumentasjon (markdown SOPs)
├── uploads/             # Opplastede filer (CV, bilder)
├── .tmp/
├── server.js
├── .env
└── package.json
```

---

## Database-tabeller (MVP)

```sql
-- Brukere (alle roller)
users: id, email, password_hash, role (laerling|bedrift|admin), created_at

-- Lærlingprofiler
laerlinger: id, user_id, navn, telefon, utdanningsprogram, cv_url, bio

-- Bedriftsprofiler
bedrifter: id, user_id, navn, org_nr, bransje, beskrivelse, godkjent (bool)

-- Læreplassannonser
læreplasser: id, bedrift_id, tittel, beskrivelse, frist, antall_plasser, aktiv

-- Søknader
søknader: id, laerling_id, laerplass_id, status (sendt|under_vurdering|akseptert|avvist), melding, created_at
```

---

## API-endepunkter (planlagt)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/laerlinger/:id
PUT    /api/laerlinger/:id
GET    /api/bedrifter
POST   /api/bedrifter
GET    /api/laereplasser
POST   /api/laereplasser
POST   /api/soknader
GET    /api/admin/oversikt
POST   /api/ai/match          ← Claude matcher lærling mot plasser
POST   /api/ai/oppsummer       ← Claude oppsummerer søknad for admin
```

---

## Regler Claude Code alltid skal følge

1. **Ingen hardkodede API-nøkler** — alltid `process.env.VARIABEL`
2. **Alle DB-spørringer** skal bruke parameteriserte queries (unngå SQL injection)
3. **Passord** hashes alltid med bcrypt før lagring
4. **JWT** lagres i httpOnly cookie, ikke localStorage
5. **Feilmeldinger til bruker** skal være norsk og vennlig — ikke tekniske stack traces
6. **Mobiloptimalisert CSS** — appen brukes på telefon av lærlinger
7. **Ikke bygg alt på en gang** — spør om vi er i MVP-fase eller prod-fase

---

## MVP vs Produksjon

### MVP (nå — demo til Jimmy)
- [ ] Registrering/innlogging (alle roller)
- [ ] Lærlingprofil med CV-opplasting
- [ ] Bedriftsprofil
- [ ] Liste over læreplasser
- [ ] Enkel søknadsfunksjon
- [ ] Admin ser søknader

### Produksjon (etter godkjenning)
- [ ] AI-matching
- [ ] Pushvarsler
- [ ] Video-CV
- [ ] Chat mellom lærling og bedrift
- [ ] Integrasjon mot Vigo/Utdanning.no

---

## Viktig kontekst
- **Jimmy Pasali** er primær stakeholder — han kjenner bransjen
- **Opplæringskontoret i Vestland** er første målkunde
- Konkurrenter: Vigo, Utdanning.no, Arbeidsplassen.no — men disse føles utdaterte
- Vi bygger for norsk kontekst (bokmål, norsk ux-tone, GDPR)
