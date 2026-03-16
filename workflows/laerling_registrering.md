# Workflow: Lærling — Registrering og profiloppsett

## Mål
En ny lærling oppretter konto, fyller ut profil og laster opp CV slik at de kan søke på læreplasser.

---

## Inputs

| Felt | Type | Påkrevd |
|---|---|---|
| `email` | string | Ja |
| `passord` | string (min 8 tegn) | Ja |
| `navn` | string | Ja |
| `telefon` | string | Ja |
| `utdanningsprogram` | string | Ja |
| `bio` | string | Nei |
| `cv_fil` | fil (.pdf eller .docx, maks 5MB) | Nei (kan legges til senere) |

---

## Verktøy

- `tools/auth.js` — bcrypt-hashing av passord, opprettelse av bruker i `users`-tabellen
- `tools/upload_cv.js` — multer-opplasting av CV til `/uploads/`
- `tools/db.js` — INSERT i `laerlinger`-tabellen

---

## Steg

1. **Vis registreringsskjema**
   - Hent `/laerling/registrer.html`
   - Skjema inneholder: e-post, passord, navn, telefon, utdanningsprogram, bio, CV-opplasting

2. **Send skjema**
   - Frontend POSTer til `POST /api/auth/register` med `role: "laerling"`
   - Valider at alle påkrevde felter er fylt ut (frontend + backend)

3. **Opprett bruker**
   - Kjør `tools/auth.js`: hash passord med bcrypt (12 salt rounds)
   - INSERT i `users`: email, password_hash, role = "laerling"
   - Returner `user_id`

4. **Opprett lærlingprofil**
   - Kjør `tools/db.js`: INSERT i `laerlinger` med user_id, navn, telefon, utdanningsprogram, bio
   - `cv_url` settes til NULL hvis ingen fil er lastet opp

5. **Last opp CV (valgfritt)**
   - Hvis fil er vedlagt: kjør `tools/upload_cv.js`
   - Lagre filen som `{user_id}_{timestamp}.pdf` i `/uploads/`
   - Oppdater `laerlinger.cv_url` med filstien

6. **Utsted JWT og sett cookie**
   - Sign JWT med `{ id, role: "laerling" }`, utløper om 7 dager
   - Sett httpOnly cookie `token`

7. **Redirect**
   - Send lærlingen til `/laerling/dashboard.html`

---

## Outputs

- Ny rad i `users` (id, email, password_hash, role = "laerling")
- Ny rad i `laerlinger` (id, user_id, navn, telefon, utdanningsprogram, bio, cv_url)
- httpOnly JWT-cookie satt i nettleseren
- Lærlingen er innlogget og sendt til dashboard

---

## Feilscenarier

| Feil | Årsak | Respons til bruker |
|---|---|---|
| E-post allerede registrert | Duplikat i `users.email` | "Denne e-postadressen er allerede i bruk" |
| Passord for kort | Validering feiler | "Passordet må være minst 8 tegn" |
| Ugyldig filtype | Ikke .pdf eller .docx | "Kun PDF og Word-filer kan lastes opp" |
| Fil for stor | Over 5MB | "Filen er for stor. Maks størrelse er 5MB" |
| DB-feil | Ukjent serverfeil | "Noe gikk galt. Prøv igjen om litt." |

---

## Norsk UX-regler (fra PERFECTMATCH_AUTH_UX)

- Bruk du-form i alle meldinger
- Knapper: "Registrer deg", "Last opp CV"
- Bekreftelse: "Profilen din er opprettet! Du kan nå søke på læreplasser."
- Aldri vis tekniske feilmeldinger til bruker
