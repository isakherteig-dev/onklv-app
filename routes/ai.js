import { Router } from 'express';
import { krevAuth, krevRolle } from '../middleware/auth.js';
import { adminDB } from '../firebase/config.js';
import { getDB } from '../db/init.js';
import { matchLaerlingTilPlasser } from '../tools/ai_match.js';
import { oppsummerSoknad } from '../tools/ai_oppsummer.js';
import { forbedreProfil } from '../tools/ai_tips.js';

const ruter = Router();

/**
 * POST /api/ai/match
 * Matcher innlogget lærling mot alle aktive læreplasser.
 * Returnerer læreplassene sortert etter match-score.
 */
ruter.post('/match', krevAuth, krevRolle('laerling'), async (req, res) => {
  try {
    const laerling = {
      utdanningsprogram: req.user.utdanningsprogram,
      bio: req.user.bio
    };

    const db = getDB();
    const plasser = db.prepare(`
      SELECT id, tittel, beskrivelse, bransje, fagomraade
      FROM laereplasser
      WHERE aktiv = 1
    `).all();

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
 * Body: { soknad_id: number }
 */
ruter.post('/oppsummer', krevAuth, krevRolle('admin'), async (req, res) => {
  const { soknad_id } = req.body;

  if (!soknad_id) {
    return res.status(400).json({ feil: 'soknad_id er påkrevd' });
  }

  try {
    const db = getDB();
    const soknad = db.prepare(`
      SELECT s.*, l.tittel AS laerplass_tittel, l.bedrift_naam
      FROM soknader s
      JOIN laereplasser l ON s.laerplass_id = l.id
      WHERE s.id = ?
    `).get(soknad_id);

    if (!soknad) {
      return res.status(404).json({ feil: 'Søknaden ble ikke funnet' });
    }

    // Hent lærlingprofil fra Firestore
    const userDoc = await adminDB.collection('users').doc(soknad.laerling_user_id).get();
    const laerlingData = userDoc.exists ? userDoc.data() : {};

    const laerling = {
      navn: soknad.laerling_naam || laerlingData.navn || 'Ukjent',
      bio: laerlingData.bio || null,
      utdanningsprogram: soknad.utdanningsprogram || laerlingData.utdanningsprogram || null
    };

    const soknadData = {
      melding: soknad.melding,
      erfaring: soknad.erfaring
    };

    const laerplass = {
      tittel: soknad.laerplass_tittel,
      bedrift_naam: soknad.bedrift_naam
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
ruter.post('/tips', krevAuth, krevRolle('laerling'), async (req, res) => {
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

export default ruter;
