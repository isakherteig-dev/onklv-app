import { Router } from 'express';
import { getDB } from '../db/init.js';
import { krevAuth } from '../middleware/auth.js';

const ruter = Router();

// GET /api/varsler — hent innlogget brukers varsler
ruter.get('/', krevAuth, (req, res) => {
  const db = getDB();
  const varsler = db.prepare(`
    SELECT * FROM varsler
    WHERE mottaker_id = ?
    ORDER BY opprettet DESC
    LIMIT 50
  `).all(req.user.uid);

  // Admin-bruker ser også varsler sendt til 'admin' (generiske admin-varsler)
  if (req.user.rolle === 'admin') {
    const adminVarsler = db.prepare(`
      SELECT * FROM varsler
      WHERE mottaker_id = 'admin' AND mottaker_id != ?
      ORDER BY opprettet DESC
      LIMIT 50
    `).all(req.user.uid);
    const alle = [...varsler, ...adminVarsler]
      .sort((a, b) => new Date(b.opprettet) - new Date(a.opprettet))
      .slice(0, 50);
    return res.json(alle);
  }

  res.json(varsler);
});

// GET /api/varsler/antall-uleste — antall uleste
ruter.get('/antall-uleste', krevAuth, (req, res) => {
  const db = getDB();
  const row = db.prepare(`SELECT COUNT(*) AS antall FROM varsler WHERE mottaker_id = ? AND lest = 0`).get(req.user.uid);
  let antall = row.antall;

  if (req.user.rolle === 'admin') {
    const adminRow = db.prepare(`SELECT COUNT(*) AS antall FROM varsler WHERE mottaker_id = 'admin' AND lest = 0`).get();
    antall += adminRow.antall;
  }

  res.json({ antall });
});

// PATCH /api/varsler/:id/lest — marker ett varsel som lest
ruter.patch('/:id/lest', krevAuth, (req, res) => {
  const db = getDB();
  db.prepare(`UPDATE varsler SET lest = 1 WHERE id = ? AND (mottaker_id = ? OR (? = 'admin' AND mottaker_id = 'admin'))`).run(
    req.params.id, req.user.uid, req.user.rolle
  );
  res.json({ ok: true });
});

// PATCH /api/varsler/les-alle — marker alle som lest
ruter.patch('/les-alle', krevAuth, (req, res) => {
  const db = getDB();
  db.prepare(`UPDATE varsler SET lest = 1 WHERE mottaker_id = ?`).run(req.user.uid);
  if (req.user.rolle === 'admin') {
    db.prepare(`UPDATE varsler SET lest = 1 WHERE mottaker_id = 'admin'`).run();
  }
  res.json({ ok: true });
});

export default ruter;
