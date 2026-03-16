import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../db/init.js';
import { krevAuth } from '../middleware/auth.js';

const ruter = Router();

const COOKIE_INNSTILLINGER = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dager
};

// POST /api/auth/login
ruter.post('/login', (req, res) => {
  const { epost, passord } = req.body;
  if (!epost || !passord) {
    return res.status(400).json({ feil: 'Fyll ut e-post og passord' });
  }

  const db = getDB();
  const bruker = db.prepare('SELECT * FROM users WHERE epost = ?').get(epost.toLowerCase().trim());
  if (!bruker || !bcrypt.compareSync(passord, bruker.passord_hash)) {
    return res.status(401).json({ feil: 'Feil e-post eller passord' });
  }

  const token = jwt.sign(
    { id: bruker.id, rolle: bruker.rolle, navn: bruker.navn, epost: bruker.epost },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('pm_token', token, COOKIE_INNSTILLINGER);
  res.json({ ok: true, rolle: bruker.rolle, navn: bruker.navn });
});

// POST /api/auth/register/laerling
ruter.post('/register/laerling', (req, res) => {
  const { navn, epost, passord, utdanningsprogram, skole, bio } = req.body;
  if (!navn || !epost || !passord || !utdanningsprogram) {
    return res.status(400).json({ feil: 'Fyll ut alle påkrevde felter' });
  }
  if (passord.length < 8) {
    return res.status(400).json({ feil: 'Passordet må være minst 8 tegn' });
  }

  const db = getDB();
  const finnes = db.prepare('SELECT id FROM users WHERE epost = ?').get(epost.toLowerCase().trim());
  if (finnes) {
    return res.status(409).json({ feil: 'Denne e-postadressen er allerede i bruk' });
  }

  const hash = bcrypt.hashSync(passord, 10);
  const userId = db.prepare(
    'INSERT INTO users (epost, passord_hash, rolle, navn) VALUES (?,?,?,?)'
  ).run(epost.toLowerCase().trim(), hash, 'laerling', navn.trim()).lastInsertRowid;

  db.prepare(
    'INSERT INTO laerlinger (user_id, utdanningsprogram, skole, bio) VALUES (?,?,?,?)'
  ).run(userId, utdanningsprogram, skole || null, bio || null);

  const token = jwt.sign(
    { id: userId, rolle: 'laerling', navn: navn.trim(), epost: epost.toLowerCase().trim() },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('pm_token', token, COOKIE_INNSTILLINGER);
  res.status(201).json({ ok: true, rolle: 'laerling', navn: navn.trim() });
});

// POST /api/auth/register/bedrift
ruter.post('/register/bedrift', (req, res) => {
  const { navn, epost, passord, orgNr, bransje, beskrivelse } = req.body;
  if (!navn || !epost || !passord || !orgNr || !bransje) {
    return res.status(400).json({ feil: 'Fyll ut alle påkrevde felter' });
  }
  if (!/^\d{9}$/.test(orgNr)) {
    return res.status(400).json({ feil: 'Organisasjonsnummeret må være nøyaktig 9 siffer' });
  }
  if (passord.length < 8) {
    return res.status(400).json({ feil: 'Passordet må være minst 8 tegn' });
  }

  const db = getDB();
  const finnes = db.prepare('SELECT id FROM users WHERE epost = ?').get(epost.toLowerCase().trim());
  if (finnes) {
    return res.status(409).json({ feil: 'Denne e-postadressen er allerede i bruk' });
  }

  const hash = bcrypt.hashSync(passord, 10);
  const userId = db.prepare(
    'INSERT INTO users (epost, passord_hash, rolle, navn, godkjent) VALUES (?,?,?,?,0)'
  ).run(epost.toLowerCase().trim(), hash, 'bedrift', navn.trim()).lastInsertRowid;

  db.prepare(
    'INSERT INTO bedrifter (user_id, org_nr, bransje, beskrivelse, godkjent) VALUES (?,?,?,?,0)'
  ).run(userId, orgNr, bransje, beskrivelse || null);

  // Bedrift logger IKKE inn — venter på godkjenning
  res.status(201).json({ ok: true, venterGodkjenning: true });
});

// GET /api/auth/meg — hent innlogget bruker (brukes av krevInnlogging i app.js)
ruter.get('/meg', krevAuth, (req, res) => {
  const db = getDB();
  const bruker = db.prepare('SELECT id, epost, rolle, navn, godkjent FROM users WHERE id = ?').get(req.user.id);
  if (!bruker) return res.status(404).json({ feil: 'Bruker ikke funnet' });

  let ekstra = {};
  if (bruker.rolle === 'laerling') {
    ekstra = db.prepare('SELECT utdanningsprogram, skole, bio, cv_filnavn FROM laerlinger WHERE user_id = ?').get(bruker.id) || {};
  } else if (bruker.rolle === 'bedrift') {
    ekstra = db.prepare('SELECT org_nr, bransje, beskrivelse, godkjent FROM bedrifter WHERE user_id = ?').get(bruker.id) || {};
  }

  res.json({ ...bruker, ...ekstra });
});

// POST /api/auth/logg-ut
ruter.post('/logg-ut', (req, res) => {
  res.clearCookie('pm_token');
  res.json({ ok: true });
});

// PATCH /api/auth/profil — oppdater eget navn/bio
ruter.patch('/profil', krevAuth, (req, res) => {
  const { navn, bio, cv_filnavn } = req.body;
  const db = getDB();
  if (navn) {
    db.prepare('UPDATE users SET navn = ? WHERE id = ?').run(navn.trim(), req.user.id);
  }
  if (req.user.rolle === 'laerling') {
    if (bio !== undefined) {
      db.prepare('UPDATE laerlinger SET bio = ? WHERE user_id = ?').run(bio, req.user.id);
    }
    if (cv_filnavn) {
      db.prepare('UPDATE laerlinger SET cv_filnavn = ? WHERE user_id = ?').run(cv_filnavn, req.user.id);
    }
  }
  res.json({ ok: true });
});

export default ruter;
