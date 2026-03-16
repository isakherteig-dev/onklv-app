# Workflow: AI — Oppsummer søknad for saksbehandler

## Mål
Claude lager et kort, nøytralt sammendrag av en søknad (maks 3 setninger) til bruk for admin hos opplæringskontoret. Sammendraget skal hjelpe saksbehandler raskt forstå kandidaten uten å måtte lese alt selv.

---

## Inputs

| Felt | Kilde | Type |
|---|---|---|
| `laerling.navn` | DB: `laerlinger` | string |
| `laerling.utdanningsprogram` | DB: `laerlinger` | string |
| `laerling.bio` | DB: `laerlinger` | string |
| `soknad.melding` | DB: `søknader` | string |
| `laerplass.tittel` | DB: `læreplasser` | string |
| `laerplass.bedrift_navn` | DB: `bedrifter` | string |

---

## Verktøy

- `tools/ai_client.js` — `callClaude(systemPrompt, userMessage)`
- `tools/ai_oppsummer.js` — `oppsummerSoknad(laerling, soknad, laerplass)`
- `tools/db.js` — hent alle nødvendige data fra DB før AI-kallet

---

## Steg

1. **Hent data fra database**
   - Kjør `tools/db.js`: hent søknad, lærlingprofil og læreplassdata basert på `soknad_id`
   - Valider at alle påkrevde felter er tilgjengelige

2. **Bygg prompt**
   - System-prompt (fast, ikke brukerinput):
     ```
     Du er assistent for et norsk opplæringskontor.
     Lag korte, nøytrale oppsummeringer av søknader. Maks 3 setninger. Norsk bokmål.
     ```
   - User-melding (dynamisk, bygget fra DB-data):
     ```
     Søknad fra: {laerling.navn}
     Søker på: {laerplass.tittel} hos {laerplass.bedrift_navn}
     Søknadsmelding: {soknad.melding}
     CV-sammendrag: {laerling.bio}

     Lag en kort oppsummering for saksbehandler.
     ```

3. **Kall Claude**
   - Kjør `tools/ai_client.js`: `callClaude(systemPrompt, userMessage)`
   - Modell: `claude-sonnet-4-20250514`
   - max_tokens: 1024

4. **Returner sammendrag**
   - Returner teksten direkte (ikke JSON for denne funksjonen)
   - Logg kallet i `.tmp/ai_log.jsonl` med timestamp og soknad_id

---

## Outputs

```json
{
  "sammendrag": "Kandidaten er elev på elektrofag og søker med god motivasjon. Søknaden fremstår gjennomtenkt og relevant for stillingen. Ingen CV er lastet opp."
}
```

Sammendraget er maks 3 setninger på norsk bokmål.

---

## Feilscenarier

| Feil | Årsak | Håndtering |
|---|---|---|
| Manglende data | `bio` eller `melding` er NULL | Erstatt med `"Ikke oppgitt"` — ikke avbryt kallet |
| Claude returnerer ikke gyldig tekst | Tom respons | Logg feil, returner `null` — vis søknad uten sammendrag |
| API-timeout | Anthropic-tjenesten er treg | Kast feil etter 10 sek, returner `null` |
| Uventet API-feil | Rate limit, nede, etc. | Logg feil i `.tmp/ai_log.jsonl`, returner `null` |

> Viktig: AI-sammendrag er et hjelpeverktøy — systemet skal alltid fungere uten det.
> Aldri blokker saksbehandling fordi AI-kallet feiler.

---

## Kostnadsbevissthet

- Et oppsummer-kall bruker ca. 300–500 tokens
- Kall Claude kun når admin eksplisitt åpner en søknad — ikke ved listevisning
- Ikke cache sammendraget (søknader endres sjelden, men bio kan oppdateres)

---

## Loggformat (`.tmp/ai_log.jsonl`)

```json
{ "ts": "2026-03-16T10:30:00Z", "type": "oppsummer", "soknad_id": 42, "tokens": 412, "ok": true }
{ "ts": "2026-03-16T10:31:00Z", "type": "oppsummer", "soknad_id": 43, "tokens": 0, "ok": false, "error": "timeout" }
```
