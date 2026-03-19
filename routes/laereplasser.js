import { Router } from 'express';
import { getDB } from '../db/init.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const ruter = Router();

// GET /api/laereplasser — alle aktive læreplasser (åpen)
ruter.get('/', (req, res) => {
  const db = getDB();
  const plasser = db.prepare(`
    SELECT id, bedrift_user_id, bedrift_naam AS bedrift_navn,
           tittel, beskrivelse, sted, bransje, fagomraade, krav,
           start_dato, kontaktperson, kontakt_epost,
           frist, antall_plasser, opprettet
    FROM laereplasser
    WHERE aktiv = 1
    ORDER BY opprettet DESC
  `).all();
  res.json(plasser);
});

// GET /api/laereplasser/alle — alle læreplasser inkl inaktive (admin)
ruter.get('/alle', krevAuth, krevRolle('admin'), (req, res) => {
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

// GET /api/laereplasser/:id — én læreplass med detaljer
ruter.get('/:id', (req, res) => {
  const db = getDB();
  const plass = db.prepare(`
    SELECT l.*, COUNT(s.id) AS antall_soknader
    FROM laereplasser l
    LEFT JOIN soknader s ON s.laerplass_id = l.id
    WHERE l.id = ?
    GROUP BY l.id
  `).get(req.params.id);

  if (!plass) return res.status(404).json({ feil: 'Læreplass ikke funnet' });
  res.json(plass);
});

// POST /api/laereplasser — ny annonse (bedrift eller admin)
ruter.post('/', krevAuth, krevRolle('bedrift', 'admin'), (req, res) => {
  const {
    tittel, beskrivelse, sted, frist, antall_plasser,
    fagomraade, krav, start_dato, kontaktperson, kontakt_epost,
    bedrift_user_id: overrideBedriftId,
    bedrift_naam: overrideBedriftNaam
  } = req.body;

  if (!tittel || !frist) {
    return res.status(400).json({ feil: 'Tittel og frist er påkrevd' });
  }

  const db = getDB();
  const bransje     = fagomraade || req.user.bransje || null;
  const bedriftId   = req.user.rolle === 'admin' ? (overrideBedriftId || req.user.uid) : req.user.uid;
  const bedriftNaam = req.user.rolle === 'admin' ? (overrideBedriftNaam || req.user.navn) : (req.user.navn || null);

  const id = db.prepare(`
    INSERT INTO laereplasser
      (bedrift_user_id, bedrift_naam, tittel, beskrivelse, sted, bransje,
       fagomraade, krav, start_dato, kontaktperson, kontakt_epost, frist, antall_plasser)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    bedriftId, bedriftNaam, tittel,
    beskrivelse || null, sted || null, bransje,
    fagomraade || null, krav || null, start_dato || null,
    kontaktperson || null, kontakt_epost || null,
    frist, antall_plasser || 1
  ).lastInsertRowid;

  res.status(201).json({ ok: true, id });
});

// PATCH /api/laereplasser/:id — oppdater annonse (bedrift-eier eller admin)
ruter.patch('/:id', krevAuth, krevRolle('bedrift', 'admin'), (req, res) => {
  const db = getDB();
  const annonse = db.prepare('SELECT * FROM laereplasser WHERE id = ?').get(req.params.id);

  if (!annonse) return res.status(404).json({ feil: 'Annonse ikke funnet' });
  if (req.user.rolle !== 'admin' && annonse.bedrift_user_id !== req.user.uid) {
    return res.status(403).json({ feil: 'Ikke tilgang' });
  }

  const {
    tittel, beskrivelse, sted, frist, antall_plasser,
    fagomraade, krav, start_dato, kontaktperson, kontakt_epost, aktiv
  } = req.body;

  db.prepare(`
    UPDATE laereplasser SET
      tittel = COALESCE(?, tittel),
      beskrivelse = COALESCE(?, beskrivelse),
      sted = COALESCE(?, sted),
      frist = COALESCE(?, frist),
      antall_plasser = COALESCE(?, antall_plasser),
      fagomraade = COALESCE(?, fagomraade),
      bransje = COALESCE(?, bransje),
      krav = COALESCE(?, krav),
      start_dato = COALESCE(?, start_dato),
      kontaktperson = COALESCE(?, kontaktperson),
      kontakt_epost = COALESCE(?, kontakt_epost),
      aktiv = COALESCE(?, aktiv)
    WHERE id = ?
  `).run(
    tittel ?? null, beskrivelse ?? null, sted ?? null, frist ?? null,
    antall_plasser ?? null, fagomraade ?? null, bransje ?? null,
    krav ?? null, start_dato ?? null, kontaktperson ?? null, kontakt_epost ?? null,
    aktiv !== undefined ? (aktiv ? 1 : 0) : null,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE /api/laereplasser/:id — slett annonse (bedrift sin egen, eller admin)
ruter.delete('/:id', krevAuth, krevRolle('bedrift', 'admin'), (req, res) => {
  const db = getDB();
  const annonse = db.prepare('SELECT * FROM laereplasser WHERE id = ?').get(req.params.id);

  if (!annonse) return res.status(404).json({ feil: 'Annonse ikke funnet' });
  if (req.user.rolle !== 'admin' && annonse.bedrift_user_id !== req.user.uid) {
    return res.status(403).json({ feil: 'Ikke tilgang' });
  }

  db.prepare('DELETE FROM laereplasser WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default ruter;
