import { Router } from 'express';
import { getDB } from '../db/init.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const ruter = Router();

// GET /api/soknader/mine — lærlingens egne søknader
ruter.get('/mine', krevAuth, krevRolle('laerling'), (req, res) => {
  const db = getDB();
  const soknader = db.prepare(`
    SELECT s.id, s.status, s.sendt_dato, s.melding,
           l.tittel, l.frist,
           u.navn AS bedrift_navn
    FROM soknader s
    JOIN laereplasser l ON l.id = s.laerplass_id
    JOIN users u ON u.id = l.bedrift_user_id
    WHERE s.laerling_user_id = ?
    ORDER BY s.sendt_dato DESC
  `).all(req.user.id);
  res.json(soknader);
});

// GET /api/soknader/bedrift — bedriftens innkomne søknader
ruter.get('/bedrift', krevAuth, krevRolle('bedrift'), (req, res) => {
  const db = getDB();
  const soknader = db.prepare(`
    SELECT s.id, s.status, s.sendt_dato, s.melding,
           u.navn AS laerling_navn, u.epost AS laerling_epost,
           lr.utdanningsprogram, lr.skole,
           l.tittel AS laerplass_tittel
    FROM soknader s
    JOIN users u ON u.id = s.laerling_user_id
    LEFT JOIN laerlinger lr ON lr.user_id = s.laerling_user_id
    JOIN laereplasser l ON l.id = s.laerplass_id
    WHERE l.bedrift_user_id = ?
    ORDER BY s.sendt_dato DESC
  `).all(req.user.id);
  res.json(soknader);
});

// POST /api/soknader — send søknad (lærling)
ruter.post('/', krevAuth, krevRolle('laerling'), (req, res) => {
  const { laerplass_id, melding } = req.body;
  if (!laerplass_id) {
    return res.status(400).json({ feil: 'Mangler laerplass_id' });
  }

  const db = getDB();
  const finnes = db.prepare('SELECT id FROM soknader WHERE laerling_user_id = ? AND laerplass_id = ?').get(req.user.id, laerplass_id);
  if (finnes) {
    return res.status(409).json({ feil: 'Du har allerede søkt på denne lærlingplassen' });
  }

  const id = db.prepare(
    'INSERT INTO soknader (laerling_user_id, laerplass_id, melding) VALUES (?,?,?)'
  ).run(req.user.id, laerplass_id, melding || null).lastInsertRowid;

  res.status(201).json({ ok: true, id });
});

// PATCH /api/soknader/:id/status — oppdater status (bedrift)
ruter.patch('/:id/status', krevAuth, krevRolle('bedrift'), (req, res) => {
  const { status } = req.body;
  const gyldige = ['sendt', 'under_vurdering', 'akseptert', 'avvist'];
  if (!gyldige.includes(status)) {
    return res.status(400).json({ feil: 'Ugyldig status' });
  }

  const db = getDB();
  const soknad = db.prepare(`
    SELECT s.id FROM soknader s
    JOIN laereplasser l ON l.id = s.laerplass_id
    WHERE s.id = ? AND l.bedrift_user_id = ?
  `).get(req.params.id, req.user.id);

  if (!soknad) {
    return res.status(404).json({ feil: 'Søknad ikke funnet' });
  }

  db.prepare('UPDATE soknader SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// GET /api/soknader/admin — alle søknader (admin)
ruter.get('/admin', krevAuth, krevRolle('admin'), (req, res) => {
  const db = getDB();
  const soknader = db.prepare(`
    SELECT s.id, s.status, s.sendt_dato,
           u.navn AS laerling_navn, u.epost AS laerling_epost,
           lr.utdanningsprogram,
           l.tittel AS laerplass_tittel,
           ub.navn AS bedrift_navn
    FROM soknader s
    JOIN users u ON u.id = s.laerling_user_id
    LEFT JOIN laerlinger lr ON lr.user_id = s.laerling_user_id
    JOIN laereplasser l ON l.id = s.laerplass_id
    JOIN users ub ON ub.id = l.bedrift_user_id
    ORDER BY s.sendt_dato DESC
  `).all();
  res.json(soknader);
});

export default ruter;
