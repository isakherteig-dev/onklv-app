import { Router } from 'express';
import { getDB } from '../db/init.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const ruter = Router();

// GET /api/laereplasser — alle aktive læreplasser (åpen)
ruter.get('/', (req, res) => {
  const db = getDB();
  const plasser = db.prepare(`
    SELECT id, bedrift_user_id, bedrift_naam AS bedrift_navn,
           tittel, beskrivelse, sted, bransje, frist, antall_plasser, opprettet
    FROM laereplasser
    WHERE aktiv = 1
    ORDER BY opprettet DESC
  `).all();
  res.json(plasser);
});

// GET /api/laereplasser/mine — bedriftens egne annonser
ruter.get('/mine', krevAuth, krevRolle('bedrift'), (req, res) => {
  const db = getDB();
  const plasser = db.prepare(`
    SELECT l.*, COUNT(s.id) AS antall_soknader
    FROM laereplasser l
    LEFT JOIN soknader s ON s.laerplass_id = l.id
    WHERE l.bedrift_user_id = ?
    GROUP BY l.id
    ORDER BY l.opprettet DESC
  `).all(req.user.uid);
  res.json(plasser);
});

// POST /api/laereplasser — ny annonse (bedrift)
ruter.post('/', krevAuth, krevRolle('bedrift'), (req, res) => {
  const { tittel, beskrivelse, sted, frist, antall_plasser } = req.body;
  if (!tittel || !frist) {
    return res.status(400).json({ feil: 'Tittel og frist er påkrevd' });
  }

  const db = getDB();

  // Bransje og bedriftsnavn hentes fra Firestore-profilen (via middleware)
  const bransje = req.user.bransje || null;
  const bedriftNaam = req.user.navn || null;

  const id = db.prepare(`
    INSERT INTO laereplasser (bedrift_user_id, bedrift_naam, tittel, beskrivelse, sted, bransje, frist, antall_plasser)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    req.user.uid,
    bedriftNaam,
    tittel,
    beskrivelse || null,
    sted || null,
    bransje,
    frist,
    antall_plasser || 1
  ).lastInsertRowid;

  res.status(201).json({ ok: true, id });
});

// DELETE /api/laereplasser/:id — slett annonse (bedrift, sin egen)
ruter.delete('/:id', krevAuth, krevRolle('bedrift'), (req, res) => {
  const db = getDB();
  const annonse = db.prepare(
    'SELECT * FROM laereplasser WHERE id = ? AND bedrift_user_id = ?'
  ).get(req.params.id, req.user.uid);

  if (!annonse) {
    return res.status(404).json({ feil: 'Annonse ikke funnet' });
  }

  db.prepare('DELETE FROM laereplasser WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default ruter;
