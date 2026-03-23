import { Router } from 'express';
import { adminDB } from '../firebase/config.js';
import { krevAuth } from '../middleware/auth.js';

const ruter = Router();
const col = () => adminDB.collection('varsler');

function docTilObj(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    ...d,
    opprettet: d.opprettet?.toDate?.()?.toISOString?.() ?? d.opprettet ?? null
  };
}

// GET /api/varsler — hent innlogget brukers varsler
ruter.get('/', krevAuth, async (req, res) => {
  try {
    const snap = await col()
      .where('mottaker_id', '==', req.user.uid)
      .orderBy('opprettet', 'desc')
      .limit(50)
      .get();

    let varsler = snap.docs.map(docTilObj);

    // Admin ser også generiske admin-varsler
    if (req.user.rolle === 'admin') {
      const adminSnap = await col()
        .where('mottaker_id', '==', 'admin')
        .orderBy('opprettet', 'desc')
        .limit(50)
        .get();

      const adminVarsler = adminSnap.docs.map(docTilObj);
      varsler = [...varsler, ...adminVarsler]
        .sort((a, b) => new Date(b.opprettet) - new Date(a.opprettet))
        .slice(0, 50);
    }

    res.json(varsler);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente varsler' });
  }
});

// GET /api/varsler/antall-uleste
ruter.get('/antall-uleste', krevAuth, async (req, res) => {
  try {
    const snap = await col()
      .where('mottaker_id', '==', req.user.uid)
      .where('lest', '==', false)
      .count().get();

    let antall = snap.data().count;

    if (req.user.rolle === 'admin') {
      const adminSnap = await col()
        .where('mottaker_id', '==', 'admin')
        .where('lest', '==', false)
        .count().get();
      antall += adminSnap.data().count;
    }

    res.json({ antall });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente antall uleste' });
  }
});

// PATCH /api/varsler/les-alle — marker alle som lest
ruter.patch('/les-alle', krevAuth, async (req, res) => {
  try {
    const batch = adminDB.batch();

    const snap = await col()
      .where('mottaker_id', '==', req.user.uid)
      .where('lest', '==', false)
      .get();
    snap.docs.forEach(d => batch.update(d.ref, { lest: true }));

    if (req.user.rolle === 'admin') {
      const adminSnap = await col()
        .where('mottaker_id', '==', 'admin')
        .where('lest', '==', false)
        .get();
      adminSnap.docs.forEach(d => batch.update(d.ref, { lest: true }));
    }

    await batch.commit();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke markere varsler som lest' });
  }
});

// PATCH /api/varsler/:id/lest — marker ett varsel som lest
ruter.patch('/:id/lest', krevAuth, async (req, res) => {
  try {
    const ref = col().doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ feil: 'Varsel ikke funnet' });

    const d = doc.data();
    const harTilgang =
      d.mottaker_id === req.user.uid ||
      (req.user.rolle === 'admin' && d.mottaker_id === 'admin');

    if (!harTilgang) return res.status(403).json({ feil: 'Ikke tilgang' });

    await ref.update({ lest: true });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke markere varsel som lest' });
  }
});

export default ruter;
