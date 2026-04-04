import { callClaude } from './ai_client.js';

const SYSTEM_PROMPT = `Du er et matching-system for norske lærlinger og lærebedrifter.
Analyser lærlingens HELE profil grundig — ferdigheter, erfaring, motivasjon, sted og utdanning.
Sammenlign dette med hver læreplasses krav, fagområde, sted og beskrivelse.
Vær spesifikk i begrunnelsen — referer til konkrete ting fra profilen og stillingen.
Du returnerer KUN gyldig JSON, ingen forklaring, ingen markdown, ingen kodeblokker.
Format: { "resultater": [{ "laerplass_id": "string", "score": number, "begrunnelse": string }] }
Score er 0-100. Begrunnelse er maks 2 setninger på norsk bokmål.
Sorter fra høyest til lavest score.`;

export async function matchLaerlingTilPlasser(laerling, plasser) {
  const ferdigheterTekst = (laerling.ferdigheter || []).length > 0
    ? laerling.ferdigheter.map(f => f.navn + ' (' + f.prosent + '%)').join(', ')
    : 'Ingen ferdigheter oppgitt';

  const tidslinjeTekst = (laerling.tidslinje || []).length > 0
    ? laerling.tidslinje.map(t => t.tittel + ' (' + t.type + ', ' + t.dato + ')').join(', ')
    : 'Ingen erfaring lagt til';

  const user = `
Lærlingprofil:
- Utdanningsprogram: ${laerling.utdanningsprogram || 'Ikke oppgitt'}
- Om meg: ${laerling.bio || 'Ingen beskrivelse'}
- Motivasjon: ${laerling.motivasjon || 'Ikke skrevet'}
- Ferdigheter: ${ferdigheterTekst}
- Erfaring/utdanning: ${tidslinjeTekst}
- Sted: ${laerling.sted || 'Ikke oppgitt'}
- Kan starte: ${laerling.kanStarte || 'Ikke oppgitt'}

Ledige læreplasser:
${plasser.map(p => `ID ${p.id}: "${p.tittel}" (${p.fagomraade || p.bransje || 'Ukjent fag'})
  Bedrift-beskrivelse: ${p.beskrivelse || 'Ingen beskrivelse'}
  Sted: ${p.sted || 'Ikke oppgitt'}
  Krav: ${p.krav || 'Ingen spesifikke krav oppgitt'}
  Startdato: ${p.start_dato || 'Ikke oppgitt'}
  Plasser: ${p.antall_plasser}`).join('\n\n')}

Ranger læreplassene fra best til dårligst match for denne lærlingen. Vær konkret i begrunnelsen.`;

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
