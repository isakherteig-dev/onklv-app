import { callClaude } from './ai_client.js';

const SYSTEM_PROMPT = `Du er assistent for et norsk opplæringskontor.
Lag korte, nøytrale og saklige oppsummeringer av søknader for saksbehandlere.
Maks 3 setninger. Norsk bokmål. Fokuser på relevant bakgrunn og motivasjon.`;

/**
 * Lager en kort oppsummering av en søknad for admin.
 * @param {{ navn: string, bio: string, utdanningsprogram: string }} laerling
 * @param {{ melding: string, erfaring: string }} soknad
 * @param {{ tittel: string, bedrift_naam: string }} laerplass
 * @returns {Promise<string>} - Oppsummering på 2-3 setninger
 */
export async function oppsummerSoknad(laerling, soknad, laerplass) {
  const user = `
Søknad fra: ${laerling.navn}
Søker på: ${laerplass.tittel} hos ${laerplass.bedrift_naam}
Utdanningsprogram: ${laerling.utdanningsprogram || 'Ikke oppgitt'}
Om søkeren: ${laerling.bio || 'Ingen beskrivelse'}
Søknadsmelding: ${soknad.melding || 'Ingen melding'}
Tidligere erfaring: ${soknad.erfaring || 'Ikke oppgitt'}

Lag en kort oppsummering for saksbehandler.`;

  return await callClaude(SYSTEM_PROMPT, user);
}
