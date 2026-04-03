# OLKV — Agent Instructions

## Prosjektoversikt
OLKV er en norsk webapp for Opplæringskontoret i Vestland. Den kobler lærlinger med lærebedrifter.
Stack: Node.js + Express (ESM), Firebase (Auth, Firestore, Storage, Cloud Functions Gen 2), Vanilla JS frontend.

## KRITISKE REGLER — LES DETTE FØRST

### 1. ALDRI rediger filer over 300 linjer uten å lese hele filen først
- `profil.html` er 1500+ linjer. Ikke gjør endringer uten å forstå helheten.
- Bruk `view` med `view_range` for å lese seksjoner du skal endre.
- Beskriv alltid HVA du endrer og HVORFOR før du gjør det.

### 2. ÉN endring om gangen
- Gjør aldri mer enn én logisk endring per commit.
- Test at den ene endringen fungerer FØR du går videre.
- Hvis du fikser en bug, ikke "forbedre" noe annet samtidig.

### 3. Ikke svelg feil
- ALDRI skriv tomme `catch {}` eller `catch { /* ignorer */ }`.
- Alle catch-blokker SKAL minst ha `console.error(err)`.
- Frontend-feil SKAL vises til brukeren med `visFeilmelding()` eller `visMelding()`.

### 4. Ikke dupliser kode
- `index.js` er ENESTE entry point for Cloud Functions. `functions.js` skal IKKE eksistere.
- Sjekk alltid om en funksjon allerede finnes i `app.js` før du lager en ny.

### 5. Mobil-first
- Alle CSS-endringer SKAL testes med viewport 375px bredde.
- Bruk `min-height: 44px` på alle interaktive elementer.
- Sjekk at `.skjult`-klassen fungerer korrekt (den bruker `display: none !important`).

## Filstruktur — hva er hva

```
index.js              ← Cloud Functions entry point (ENESTE)
server.js             ← Express-app (brukes av både dev og prod)
firebase/config.js    ← Admin SDK init
middleware/            ← Auth og rate limiting
routes/               ← API-endepunkter (auth, ai, admin, soknader, etc.)
tools/                ← AI-klienter, e-post, seed-scripts
utils/                ← Hjelpefunksjoner (varsler)
public/               ← Frontend (statiske filer)
  app.js              ← Delt frontend-logikk (auth, API-kall, hjelpefunksjoner)
  firebase-config.js  ← Client SDK config
  style.css           ← All CSS
  laerling/           ← Lærling-sider (dashboard, profil, søknader, læreplasser)
  bedrift/            ← Bedrift-sider
  admin/              ← Admin-sider
```

## Vanlige fallgruver

### Firebase-spesifikt
- `FB_PRIVATE_KEY` har `\n` som må erstattes: `.replace(/\\n/g, '\n')`
- Firestore Timestamps må konverteres: `data.opprettet?.toDate?.()?.toISOString?.()`
- Cloud Functions secrets: definert i `index.js` sin `secrets`-array
- Storage bucket: `onklv-app.firebasestorage.app`

### Frontend-spesifikt
- Firebase Client SDK importeres via CDN (ikke npm): `https://www.gstatic.com/firebasejs/11.6.0/`
- `getToken()` i `app.js` returnerer Firebase ID-token
- Alle API-kall bruker `Authorization: Bearer ${token}`
- Modaler bruker `.modal-bakgrunn.skjult` — toggle med `classList.add/remove('skjult')`

### Profil-siden (profil.html)
- Har to moduser: visning (for bedrift/admin) og redigering (for eier)
- `editMode` styrer `.edit-only`-elementers synlighet
- `targetBruker` = den brukeren vi ser på (kan være en annen enn innlogget bruker)
- `profil` = profilData fra Firestore subcollection `users/{uid}/profilData/main`
- Video bruker signed URLs (3-stegs opplasting: signed-url → direkte upload → confirm)

## Når du får en feil

1. Les HELE feilmeldingen (ikke bare første linje)
2. Finn den EKSAKTE filen og linjen som feiler
3. Forklar hva som går galt og hvorfor
4. Foreslå den MINSTE endringen som fikser det
5. Gjør endringen og test
6. Hvis testen feiler, STOPP og spør meg — ikke prøv å fikse videre på egen hånd

## Skills (bakgrunnsdokumentasjon)
- `skills/PERFECTMATCH_STACK.md` — tech stack og arkitektur
- `skills/PERFECTMATCH_AUTH_UX.md` — auth og UX-prinsipper
- `skills/PERFECTMATCH_AI.md` — AI-integrasjon
