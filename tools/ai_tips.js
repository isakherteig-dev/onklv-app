import { callClaude } from './ai_client.js';

const SYSTEM_PROMPT = `Du er karriereveileder for norske lærlinger (16-20 år).
Gi 3 konkrete, motiverende og vennlige tips for å forbedre profilen.
Bruk enkel norsk bokmål. Snakk direkte til lærlingen (du-form).
Du returnerer KUN gyldig JSON, ingen forklaring, ingen markdown, ingen kodeblokker.
Format: { "tips": ["tip1", "tip2", "tip3"] }`;

/**
 * Genererer 3 konkrete tips for å forbedre lærlingprofilen.
 * @param {{ utdanningsprogram: string, bio: string, cv_filnavn: string|null }} laerling
 * @returns {Promise<{ tips: string[] }>}
 */
export async function forbedreProfil(laerling) {
  const user = `
Profil:
- Utdanningsprogram: ${laerling.utdanningsprogram || 'Ikke oppgitt'}
- Om meg: ${laerling.bio || 'Ingen beskrivelse skrevet ennå'}
- Har lastet opp CV: ${laerling.cv_filnavn ? 'Ja' : 'Nei'}`;

  let raw;
  try {
    raw = await callClaude(SYSTEM_PROMPT, user);
    return JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
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
