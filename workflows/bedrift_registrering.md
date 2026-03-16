# Workflow: Lærebedrift — Registrering og venting på godkjenning

## Mål
En lærebedrift oppretter konto og bedriftsprofil. Kontoen er inaktiv til admin hos opplæringskontoret godkjenner bedriften. Først etter godkjenning kan bedriften legge ut læreplassannonser.

---

## Inputs

| Felt | Type | Påkrevd |
|---|---|---|
| `email` | string | Ja |
| `passord` | string (min 8 tegn) | Ja |
| `bedrift_navn` | string | Ja |
| `org_nr` | string (9 siffer) | Ja |
| `bransje` | string | Ja |
| `beskrivelse` | string | Nei |

---

## Verktøy

- `tools/auth.js` — bcrypt-hashing, opprettelse av bruker i `users`-tabellen
- `tools/db.js` — INSERT i `bedrifter`-tabellen med `godkjent = false`

---

## Steg

1. **Vis registreringsskjema for bedrift**
   - Hent `/bedrift/registrer.html`
   - Skjema inneholder: e-post, passord, bedriftsnavn, org.nr, bransje, beskrivelse

2. **Send skjema**
   - Frontend POSTer til `POST /api/auth/register` med `role: "bedrift"`
   - Valider påkrevde felter (frontend + backend)
   - Valider at org.nr er 9 siffer

3. **Sjekk duplikater**
   - Sjekk at e-post ikke finnes i `users`
   - Sjekk at org.nr ikke finnes i `bedrifter`

4. **Opprett bruker**
   - Kjør `tools/auth.js`: hash passord (bcrypt, 12 salt rounds)
   - INSERT i `users`: email, password_hash, role = "bedrift"

5. **Opprett bedriftsprofil**
   - Kjør `tools/db.js`: INSERT i `bedrifter`
   - Felter: user_id, navn, org_nr, bransje, beskrivelse, `godkjent = false`

6. **Vis ventemelding (ingen JWT ennå)**
   - Logg IKKE inn automatisk — bedriften må godkjennes først
   - Redirect til `/bedrift/venter.html`
   - Vis: "Takk for registreringen! Vi behandler søknaden din og tar kontakt snart."

7. **Admin-godkjenning (separat flyt — se `workflows/behandle_soknad.md`)**
   - Admin setter `bedrifter.godkjent = true`
   - Bedriften kan nå logge inn og legge ut annonser

---

## Outputs

- Ny rad i `users` (id, email, password_hash, role = "bedrift")
- Ny rad i `bedrifter` (id, user_id, navn, org_nr, bransje, beskrivelse, godkjent = false)
- Ingen JWT-cookie — bedriften er ikke innlogget ennå

---

## Feilscenarier

| Feil | Årsak | Respons til bruker |
|---|---|---|
| E-post allerede registrert | Duplikat i `users.email` | "Denne e-postadressen er allerede i bruk" |
| Org.nr allerede registrert | Duplikat i `bedrifter.org_nr` | "Dette organisasjonsnummeret er allerede registrert" |
| Ugyldig org.nr format | Ikke 9 siffer | "Organisasjonsnummeret må være 9 siffer" |
| Passord for kort | Validering feiler | "Passordet må være minst 8 tegn" |
| DB-feil | Ukjent serverfeil | "Noe gikk galt. Prøv igjen om litt." |

---

## Norsk UX-regler

- Knapper: "Registrer bedrift"
- Forvent at bedrifter bruker PC (ikke kun mobiloptimalisert her, men skalerbart)
- Ventemelding skal være rolig og informativ — ikke bekymringsfull
- Ikke vis "søknad avvist" før admin faktisk avviser — standard er "venter"
