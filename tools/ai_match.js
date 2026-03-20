import { callClaude } from './ai_client.js';

const SYSTEM_PROMPT = `Du er et matching-system for norske lærlinger og lærebedrifter.
Du returnerer KUN gyldig JSON, ingen forklaring, ingen markdown, ingen kodeblokker.
Format: { "resultater": [{ "laerplass_id": number, "score": number, "begrunnelse": string }] }
Score er 0-100. Begrunnelse er maks 2 setninger på norsk bokmål.
Sorter fra høyest til lavest score.`;

/**
 * Matcher en lærling mot en liste av læreplasser og gir score for hver.
 * @param {{ utdanningsprogram: string, bio: string }} laerling
 * @param {{ id: number, tittel: string, beskrivelse: string, bransje: string, fagomraade: string }[]} plasser
 * @returns {Promise<{ resultater: { laerplass_id: number, score: number, begrunnelse: string }[] }>}
 */
export async function matchLaerlingTilPlasser(laerling, plasser) {
  const user = `
Lærling:
- Utdanningsprogram: ${laerling.utdanningsprogram || 'Ikke oppgitt'}
- Om meg: ${laerling.bio || 'Ingen beskrivelse'}

Ledige læreplasser:
${plasser.map(p => `ID ${p.id}: ${p.tittel} (${p.bransje || p.fagomraade || 'Ukjent bransje'}) — ${p.beskrivelse || 'Ingen beskrivelse'}`).join('\n')}

Ranger læreplassene fra best til dårligst match for denne lærlingen.`;

  let raw;
  try {
    raw = await callClaude(SYSTEM_PROMPT, user);
    return JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Én retry med klarere prompt
      try {
        raw = await callClaude(SYSTEM_PROMPT + '\nVIKTIG: Svar kun med JSON, ingenting annet.', user);
        return JSON.parse(raw);
      } catch {
        throw new Error('AI-tjenesten returnerte ugyldig svar. Prøv igjen.');
      }
    }
    throw err;
  }
}
