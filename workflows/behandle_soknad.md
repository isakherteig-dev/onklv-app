# Workflow: Admin — Behandle søknad

## Mål
En saksbehandler hos opplæringskontoret logger inn som admin, henter oversikt over innkomne søknader, ser på én kandidat med AI-generert sammendrag, og oppdaterer søknadsstatus. Lærlingen varsles om utfallet.

---

## Inputs

| Felt | Type | Påkrevd |
|---|---|---|
| `admin` JWT-token | cookie | Ja (rolle = "admin") |
| `soknad_id` | number | Ja |
| `ny_status` | enum: `under_vurdering` \| `akseptert` \| `avvist` | Ja |

---

## Verktøy

- `middleware/auth.js` — `requireAuth` + `requireRole("admin")`
- `tools/db.js` — hent søknader, hent kandidatdata, UPDATE status
- `tools/ai_oppsummer.js` — generer AI-sammendrag av søknad (se `workflows/ai_oppsummer_soknad.md`)

---

## Steg

1. **Admin logger inn**
   - POST `/api/auth/login` med admin-konto
   - JWT-cookie settes, redirect til `/admin/dashboard.html`

2. **Vis søknadsoversikt**
   - Hent `GET /api/admin/oversikt`
   - Vis liste over søknader med status, kandidatnavn, læreplasstittel og dato
   - Filtrerbart på status: alle / sendt / under vurdering / akseptert / avvist

3. **Åpne én søknad**
   - Klikk på søknad → hent `GET /api/admin/soknader/:id`
   - Hent tilhørende lærlingdata og læreplassdata fra DB (`tools/db.js`)

4. **Generer AI-sammendrag**
   - Kall `tools/ai_oppsummer.js` med lærlingdata, søknad og læreplassdata
   - Vis sammendraget øverst i søknadsvisningen
   - Hvis AI er utilgjengelig: vis søknadsdata uten sammendrag (ikke blokker flyten)

5. **Se kandidatprofil**
   - Vis: navn, utdanningsprogram, bio, CV-lenke (hvis lastet opp)
   - Vis søknadsmeldingen

6. **Oppdater status**
   - Admin velger ny status fra dropdown: "Under vurdering", "Akseptert", "Avvist"
   - PUT `/api/admin/soknader/:id` med `{ status: ny_status }`
   - Kjør `tools/db.js`: UPDATE `søknader` SET status = ny_status WHERE id = soknad_id

7. **Varsle lærling**
   - Etter statusoppdatering: vis statusendrng i lærlingens dashboard ved neste innlogging
   - (MVP: ingen e-postvarsling — lærlingen ser status i dashboardet sitt)

---

## Outputs

- `søknader.status` oppdatert til ny verdi
- Admin ser bekreftelse: "Status er oppdatert"
- Lærlingen ser oppdatert status i sitt dashboard

---

## Feilscenarier

| Feil | Årsak | Respons til admin |
|---|---|---|
| Ikke innlogget som admin | Mangler/ugyldig JWT | Redirect til `/innlogging.html` |
| Søknad ikke funnet | Ugyldig `soknad_id` | "Søknaden finnes ikke" |
| Ugyldig statusverdi | Feil enum-verdi | "Ugyldig statusverdi" (valider i backend) |
| AI-tjeneste utilgjengelig | Anthropic API nede | Vis søknad uten sammendrag, logg feil i `.tmp/ai_log.jsonl` |
| DB-feil ved oppdatering | Ukjent serverfeil | "Statusen kunne ikke oppdateres. Prøv igjen." |

---

## Norsk UX-regler

- Knapper: "Sett under vurdering", "Aksepter", "Avvis"
- Bekreftelse etter oppdatering: "Søknaden er oppdatert"
- AI-sammendrag merkes tydelig: "Automatisk sammendrag (AI)" så admin vet det ikke er manuelt skrevet
- Avvisning skal ikke kreve begrunnelse i MVP (men feltet kan legges til senere)
