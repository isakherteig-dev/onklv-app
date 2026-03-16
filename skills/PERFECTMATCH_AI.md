# SKILL: Perfect Match — AI & Claude API Bruk

## Hva denne skilen gjør
Når Claude Code skal implementere AI-funksjoner i Perfect Match, les denne filen.
Den definerer nøyaktig hvordan Claude API skal brukes, hvilke prompts som fungerer,
og hvilke AI-features som er prioritert.

---

## Når skal AI brukes? (og ikke)

### ✅ Bruk AI til:
- **Matching** — score en lærling mot en læreplassannonse (0-100)
- **Oppsummering** — lag en kort sammendrag av en søknad for admin
- **Anbefaling** — foreslå topp 3 læreplasser til en lærling
- **Forbedring** — gi lærlingen tips til å forbedre profil/CV

### ❌ Ikke bruk AI til:
- Autentisering
- Database-spørringer
- Filhåndtering
- Alt som er deterministisk og kan gjøres med vanlig kode

---

## API-oppsett

```javascript
// tools/ai_client.js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function callClaude(systemPrompt, userMessage) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',  // Alltid bruk denne modellen
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });
  return response.content[0].text;
}
```

---

## Matching-prompt (lærling → læreplasser)

```javascript
// tools/ai_match.js
export async function matchLaerlingTilPlasser(laerling, plasser) {
  const system = `Du er et matching-system for norske lærlinger og lærebedrifter.
Du returnerer KUN gyldig JSON, ingen forklaring, ingen markdown.
Format: { "resultater": [{ "laerplass_id": number, "score": number, "begrunnelse": string }] }
Score er 0-100. Begrunnelse er maks 2 setninger på norsk.`;

  const user = `
Lærling:
- Utdanningsprogram: ${laerling.utdanningsprogram}
- Bio: ${laerling.bio}

Ledige læreplasser:
${plasser.map(p => `ID ${p.id}: ${p.tittel} — ${p.beskrivelse}`).join('\n')}

Ranger læreplassene fra best til dårligst match for denne lærlingen.`;

  const raw = await callClaude(system, user);
  return JSON.parse(raw);
}
```

---

## Oppsummering for admin

```javascript
// tools/ai_oppsummer.js
export async function oppsummerSoknad(laerling, soknad, laerplass) {
  const system = `Du er assistent for et norsk opplæringskontor.
Lag korte, nøytrale oppsummeringer av søknader. Maks 3 setninger. Norsk bokmål.`;

  const user = `
Søknad fra: ${laerling.navn}
Søker på: ${laerplass.tittel} hos ${laerplass.bedrift_navn}
Søknadsmelding: ${soknad.melding}
CV-sammendrag: ${laerling.bio}

Lag en kort oppsummering for saksbehandler.`;

  return await callClaude(system, user);
}
```

---

## Profil-forbedring (til lærlingen)

```javascript
export async function forbedreProfil(laerling) {
  const system = `Du er karriereveileder for norske lærlinger (16-20 år).
Gi 3 konkrete, vennlige tips for å forbedre profilen. Bruk enkel norsk.
Returner JSON: { "tips": ["tip1", "tip2", "tip3"] }`;

  const user = `
Profil:
- Utdanningsprogram: ${laerling.utdanningsprogram}
- Bio: ${laerling.bio || 'Ingen bio skrevet ennå'}
- Har CV: ${laerling.cv_url ? 'Ja' : 'Nei'}`;

  const raw = await callClaude(system, user);
  return JSON.parse(raw);
}
```

---

## Express-rute for AI

```javascript
// routes/ai.js
import express from 'express';
import { matchLaerlingTilPlasser } from '../tools/ai_match.js';
import { oppsummerSoknad } from '../tools/ai_oppsummer.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/match', requireAuth, async (req, res) => {
  try {
    const { laerling_id } = req.body;
    // hent laerling og plasser fra DB
    const resultater = await matchLaerlingTilPlasser(laerling, plasser);
    res.json(resultater);
  } catch (err) {
    res.status(500).json({ error: 'Matching feilet. Prøv igjen.' });
  }
});

export default router;
```

---

## Kostnadsbevissthet

- Claude Sonnet 4 koster ca $3 per million input-tokens
- En matching-forespørsel er ~500 tokens = brøkdel av en øre
- **Cache vanlige prompts** hvis du kaller dem ofte
- **Ikke kall AI på hvert tastetrykk** — kall ved eksplisitt handling (klikk på "Finn match")
- Logg AI-kall i `.tmp/ai_log.jsonl` for debugging

---

## Feilhåndtering

```javascript
try {
  const resultat = await callClaude(system, user);
  return JSON.parse(resultat);
} catch (err) {
  if (err instanceof SyntaxError) {
    // Claude returnerte ikke gyldig JSON — retry med klarere prompt
    console.error('JSON parse feil fra Claude:', resultat);
  }
  throw new Error('AI-tjenesten er midlertidig utilgjengelig');
}
```
