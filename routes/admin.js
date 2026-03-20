import { Router } from 'express';
import { adminAuth, adminDB } from '../firebase/config.js';
import { getDB } from '../db/init.js';
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
 * Godkjenner en bedrift.
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
 * Overordnet statistikk (Firestore + SQLite).
 */
ruter.get('/statistikk', async (req, res) => {
  try {
    const db = getDB();
    const [laerlinger, bedrifterAktive, bedrifterVenter] = await Promise.all([
      adminDB.collection('users').where('rolle', '==', 'laerling').count().get(),
      adminDB.collection('users').where('rolle', '==', 'bedrift').where('godkjent', '==', true).count().get(),
      adminDB.collection('users').where('rolle', '==', 'bedrift').where('godkjent', '==', false).count().get()
    ]);

    const soknadStats = db.prepare('SELECT status, COUNT(*) AS c FROM soknader GROUP BY status').all();
    const soknaderTotalt = soknadStats.reduce((sum, r) => sum + r.c, 0);
    const aktiveLaereplasser = db.prepare('SELECT COUNT(*) AS c FROM laereplasser WHERE aktiv = 1').get().c;

    res.json({
      antallLaerlinger: laerlinger.data().count,
      antallBedrifterAktive: bedrifterAktive.data().count,
      antallBedrifterVenter: bedrifterVenter.data().count,
      soknaderTotalt,
      aktiveLaereplasser
    });
  } catch (err) {
    console.error('Feil ved henting av statistikk:', err);
    res.status(500).json({ feil: 'Kunne ikke hente statistikk' });
  }
});

/**
 * GET /api/admin/alle-soknader
 * Henter alle søknader med filtrering.
 */
ruter.get('/alle-soknader', (req, res) => {
  const db = getDB();
  const { status, sok } = req.query;

  let query = `
    SELECT s.id, s.status, s.sendt_dato, s.melding, s.erfaring,
           s.vg1, s.vg2, s.telefon, s.vedlegg, s.vedlegg_originalnavn, s.admin_kommentar,
           s.behandlet_dato, s.laerplass_id,
           s.laerling_user_id, s.laerling_naam, s.laerling_epost,
           s.utdanningsprogram, s.skole,
           l.tittel AS laerplass_tittel,
           l.bedrift_naam AS bedrift_navn,
           l.bedrift_user_id
    FROM soknader s
    JOIN laereplasser l ON l.id = s.laerplass_id
  `;
  const params = [];
  const where = [];

  if (status && status !== 'alle') { where.push('s.status = ?'); params.push(status); }
  if (sok) {
    where.push('(s.laerling_naam LIKE ? OR l.tittel LIKE ? OR l.bedrift_naam LIKE ?)');
    params.push(`%${sok}%`, `%${sok}%`, `%${sok}%`);
  }

  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY s.sendt_dato DESC';

  res.json(db.prepare(query).all(...params));
});

/**
 * PATCH /api/admin/soknader/:id/status
 * Admin oppdaterer søknadsstatus med kommentar.
 */
ruter.patch('/soknader/:id/status', (req, res) => {
  const { status, admin_kommentar } = req.body;
  const gyldige = ['sendt', 'under_behandling', 'godkjent', 'avslatt', 'trukket'];
  if (!gyldige.includes(status)) {
    return res.status(400).json({ feil: 'Ugyldig status' });
  }

  const db = getDB();
  const soknad = db.prepare(`
    SELECT s.*, l.tittel AS laerplass_tittel
    FROM soknader s JOIN laereplasser l ON l.id = s.laerplass_id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!soknad) return res.status(404).json({ feil: 'Søknad ikke funnet' });

  db.prepare(`
    UPDATE soknader SET
      status = ?,
      admin_kommentar = COALESCE(?, admin_kommentar),
      behandlet_av = ?,
      behandlet_dato = date('now')
    WHERE id = ?
  `).run(status, admin_kommentar || null, req.user.uid, req.params.id);

  // Varsle lærling
  const meldingMap = {
    under_behandling: `Din søknad på "${soknad.laerplass_tittel}" er nå under behandling.`,
    godkjent:         `Gratulerer! Din søknad på "${soknad.laerplass_tittel}" er godkjent!`,
    avslatt:          `Din søknad på "${soknad.laerplass_tittel}" ble dessverre avslått.`
  };
  if (meldingMap[status]) {
    try {
      db.prepare(`INSERT INTO varsler (mottaker_id, type, tittel, melding, lenke) VALUES (?,?,?,?,?)`)
        .run(
          soknad.laerling_user_id,
          `soknad_${status}`,
          status === 'godkjent' ? 'Søknad godkjent!' : status === 'avslatt' ? 'Søknad avslått' : 'Søknad under behandling',
          meldingMap[status],
          '/laerling/mine-soknader.html'
        );
    } catch { /* varsler er ikke kritiske */ }
  }

  res.json({ ok: true });
});

/**
 * GET /api/admin/alle-laereplasser
 * Henter alle læreplasser (aktive og inaktive) med filtrering.
 */
ruter.get('/alle-laereplasser', (req, res) => {
  const db = getDB();
  const { status, fagomraade, sok } = req.query;

  let query = `
    SELECT l.*, COUNT(s.id) AS antall_soknader
    FROM laereplasser l
    LEFT JOIN soknader s ON s.laerplass_id = l.id
  `;
  const params = [];
  const where = [];

  if (status === 'aktiv')   where.push('l.aktiv = 1');
  if (status === 'inaktiv') where.push('l.aktiv = 0');
  if (fagomraade) { where.push('l.fagomraade = ?'); params.push(fagomraade); }
  if (sok) { where.push('(l.tittel LIKE ? OR l.bedrift_naam LIKE ?)'); params.push(`%${sok}%`, `%${sok}%`); }

  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' GROUP BY l.id ORDER BY l.opprettet DESC';

  res.json(db.prepare(query).all(...params));
});

/**
 * DELETE /api/admin/laereplasser/:id
 * Admin sletter en læreplass.
 */
ruter.delete('/laereplasser/:id', (req, res) => {
  const db = getDB();
  const annonse = db.prepare('SELECT id FROM laereplasser WHERE id = ?').get(req.params.id);
  if (!annonse) return res.status(404).json({ feil: 'Læreplass ikke funnet' });
  db.prepare('DELETE FROM laereplasser WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/**
 * GET /api/admin/brukere
 * Henter alle brukere fra Firestore.
 */
ruter.get('/brukere', async (req, res) => {
  try {
    const { rolle } = req.query;
    let query = adminDB.collection('users');
    if (rolle) query = query.where('rolle', '==', rolle);
    const snapshot = await query.orderBy('opprettet', 'desc').get();

    const brukere = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        uid: d.uid,
        navn: d.navn,
        epost: d.epost,
        rolle: d.rolle,
        godkjent: d.godkjent,
        aktiv: d.aktiv,
        orgNr: d.orgNr || null,
        bransje: d.bransje || null,
        utdanningsprogram: d.utdanningsprogram || null,
        opprettet: d.opprettet
      };
    });

    res.json(brukere);
  } catch (err) {
    console.error('Feil ved henting av brukere:', err);
    res.status(500).json({ feil: 'Kunne ikke hente brukere' });
  }
});

export default ruter;
