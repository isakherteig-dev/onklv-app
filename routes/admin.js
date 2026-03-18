import { Router } from 'express';
import { adminAuth, adminDB } from '../firebase/config.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const ruter = Router();

// Alle admin-ruter krever innlogging og admin-rolle
ruter.use(krevAuth, krevRolle('admin'));

/**
 * GET /api/admin/bedrifter-venter
 * Henter alle bedrifter som venter godkjenning.
 */
ruter.get('/bedrifter-venter', async (req, res) => {
  try {
    const snapshot = await adminDB.collection('users')
      .where('rolle', '==', 'bedrift')
      .where('godkjent', '==', false)
      .where('aktiv', '==', true)
      .orderBy('opprettet', 'desc')
      .get();

    const bedrifter = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        uid: d.uid,
        navn: d.navn,
        epost: d.epost,
        orgNr: d.orgNr,
        bransje: d.bransje,
        opprettet: d.opprettet
      };
    });

    res.json(bedrifter);
  } catch (err) {
    console.error('Feil ved henting av ventende bedrifter:', err);
    res.status(500).json({ feil: 'Kunne ikke hente bedrifter' });
  }
});

/**
 * PATCH /api/admin/bedrifter/:uid/godkjenn
 * Godkjenner en bedrift. Oppdaterer Firestore + setter custom claim.
 */
ruter.patch('/bedrifter/:uid/godkjenn', async (req, res) => {
  const { uid } = req.params;

  try {
    const ref = adminDB.collection('users').doc(uid);
    const doc = await ref.get();

    if (!doc.exists || doc.data().rolle !== 'bedrift') {
      return res.status(404).json({ feil: 'Bedrift ikke funnet' });
    }

    await ref.update({ godkjent: true });
    await adminAuth.setCustomUserClaims(uid, { rolle: 'bedrift' });

    res.json({ ok: true });
  } catch (err) {
    console.error('Feil ved godkjenning av bedrift:', err);
    res.status(500).json({ feil: 'Kunne ikke godkjenne bedrift' });
  }
});

/**
 * PATCH /api/admin/bedrifter/:uid/avvis
 * Avviser / deaktiverer en bedrift.
 */
ruter.patch('/bedrifter/:uid/avvis', async (req, res) => {
  const { uid } = req.params;

  try {
    const ref = adminDB.collection('users').doc(uid);
    const doc = await ref.get();

    if (!doc.exists || doc.data().rolle !== 'bedrift') {
      return res.status(404).json({ feil: 'Bedrift ikke funnet' });
    }

    await ref.update({ aktiv: false });

    res.json({ ok: true });
  } catch (err) {
    console.error('Feil ved avvisning av bedrift:', err);
    res.status(500).json({ feil: 'Kunne ikke avvise bedrift' });
  }
});

/**
 * GET /api/admin/statistikk
 * Henter overordnet statistikk for admin-dashbordet.
 */
ruter.get('/statistikk', async (req, res) => {
  try {
    const [laerlinger, bedrifterAktive, bedrifterVenter] = await Promise.all([
      adminDB.collection('users').where('rolle', '==', 'laerling').count().get(),
      adminDB.collection('users').where('rolle', '==', 'bedrift').where('godkjent', '==', true).count().get(),
      adminDB.collection('users').where('rolle', '==', 'bedrift').where('godkjent', '==', false).count().get()
    ]);

    res.json({
      antallLaerlinger: laerlinger.data().count,
      antallBedrifterAktive: bedrifterAktive.data().count,
      antallBedrifterVenter: bedrifterVenter.data().count
    });
  } catch (err) {
    console.error('Feil ved henting av statistikk:', err);
    res.status(500).json({ feil: 'Kunne ikke hente statistikk' });
  }
});

export default ruter;
