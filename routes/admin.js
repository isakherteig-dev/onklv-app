import { Router } from 'express';
import { adminAuth, adminDB } from '../firebase/config.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';
import { sendStatusEpost } from '../tools/epost.js';
import { lagVarsel } from '../utils/varsler.js';

const ruter = Router();

// Alle admin-ruter krever innlogging og admin-rolle
ruter.use(krevAuth, krevRolle('admin'));


/**
 * GET /api/admin/bedrifter-venter
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
      return { uid: d.uid, navn: d.navn, epost: d.epost, orgNr: d.orgNr, bransje: d.bransje, opprettet: d.opprettet };
    });

    res.json(bedrifter);
  } catch (err) {
    console.error('Feil ved henting av ventende bedrifter:', err);
    res.status(500).json({ feil: 'Kunne ikke hente bedrifter' });
  }
});

/**
 * PATCH /api/admin/bedrifter/:uid/godkjenn
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
 */
ruter.get('/statistikk', async (req, res) => {
  try {
    const statuser = ['sendt', 'under_behandling', 'godkjent', 'avslatt', 'trukket'];
    const [laerlinger, bedrifterAktive, bedrifterVenter, soknadCounts, aktivePlass] = await Promise.all([
      adminDB.collection('users').where('rolle', '==', 'laerling').count().get(),
      adminDB.collection('users').where('rolle', '==', 'bedrift').where('godkjent', '==', true).count().get(),
      adminDB.collection('users').where('rolle', '==', 'bedrift').where('godkjent', '==', false).count().get(),
      Promise.all(statuser.map(s =>
        adminDB.collection('soknader').where('status', '==', s).count().get()
          .then(snap => ({ status: s, antall: snap.data().count }))
      )),
      adminDB.collection('laereplasser').where('aktiv', '==', true).count().get()
    ]);

    const soknaderTotalt = soknadCounts.reduce((sum, r) => sum + r.antall, 0);

    res.json({
      antallLaerlinger: laerlinger.data().count,
      antallBedrifterAktive: bedrifterAktive.data().count,
      antallBedrifterVenter: bedrifterVenter.data().count,
      soknaderTotalt,
      aktiveLaereplasser: aktivePlass.data().count
    });
  } catch (err) {
    console.error('Feil ved henting av statistikk:', err);
    res.status(500).json({ feil: 'Kunne ikke hente statistikk' });
  }
});

/**
 * GET /api/admin/alle-soknader
 */
ruter.get('/alle-soknader', async (req, res) => {
  try {
    const { status, sok } = req.query;

    let q = adminDB.collection('soknader');
    if (status && status !== 'alle') q = q.where('status', '==', status);
    q = q.orderBy('sendt_dato', 'desc');

    const snap = await q.get();
    let soknader = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ...data,
        sendt_dato: data.sendt_dato?.toDate?.()?.toISOString?.() ?? data.sendt_dato ?? null,
        behandlet_dato: data.behandlet_dato?.toDate?.()?.toISOString?.() ?? data.behandlet_dato ?? null
      };
    });

    // Berik med læreplassdata
    const plassIds = [...new Set(soknader.map(s => s.laerplass_id))];
    const plassDocs = await Promise.all(plassIds.map(id => adminDB.collection('laereplasser').doc(id).get()));
    const plassMap = {};
    plassDocs.forEach(d => { if (d.exists) plassMap[d.id] = d.data(); });

    let resultat = soknader.map(s => {
      const p = plassMap[s.laerplass_id] || {};
      return { ...s, laerplass_tittel: p.tittel, bedrift_navn: p.bedrift_navn, bedrift_user_id: p.bedrift_user_id };
    });

    if (sok) {
      const s = sok.toLowerCase();
      resultat = resultat.filter(r =>
        r.laerling_naam?.toLowerCase().includes(s) ||
        r.laerplass_tittel?.toLowerCase().includes(s) ||
        r.bedrift_navn?.toLowerCase().includes(s)
      );
    }

    res.json(resultat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente søknader' });
  }
});

/**
 * PATCH /api/admin/soknader/:id/status
 */
ruter.patch('/soknader/:id/status', async (req, res) => {
  const { status, admin_kommentar } = req.body;
  const gyldige = ['sendt', 'under_behandling', 'godkjent', 'avslatt', 'trukket'];
  if (!gyldige.includes(status)) {
    return res.status(400).json({ feil: 'Ugyldig status' });
  }

  try {
    const sokDoc = await adminDB.collection('soknader').doc(req.params.id).get();
    if (!sokDoc.exists) return res.status(404).json({ feil: 'Søknad ikke funnet' });

    const soknad = sokDoc.data();
    const plassDoc = await adminDB.collection('laereplasser').doc(soknad.laerplass_id).get();
    const plassTittel = plassDoc.exists ? plassDoc.data().tittel : 'ukjent stilling';

    const oppdatering = { status, behandlet_av: req.user.uid, behandlet_dato: new Date() };
    if (admin_kommentar) oppdatering.admin_kommentar = admin_kommentar;

    await sokDoc.ref.update(oppdatering);

    const meldingMap = {
      under_behandling: `Din søknad på "${plassTittel}" er nå under behandling.`,
      godkjent:         `Gratulerer! Din søknad på "${plassTittel}" er godkjent!`,
      avslatt:          `Din søknad på "${plassTittel}" ble dessverre avslått.`
    };
    if (meldingMap[status]) {
      await lagVarsel(
        soknad.laerling_user_id,
        `soknad_${status}`,
        status === 'godkjent' ? 'Søknad godkjent!' : status === 'avslatt' ? 'Søknad avslått' : 'Søknad under behandling',
        meldingMap[status],
        '/laerling/mine-soknader.html'
      );

      try {
        await sendStatusEpost(
          soknad.laerling_epost,
          soknad.laerling_naam,
          plassTittel,
          status
        );
      } catch (epostErr) {
        console.error('Kunne ikke sende status-epost:', epostErr);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke oppdatere status' });
  }
});

/**
 * GET /api/admin/alle-laereplasser
 */
ruter.get('/alle-laereplasser', async (req, res) => {
  try {
    const { status, fagomraade, sok } = req.query;

    let q = adminDB.collection('laereplasser');
    if (status === 'aktiv')   q = q.where('aktiv', '==', true);
    if (status === 'inaktiv') q = q.where('aktiv', '==', false);
    if (fagomraade)           q = q.where('fagomraade', '==', fagomraade);
    q = q.orderBy('opprettet', 'desc');

    const snap = await q.get();
    let plasser = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ...data,
        opprettet: data.opprettet?.toDate?.()?.toISOString?.() ?? data.opprettet ?? null
      };
    });

    if (sok) {
      const s = sok.toLowerCase();
      plasser = plasser.filter(p =>
        p.tittel?.toLowerCase().includes(s) ||
        p.bedrift_navn?.toLowerCase().includes(s)
      );
    }

    // Hent søknadsantall samlet (unngår N+1)
    const plassIds = plasser.map(p => p.id);
    const antallMap = {};
    plassIds.forEach(id => { antallMap[id] = 0; });
    for (let i = 0; i < plassIds.length; i += 30) {
      const chunk = plassIds.slice(i, i + 30);
      const snap = await adminDB.collection('soknader').where('laerplass_id', 'in', chunk).get();
      snap.docs.forEach(d => {
        const pid = d.data().laerplass_id;
        if (antallMap[pid] !== undefined) antallMap[pid]++;
      });
    }
    const med = plasser.map(p => ({ ...p, antall_soknader: antallMap[p.id] || 0 }));

    res.json(med);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente læreplasser' });
  }
});

/**
 * DELETE /api/admin/laereplasser/:id
 */
ruter.delete('/laereplasser/:id', async (req, res) => {
  try {
    const ref = adminDB.collection('laereplasser').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ feil: 'Læreplass ikke funnet' });
    await ref.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke slette læreplassen' });
  }
});

/**
 * GET /api/admin/brukere
 */
ruter.get('/brukere', async (req, res) => {
  try {
    const { rolle } = req.query;
    let q = adminDB.collection('users');
    if (rolle) q = q.where('rolle', '==', rolle);
    const snapshot = await q.orderBy('opprettet', 'desc').get();

    const brukere = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        uid: d.uid, navn: d.navn, epost: d.epost, rolle: d.rolle,
        godkjent: d.godkjent, aktiv: d.aktiv,
        orgNr: d.orgNr || null, bransje: d.bransje || null,
        utdanningsprogram: d.utdanningsprogram || null, opprettet: d.opprettet
      };
    });

    res.json(brukere);
  } catch (err) {
    console.error('Feil ved henting av brukere:', err);
    res.status(500).json({ feil: 'Kunne ikke hente brukere' });
  }
});

export default ruter;
