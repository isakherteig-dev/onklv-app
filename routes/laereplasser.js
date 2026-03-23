import { Router } from 'express';
import { adminDB } from '../firebase/config.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const ruter = Router();
const col = () => adminDB.collection('laereplasser');

function docTilObj(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    ...d,
    // Konverter Firestore Timestamp til ISO-streng
    opprettet: d.opprettet?.toDate?.()?.toISOString?.() ?? d.opprettet ?? null
  };
}

// GET /api/laereplasser — alle aktive læreplasser (åpen)
ruter.get('/', async (_req, res) => {
  try {
    const snap = await col()
      .where('aktiv', '==', true)
      .orderBy('opprettet', 'desc')
      .get();
    res.json(snap.docs.map(docTilObj));
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente læreplasser' });
  }
});

// GET /api/laereplasser/alle — admin: alle inkl inaktive
ruter.get('/alle', krevAuth, krevRolle('admin'), async (req, res) => {
  try {
    const { status, fagomraade, sok } = req.query;
    let q = col();
    if (status === 'aktiv')   q = q.where('aktiv', '==', true);
    if (status === 'inaktiv') q = q.where('aktiv', '==', false);
    if (fagomraade)           q = q.where('fagomraade', '==', fagomraade);
    q = q.orderBy('opprettet', 'desc');

    const snap = await q.get();
    let plasser = snap.docs.map(docTilObj);

    if (sok) {
      const s = sok.toLowerCase();
      plasser = plasser.filter(p =>
        p.tittel?.toLowerCase().includes(s) ||
        p.bedrift_navn?.toLowerCase().includes(s)
      );
    }

    // Hent søknadsantall for hvert oppslag
    const med = await Promise.all(plasser.map(async p => {
      const antSnap = await adminDB.collection('soknader')
        .where('laerplass_id', '==', p.id)
        .count().get();
      return { ...p, antall_soknader: antSnap.data().count };
    }));

    res.json(med);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente læreplasser' });
  }
});

// GET /api/laereplasser/mine — bedriftens egne annonser
ruter.get('/mine', krevAuth, krevRolle('bedrift'), async (req, res) => {
  try {
    const snap = await col()
      .where('bedrift_user_id', '==', req.user.uid)
      .orderBy('opprettet', 'desc')
      .get();

    const plasser = snap.docs.map(docTilObj);

    const med = await Promise.all(plasser.map(async p => {
      const antSnap = await adminDB.collection('soknader')
        .where('laerplass_id', '==', p.id)
        .count().get();
      return { ...p, antall_soknader: antSnap.data().count };
    }));

    res.json(med);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente dine læreplasser' });
  }
});

// GET /api/laereplasser/:id — én læreplass
ruter.get('/:id', async (req, res) => {
  try {
    const doc = await col().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ feil: 'Læreplass ikke funnet' });

    const antSnap = await adminDB.collection('soknader')
      .where('laerplass_id', '==', req.params.id)
      .count().get();

    res.json({ ...docTilObj(doc), antall_soknader: antSnap.data().count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente læreplass' });
  }
});

// POST /api/laereplasser — ny annonse (bedrift eller admin)
ruter.post('/', krevAuth, krevRolle('bedrift', 'admin'), async (req, res) => {
  const {
    tittel, beskrivelse, sted, frist, antall_plasser,
    fagomraade, krav, start_dato, kontaktperson, kontakt_epost,
    bedrift_user_id: overrideBedriftId,
    bedrift_navn: overrideBedriftNavn
  } = req.body;

  if (!tittel || !frist) {
    return res.status(400).json({ feil: 'Tittel og frist er påkrevd' });
  }

  const bedriftId   = req.user.rolle === 'admin' ? (overrideBedriftId || req.user.uid) : req.user.uid;
  const bedriftNavn = req.user.rolle === 'admin' ? (overrideBedriftNavn || req.user.navn) : (req.user.navn || null);

  try {
    const ref = await col().add({
      bedrift_user_id: bedriftId,
      bedrift_navn:    bedriftNavn,
      tittel,
      beskrivelse:     beskrivelse || null,
      sted:            sted || null,
      bransje:         fagomraade || req.user.bransje || null,
      fagomraade:      fagomraade || null,
      krav:            krav || null,
      start_dato:      start_dato || null,
      kontaktperson:   kontaktperson || null,
      kontakt_epost:   kontakt_epost || null,
      frist,
      antall_plasser:  antall_plasser || 1,
      aktiv:           true,
      opprettet:       new Date()
    });

    res.status(201).json({ ok: true, id: ref.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke opprette læreplassen' });
  }
});

// PATCH /api/laereplasser/:id — oppdater annonse
ruter.patch('/:id', krevAuth, krevRolle('bedrift', 'admin'), async (req, res) => {
  try {
    const ref = col().doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ feil: 'Annonse ikke funnet' });
    if (req.user.rolle !== 'admin' && doc.data().bedrift_user_id !== req.user.uid) {
      return res.status(403).json({ feil: 'Ikke tilgang' });
    }

    const felter = [
      'tittel', 'beskrivelse', 'sted', 'frist', 'antall_plasser',
      'fagomraade', 'bransje', 'krav', 'start_dato',
      'kontaktperson', 'kontakt_epost', 'aktiv'
    ];
    const oppdatering = {};
    for (const f of felter) {
      if (req.body[f] !== undefined) oppdatering[f] = req.body[f];
    }

    await ref.update(oppdatering);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke oppdatere læreplassen' });
  }
});

// DELETE /api/laereplasser/:id — slett annonse
ruter.delete('/:id', krevAuth, krevRolle('bedrift', 'admin'), async (req, res) => {
  try {
    const ref = col().doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ feil: 'Annonse ikke funnet' });
    if (req.user.rolle !== 'admin' && doc.data().bedrift_user_id !== req.user.uid) {
      return res.status(403).json({ feil: 'Ikke tilgang' });
    }

    await ref.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke slette læreplassen' });
  }
});

export default ruter;
