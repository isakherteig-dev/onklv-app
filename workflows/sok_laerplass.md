# Workflow: Lærling — Søk på læreplassannonse

## Mål
En innlogget lærling finner en læreplassannonse og sender søknad med melding. Søknaden registreres og lærlingen får bekreftelse.

---

## Inputs

| Felt | Type | Påkrevd |
|---|---|---|
| `laerplass_id` | number | Ja (fra URL/annonse) |
| `melding` | string | Ja |
| `laerling_id` | number | Ja (fra JWT-token) |

---

## Verktøy

- `tools/db.js` — hent annonsedatd, sjekk duplikat, INSERT i `søknader`
- `middleware/auth.js` — `requireAuth` + `requireRole("laerling")`

---

## Steg

1. **Vis læreplassannonse**
   - Hent `GET /api/laereplasser/:id`
   - Vis tittel, beskrivelse, bedriftsnavn, frist, antall plasser
   - Vis "Søk nå"-knapp (kun synlig hvis innlogget og rolle = laerling)

2. **Åpne søknadsskjema**
   - Klikk "Søk nå" → vis skjema med tekstfelt for søknadsmelding
   - Forhåndsvis lærlingens CV-status ("Din CV er lastet opp" / "Du har ikke lastet opp CV ennå")

3. **Send søknad**
   - Frontend POSTer til `POST /api/soknader`
   - Body: `{ laerplass_id, melding }`
   - Token sendes automatisk via cookie

4. **Valider søknad (backend)**
   - Sjekk at lærlingen er innlogget (`requireAuth`)
   - Sjekk at rollen er "laerling" (`requireRole`)
   - Sjekk at annonsen eksisterer og er aktiv (`læreplasser.aktiv = true`)
   - Sjekk at lærlingen ikke allerede har søkt på denne plassen

5. **Lagre søknad**
   - Kjør `tools/db.js`: INSERT i `søknader`
   - Felter: laerling_id, laerplass_id, melding, status = "sendt", created_at = NOW()

6. **Bekreftelse**
   - Returner `201 Created` med `{ soknad_id, status: "sendt" }`
   - Vis bekreftelsesmelding til lærlingen

---

## Outputs

- Ny rad i `søknader` (id, laerling_id, laerplass_id, status = "sendt", melding, created_at)
- Bekreftelsesmelding i UI

---

## Feilscenarier

| Feil | Årsak | Respons til bruker |
|---|---|---|
| Ikke innlogget | Mangler JWT-cookie | Redirect til `/innlogging.html` |
| Annonse ikke aktiv | `læreplasser.aktiv = false` | "Denne læreplassen er ikke lenger tilgjengelig" |
| Allerede søkt | Duplikat i `søknader` | "Du har allerede søkt på denne læreplassen" |
| Tom melding | Validering feiler | "Skriv en kort søknadsmelding" |
| DB-feil | Ukjent serverfeil | "Søknaden kunne ikke sendes. Prøv igjen om litt." |

---

## Norsk UX-regler

- Knapper: "Søk nå", "Send søknad", "Avbryt"
- Bekreftelse: "Søknaden din er sendt! Du hører fra oss snart."
- Vis alltid søknadsstatus i lærlingens dashboard etter innsending
