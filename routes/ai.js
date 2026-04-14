import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { krevAuth, krevRolle } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import { adminDB } from '../firebase/config.js';
import { matchLaerlingTilPlasser } from '../tools/ai_match.js';
import { oppsummerSoknad } from '../tools/ai_oppsummer.js';
import { forbedreProfil } from '../tools/ai_tips.js';
import { bedriftHarRelasjonTilLaerling } from '../utils/relasjonssjekk.js';

// Maks 10 AI-kall per bruker per minutt
const aiLimit = rateLimiter(10, 60_000);
const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? process.env.LOCAL_ANTHROPIC_API_KEY;

const ruter = Router();

/**
 * POST /api/ai/match
 * Matcher innlogget lærling mot alle aktive læreplasser.
 */
ruter.post('/match', krevAuth, aiLimit, krevRolle('laerling'), async (req, res) => {
  try {
    // Hent full profildata for bedre matching
    const profilDoc = await adminDB.collection('users').doc(req.user.uid)
      .collection('profilData').doc('main').get();
    const profilData = profilDoc.exists ? profilDoc.data() : {};

    const laerling = {
      utdanningsprogram: req.user.utdanningsprogram,
      bio: req.user.bio,
      ferdigheter: profilData.ferdigheter || [],
      motivasjon: profilData.motivasjon || null,
      tidslinje: profilData.tidslinje || [],
      sted: profilData.sted || null,
      kanStarte: profilData.kanStarte || null
    };

    const snap = await adminDB.collection('laereplasser')
      .where('aktiv', '==', true)
      .get();

    const plasser = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        tittel: data.tittel,
        beskrivelse: data.beskrivelse,
        bransje: data.bransje,
        fagomraade: data.fagomraade,
        sted: data.sted || null,
        krav: data.krav || null,
        start_dato: data.start_dato || null,
        antall_plasser: data.antall_plasser || 1
      };
    });

    if (plasser.length === 0) {
      return res.status(200).json({ resultater: [], melding: 'Ingen aktive læreplasser å matche mot akkurat nå' });
    }

    const resultat = await matchLaerlingTilPlasser(laerling, plasser);
    res.json(resultat);
  } catch (err) {
    console.error('AI match feil:', err.message);
    const melding = err.message.startsWith('AI-tjenesten')
      ? err.message
      : 'AI-tjenesten er midlertidig utilgjengelig. Prøv igjen.';
    res.status(500).json({ feil: melding });
  }
});

/**
 * POST /api/ai/oppsummer
 * Lager AI-sammendrag av en søknad for admin.
 */
ruter.post('/oppsummer', krevAuth, aiLimit, krevRolle('admin'), async (req, res) => {
  const { soknad_id } = req.body;

  if (!soknad_id) {
    return res.status(400).json({ feil: 'soknad_id er påkrevd' });
  }

  try {
    const sokDoc = await adminDB.collection('soknader').doc(soknad_id).get();
    if (!sokDoc.exists) {
      return res.status(404).json({ feil: 'Søknaden ble ikke funnet' });
    }

    const soknad = sokDoc.data();
    const [plassDoc, userDoc] = await Promise.all([
      adminDB.collection('laereplasser').doc(soknad.laerplass_id).get(),
      adminDB.collection('users').doc(soknad.laerling_user_id).get()
    ]);

    const plassData = plassDoc.exists ? plassDoc.data() : {};
    const laerlingData = userDoc.exists ? userDoc.data() : {};

    const laerling = {
      navn: soknad.laerling_navn || soknad.laerling_naam || laerlingData.navn || 'Ukjent',
      bio: laerlingData.bio || null,
      utdanningsprogram: soknad.utdanningsprogram || laerlingData.utdanningsprogram || null
    };

    const soknadData = { melding: soknad.melding, erfaring: soknad.erfaring };

    const laerplass = {
      tittel: plassData.tittel,
      bedrift_navn: plassData.bedrift_navn
    };

    const oppsummering = await oppsummerSoknad(laerling, soknadData, laerplass);
    res.json({ oppsummering });
  } catch (err) {
    console.error('AI oppsummer feil:', err.message);
    const melding = err.message.startsWith('AI-tjenesten')
      ? err.message
      : 'AI-tjenesten er midlertidig utilgjengelig. Prøv igjen.';
    res.status(500).json({ feil: melding });
  }
});

/**
 * POST /api/ai/tips
 * Gir lærlingen 3 konkrete tips for å forbedre profilen.
 */
ruter.post('/tips', krevAuth, aiLimit, krevRolle('laerling'), async (req, res) => {
  try {
    // Hent profilData/main for å gi AI full oversikt
    const profilDoc = await adminDB.collection('users').doc(req.user.uid)
      .collection('profilData').doc('main').get();
    const profilData = profilDoc.exists ? profilDoc.data() : {};

    const laerling = {
      utdanningsprogram: req.user.utdanningsprogram,
      bio: req.user.bio,
      cv_filnavn: req.user.cv_filnavn,
      ferdigheter: profilData.ferdigheter || [],
      motivasjon: profilData.motivasjon || null,
      referanser: profilData.referanser || [],
      tidslinje: profilData.tidslinje || [],
      portefolje: profilData.portefolje || [],
      sted: profilData.sted || null,
      kanStarte: profilData.kanStarte || null,
      stillingsprosent: profilData.stillingsprosent || null,
      tilgjengeligeDager: profilData.tilgjengeligeDager || []
    };

    const resultat = await forbedreProfil(laerling);
    res.json(resultat);
  } catch (err) {
    console.error('AI tips feil:', err.message);
    const melding = err.message.startsWith('AI-tjenesten')
      ? err.message
      : 'AI-tjenesten er midlertidig utilgjengelig. Prøv igjen.';
    res.status(500).json({ feil: melding });
  }
});

/**
 * POST /api/ai/chat
 * Fri samtale med AI-assistenten.
 */
ruter.post('/chat', krevAuth, aiLimit, async (req, res) => {
  const { target_uid, messages, soknad_id } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ feil: 'messages er påkrevd' });
  }

  if (!anthropicApiKey) {
    return res.status(503).json({ feil: 'AI-tjenesten er ikke satt opp ennå' });
  }

  // Hent søknadsdata hvis soknad_id er oppgitt
  let soknadData = null;
  let plassData = null;
  if (soknad_id) {
    if (req.user.rolle !== 'admin') {
      return res.status(403).json({ feil: 'Kun admin kan bruke soknad_id' });
    }
    try {
      const sokDoc = await adminDB.collection('soknader').doc(soknad_id).get();
      if (sokDoc.exists) {
        soknadData = sokDoc.data();
        if (soknadData.laerplass_id) {
          const plassDoc = await adminDB.collection('laereplasser').doc(soknadData.laerplass_id).get();
          if (plassDoc.exists) plassData = plassDoc.data();
        }
      }
    } catch (soknadErr) {
      console.error('Kunne ikke hente søknadsdata for AI-chat:', soknadErr.message);
    }
  }

  // Bygg system-prompt på serveren — aldri stol på klientens system-prompt
  const uid = target_uid || (soknadData?.laerling_user_id) || req.user.uid;

  if (uid !== req.user.uid) {
    if (req.user.rolle === 'admin') {
      // Admin har alltid tilgang
    } else if (req.user.rolle === 'bedrift') {
      const harRelasjon = await bedriftHarRelasjonTilLaerling(req.user.uid, uid);
      if (!harRelasjon) {
        return res.status(403).json({ feil: 'Ingen tilgang — ingen aktiv søknad/relasjon' });
      }
    } else {
      return res.status(403).json({ feil: 'Ingen tilgang' });
    }
  }

  let systemPrompt = 'Du er OLKV sin AI-assistent. Svar alltid på norsk. Vær profesjonell og hjelpsom.';

  try {
    const [userDoc, profilDoc] = await Promise.all([
      adminDB.collection('users').doc(uid).get(),
      adminDB.collection('users').doc(uid).collection('profilData').doc('main').get()
    ]);

    const brukerData = userDoc.exists ? userDoc.data() : {};
    const profilData = profilDoc.exists ? profilDoc.data() : {};

    systemPrompt = `Du er OLKV sin AI-assistent. Her er lærlingprofilen du hjelper med:
Navn: [anonymisert]
Fagområde: ${brukerData.utdanningsprogram || 'Ikke oppgitt'}
Sted: ${profilData.sted || 'Ikke oppgitt'}
Motivasjon: ${profilData.motivasjon || 'Ikke oppgitt'}
Ferdigheter: ${(profilData.ferdigheter || []).map(f => f.navn + ' ' + f.prosent + '%').join(', ') || 'Ikke oppgitt'}
Erfaring: ${(profilData.tidslinje || []).map(t => t.tittel).join(', ') || 'Ikke oppgitt'}
Referanser fra: ${(profilData.referanser || []).map((r, i) => 'Referanse ' + (i + 1) + ' (' + r.rolle + ')').join(', ') || 'Ingen'}`;

    if (soknadData && plassData) {
      systemPrompt += `

Søknad:
Læreplass: ${plassData.tittel || 'Ikke oppgitt'} hos ${plassData.bedrift_navn || 'Ikke oppgitt'}
Fagområde: ${plassData.fagomraade || 'Ikke oppgitt'}
Motivasjon: ${soknadData.melding || 'Ikke oppgitt'}
Erfaring: ${soknadData.erfaring || 'Ikke oppgitt'}
Status: ${soknadData.status || 'Ikke oppgitt'}
VG1: ${soknadData.vg1 || '—'} VG2: ${soknadData.vg2 || '—'}`;
    }

    systemPrompt += '\nSvar alltid på norsk. Vær profesjonell og hjelpsom.';
  } catch (profilErr) {
    console.error('Kunne ikke hente profildata for AI-chat:', profilErr.message);
  }

  try {
    const client = new Anthropic({ apiKey: anthropicApiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    });

    res.json({ svar: response.content[0].text });
  } catch (err) {
    console.error('AI chat feil:', err.message);
    res.status(500).json({ feil: 'AI-assistenten er ikke tilgjengelig akkurat nå. Prøv igjen senere.' });
  }
});

/**
 * POST /api/ai/generer-annonse
 * Genererer en læreplassannonse basert på bedriftens profil.
 */
ruter.post('/generer-annonse', krevAuth, aiLimit, krevRolle('bedrift'), async (req, res) => {
  const { fagomraade, sted } = req.body;

  if (!anthropicApiKey) {
    return res.status(503).json({ feil: 'AI-tjenesten er ikke satt opp ennå' });
  }

  try {
    const client = new Anthropic({ apiKey: anthropicApiKey });

    const systemPrompt = `Du er en assistent for norske lærebedrifter som skal skrive læreplassannonser.
Generer en profesjonell og engasjerende læreplassannonse.
Du returnerer KUN gyldig JSON, ingen forklaring, ingen markdown, ingen kodeblokker.
Format: { "tittel": "string", "beskrivelse": "string", "krav": "string", "fagomraade": "string", "sted": "string" }
Skriv på norsk bokmål. Vær konkret og realistisk. Beskrivelsen bør være 3-5 setninger. Krav bør liste 2-4 punkter separert med punktum.`;

    const userMsg = `Bedrift: ${req.user.navn || 'Ukjent bedrift'}
Bransje: ${req.user.bransje || 'Ikke oppgitt'}
Fagområde ønsket: ${fagomraade || 'Ikke valgt'}
Sted: ${sted || 'Ikke oppgitt'}

Generer en læreplassannonse for denne bedriften.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }]
    });

    const raw = response.content[0].text;
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    console.error('AI generer-annonse feil:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(500).json({ feil: 'AI returnerte ugyldig svar. Prøv igjen.' });
    }
    res.status(500).json({ feil: 'Kunne ikke generere annonse. Prøv igjen.' });
  }
});

export default ruter;
