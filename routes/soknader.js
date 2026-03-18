import { Router } from 'express';
import { getDB } from '../db/init.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const ruter = Router();

function lagVarsel(db, mottakerId, type, tittel, melding, lenke) {
  try {
    db.prepare(`INSERT INTO varsler (mottaker_id, type, tittel, melding, lenke) VALUES (?,?,?,?,?)`)
      .run(mottakerId, type, tittel, melding, lenke || null);
  } catch { /* varsler er ikke kritiske */ }
}

// GET /api/soknader/mine — lærlingens egne søknader
ruter.get('/mine', krevAuth, krevRolle('laerling'), (req, res) => {
  const db = getDB();
  const soknader = db.prepare(`
    SELECT s.id, s.status, s.sendt_dato, s.melding, s.erfaring,
           s.vg1, s.vg2, s.telefon, s.admin_kommentar,
           s.laerplass_id,
           l.tittel, l.frist, l.sted,
           l.bedrift_naam AS bedrift_navn,
           l.fagomraade
    FROM soknader s
    JOIN laereplasser l ON l.id = s.laerplass_id
    WHERE s.laerling_user_id = ?
    ORDER BY s.sendt_dato DESC
  `).all(req.user.uid);
  res.json(soknader);
});

// GET /api/soknader/bedrift — bedriftens innkomne søknader
ruter.get('/bedrift', krevAuth, krevRolle('bedrift'), (req, res) => {
  const db = getDB();
  const { laerplass_id } = req.query;

  let query = `
    SELECT s.id, s.status, s.sendt_dato, s.melding, s.erfaring,
           s.vg1, s.vg2, s.telefon,
           s.laerling_naam, s.laerling_epost,
           s.utdanningsprogram, s.skole,
           s.laerplass_id,
           l.tittel AS laerplass_tittel
    FROM soknader s
    JOIN laereplasser l ON l.id = s.laerplass_id
    WHERE l.bedrift_user_id = ?
  `;
  const params = [req.user.uid];
  if (laerplass_id) { query += ' AND s.laerplass_id = ?'; params.push(laerplass_id); }
  query += ' ORDER BY s.sendt_dato DESC';

  res.json(db.prepare(query).all(...params));
});

// GET /api/soknader/admin — alle søknader (admin)
ruter.get('/admin', krevAuth, krevRolle('admin'), (req, res) => {
  const db = getDB();
  const { status, sok } = req.query;

  let query = `
    SELECT s.id, s.status, s.sendt_dato, s.melding, s.erfaring,
           s.vg1, s.vg2, s.telefon, s.admin_kommentar,
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
  if (sok) { where.push('(s.laerling_naam LIKE ? OR l.tittel LIKE ? OR l.bedrift_naam LIKE ?)'); params.push(`%${sok}%`, `%${sok}%`, `%${sok}%`); }

  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY s.sendt_dato DESC';

  res.json(db.prepare(query).all(...params));
});

// GET /api/soknader/stats — søknadsstatistikk (admin)
ruter.get('/stats', krevAuth, krevRolle('admin'), (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS antall FROM soknader GROUP BY status
  `).all();
  const stats = { sendt: 0, under_behandling: 0, godkjent: 0, avslatt: 0, trukket: 0, totalt: 0 };
  rows.forEach(r => {
    if (r.status in stats) stats[r.status] = r.antall;
    stats.totalt += r.antall;
  });
  stats.aktiveLaereplasser = db.prepare('SELECT COUNT(*) AS c FROM laereplasser WHERE aktiv = 1').get().c;
  res.json(stats);
});

// POST /api/soknader — send søknad (lærling)
ruter.post('/', krevAuth, krevRolle('laerling'), (req, res) => {
  const { laerplass_id, melding, erfaring, vg1, vg2, telefon } = req.body;
  if (!laerplass_id) {
    return res.status(400).json({ feil: 'Mangler laerplass_id' });
  }
  if (!melding || melding.trim().length < 10) {
    return res.status(400).json({ feil: 'Motivasjon er påkrevd (minst 10 tegn)' });
  }

  const db = getDB();

  // Sjekk duplikat
  if (db.prepare('SELECT id FROM soknader WHERE laerling_user_id = ? AND laerplass_id = ?').get(req.user.uid, laerplass_id)) {
    return res.status(409).json({ feil: 'Du har allerede søkt på denne lærlingplassen' });
  }

  // Sjekk at læreplassen eksisterer og er aktiv
  const plass = db.prepare('SELECT * FROM laereplasser WHERE id = ? AND aktiv = 1').get(laerplass_id);
  if (!plass) {
    return res.status(404).json({ feil: 'Læreplassen finnes ikke eller er ikke lenger aktiv' });
  }

  const id = db.prepare(`
    INSERT INTO soknader
      (laerling_user_id, laerling_naam, laerling_epost, utdanningsprogram, skole,
       laerplass_id, melding, erfaring, vg1, vg2, telefon)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.uid,
    req.user.navn || null,
    req.user.epost || null,
    req.user.utdanningsprogram || null,
    req.user.skole || null,
    laerplass_id,
    melding,
    erfaring || null,
    vg1 || null,
    vg2 || null,
    telefon || null
  ).lastInsertRowid;

  // Varsle admin og bedrift
  lagVarsel(db, 'admin', 'ny_soknad',
    'Ny søknad mottatt',
    `${req.user.navn || 'En lærling'} har søkt på "${plass.tittel}"`,
    `/admin/soknader.html`
  );
  lagVarsel(db, plass.bedrift_user_id, 'ny_soknad',
    'Ny søknad på din læreplasse',
    `${req.user.navn || 'En lærling'} har søkt på "${plass.tittel}"`,
    `/bedrift/soknader.html`
  );

  res.status(201).json({ ok: true, id });
});

// PATCH /api/soknader/:id/status — oppdater status (bedrift eller admin)
ruter.patch('/:id/status', krevAuth, krevRolle('bedrift', 'admin'), (req, res) => {
  const { status, admin_kommentar } = req.body;
  const gyldige = ['sendt', 'under_behandling', 'godkjent', 'avslatt', 'trukket'];
  if (!gyldige.includes(status)) {
    return res.status(400).json({ feil: 'Ugyldig status' });
  }

  const db = getDB();

  let soknad;
  if (req.user.rolle === 'admin') {
    soknad = db.prepare(`
      SELECT s.*, l.tittel AS laerplass_tittel, l.bedrift_naam
      FROM soknader s JOIN laereplasser l ON l.id = s.laerplass_id
      WHERE s.id = ?
    `).get(req.params.id);
  } else {
    soknad = db.prepare(`
      SELECT s.*, l.tittel AS laerplass_tittel, l.bedrift_naam
      FROM soknader s JOIN laereplasser l ON l.id = s.laerplass_id
      WHERE s.id = ? AND l.bedrift_user_id = ?
    `).get(req.params.id, req.user.uid);
  }

  if (!soknad) return res.status(404).json({ feil: 'Søknad ikke funnet' });

  db.prepare(`
    UPDATE soknader SET
      status = ?,
      admin_kommentar = COALESCE(?, admin_kommentar),
      behandlet_av = ?,
      behandlet_dato = date('now')
    WHERE id = ?
  `).run(status, admin_kommentar || null, req.user.uid, req.params.id);

  // Varsle lærlingen
  const meldingMap = {
    under_behandling: `Din søknad på "${soknad.laerplass_tittel}" er nå under behandling.`,
    godkjent:         `Gratulerer! Din søknad på "${soknad.laerplass_tittel}" er godkjent!`,
    avslatt:          `Din søknad på "${soknad.laerplass_tittel}" ble dessverre avslått.`
  };
  if (meldingMap[status]) {
    lagVarsel(db, soknad.laerling_user_id, `soknad_${status}`,
      status === 'godkjent' ? 'Søknad godkjent!' : status === 'avslatt' ? 'Søknad avslått' : 'Søknad under behandling',
      meldingMap[status],
      `/laerling/mine-soknader.html`
    );
  }

  res.json({ ok: true });
});

// DELETE /api/soknader/:id — trekk søknad (lærling, kun hvis status=sendt)
ruter.delete('/:id', krevAuth, krevRolle('laerling'), (req, res) => {
  const db = getDB();
  const soknad = db.prepare(
    'SELECT * FROM soknader WHERE id = ? AND laerling_user_id = ?'
  ).get(req.params.id, req.user.uid);

  if (!soknad) return res.status(404).json({ feil: 'Søknad ikke funnet' });
  if (soknad.status !== 'sendt') {
    return res.status(400).json({ feil: 'Kan bare trekke søknader med status "sendt"' });
  }

  db.prepare('DELETE FROM soknader WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default ruter;
