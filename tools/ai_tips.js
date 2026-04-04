import { callClaude } from './ai_client.js';

const SYSTEM_PROMPT = `Du er karriereveileder for norske lærlinger (16-20 år).
Analyser HELE profilen grundig og gi 3-5 konkrete, motiverende og vennlige tips for å forbedre den.
Se på hva som mangler, hva som kan skrives bedre, og hva som er bra.
Bruk enkel norsk bokmål. Snakk direkte til lærlingen (du-form).
Vær spesifikk — referer til det lærlingen faktisk har skrevet.
Du returnerer KUN gyldig JSON, ingen forklaring, ingen markdown, ingen kodeblokker.
Format: { "tips": ["tip1", "tip2", "tip3"] }`;

export async function forbedreProfil(laerling) {
  const ferdigheterTekst = (laerling.ferdigheter || []).length > 0
    ? laerling.ferdigheter.map(f => `${f.navn} (${f.prosent}%)`).join(', ')
    : 'Ingen ferdigheter lagt til';

  const referanserTekst = (laerling.referanser || []).length > 0
    ? laerling.referanser.map(r => `${r.navn} (${r.rolle}): "${r.tekst}"`).join('\n  ')
    : 'Ingen referanser';

  const tidslinjeTekst = (laerling.tidslinje || []).length > 0
    ? laerling.tidslinje.map(t => `${t.tittel} (${t.type}, ${t.dato}): ${t.beskrivelse}`).join('\n  ')
    : 'Ingen erfaring/utdanning lagt til';

  const portefoljeTekst = (laerling.portefolje || []).length > 0
    ? laerling.portefolje.map(p => `${p.tittel}: ${p.beskrivelse}`).join('\n  ')
    : 'Ingen prosjekter';

  const dagerTekst = (laerling.tilgjengeligeDager || []).length > 0
    ? laerling.tilgjengeligeDager.join(', ')
    : 'Ikke oppgitt';

  const user = `
Profil å analysere:
- Utdanningsprogram: ${laerling.utdanningsprogram || 'Ikke oppgitt'}
- Om meg (bio): ${laerling.bio || 'Ikke skrevet ennå'}
- Har lastet opp CV: ${laerling.cv_filnavn ? 'Ja (' + laerling.cv_filnavn + ')' : 'Nei'}
- Motivasjonstekst: ${laerling.motivasjon || 'Ikke skrevet ennå'}
- Ferdigheter: ${ferdigheterTekst}
- Referanser: ${referanserTekst}
- Erfaring/utdanning (tidslinje): ${tidslinjeTekst}
- Portefølje/prosjekter: ${portefoljeTekst}
- Sted: ${laerling.sted || 'Ikke oppgitt'}
- Kan starte: ${laerling.kanStarte || 'Ikke oppgitt'}
- Stillingsprosent: ${laerling.stillingsprosent || 'Ikke oppgitt'}
- Tilgjengelige dager: ${dagerTekst}

Gi konkrete tips basert på hva som mangler og hva som kan forbedres.`;

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
