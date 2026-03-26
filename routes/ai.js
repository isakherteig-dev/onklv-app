import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { krevAuth, krevRolle } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import { adminDB } from '../firebase/config.js';
import { matchLaerlingTilPlasser } from '../tools/ai_match.js';
import { oppsummerSoknad } from '../tools/ai_oppsummer.js';
import { forbedreProfil } from '../tools/ai_tips.js';

// Maks 10 AI-kall per bruker per minutt
const aiLimit = rateLimiter(10, 60_000);

const ruter = Router();

/**
 * POST /api/ai/match
 * Matcher innlogget lærling mot alle aktive læreplasser.
 */
ruter.post('/match', krevAuth, aiLimit, krevRolle('laerling'), async (req, res) => {
  try {
    const laerling = {
      utdanningsprogram: req.user.utdanningsprogram,
      bio: req.user.bio
    };

    const snap = await adminDB.collection('laereplasser')
      .where('aktiv', '==', true)
      .get();

    const plasser = snap.docs.map(d => ({
      id: d.id,
      tittel: d.data().tittel,
      beskrivelse: d.data().beskrivelse,
      bransje: d.data().bransje,
      fagomraade: d.data().fagomraade
    }));

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
      navn: soknad.laerling_naam || laerlingData.navn || 'Ukjent',
      bio: laerlingData.bio || null,
      utdanningsprogram: soknad.utdanningsprogram || laerlingData.utdanningsprogram || null
    };

    const soknadData = { melding: soknad.melding, erfaring: soknad.erfaring };

    const laerplass = {
      tittel: plassData.tittel,
      bedrift_naam: plassData.bedrift_navn
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
    const laerling = {
      utdanningsprogram: req.user.utdanningsprogram,
      bio: req.user.bio,
      cv_filnavn: req.user.cv_filnavn
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
  const { system, messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ feil: 'messages er påkrevd' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ feil: 'AI-tjenesten er ikke satt opp ennå' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: system || 'Du er OLKV sin AI-assistent. Svar alltid på norsk.',
      messages
    });

    res.json({ svar: response.content[0].text });
  } catch (err) {
    console.error('AI chat feil:', err.message);
    res.status(500).json({ feil: 'AI-assistenten er ikke tilgjengelig akkurat nå. Prøv igjen senere.' });
  }
});

export default ruter;
