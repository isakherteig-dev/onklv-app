import { Router } from 'express';
import { adminAuth, adminDB } from '../firebase/config.js';
import { krevAuth } from '../middleware/auth.js';

const ruter = Router();

/**
 * POST /api/auth/register
 * Oppretter brukerprofil i Firestore etter at Firebase Auth er gjort på frontend.
 * Setter custom claim { rolle } for rask tilgangssjekk.
 */
ruter.post('/register', async (req, res) => {
  const { uid, navn, epost, telefon, rolle, utdanningsprogram, skole, bio,
          orgNr, bransje, bedriftBeskrivelse, samtykkeVersjon } = req.body;

  if (!uid || !navn || !epost || !rolle) {
    return res.status(400).json({ feil: 'Mangler påkrevde felt (uid, navn, epost, rolle)' });
  }

  if (!['laerling', 'bedrift'].includes(rolle)) {
    return res.status(400).json({ feil: 'Ugyldig rolle' });
  }

  if (rolle === 'bedrift' && !orgNr) {
    return res.status(400).json({ feil: 'Organisasjonsnummer er påkrevd for bedrifter' });
  }

  if (rolle === 'bedrift' && !/^\d{9}$/.test(orgNr)) {
    return res.status(400).json({ feil: 'Organisasjonsnummeret må være nøyaktig 9 siffer' });
  }

  try {
    // Sjekk at UID faktisk finnes i Firebase Auth
    await adminAuth.getUser(uid);

    const now = new Date();

    const userData = {
      uid,
      navn: navn.trim(),
      epost: epost.toLowerCase().trim(),
      telefon: telefon || null,
      rolle,
      opprettet: now,
      sistInnlogget: now,
      samtykkeGitt: now,
      samtykkeVersjon: samtykkeVersjon || '1.0',
      aktiv: true,
      // Lærling-felt
      utdanningsprogram: rolle === 'laerling' ? (utdanningsprogram || null) : null,
      skole: rolle === 'laerling' ? (skole || null) : null,
      bio: rolle === 'laerling' ? (bio || null) : null,
      cv_filnavn: null,
      // Bedrift-felt
      orgNr: rolle === 'bedrift' ? orgNr : null,
      bransje: rolle === 'bedrift' ? (bransje || null) : null,
      bedriftBeskrivelse: rolle === 'bedrift' ? (bedriftBeskrivelse || null) : null,
      godkjent: rolle === 'bedrift' ? false : true  // Bedrifter venter godkjenning
    };

    await adminDB.collection('users').doc(uid).set(userData);

    // Sett custom claim (brukes i frontend for rollehåndtering)
    await adminAuth.setCustomUserClaims(uid, { rolle });

    const svar = { ok: true, rolle };
    if (rolle === 'bedrift') {
      svar.venterGodkjenning = true;
    }

    res.status(201).json(svar);
  } catch (err) {
    console.error('Registreringsfeil:', err);
    if (err.code === 'auth/user-not-found') {
      return res.status(400).json({ feil: 'Firebase Auth-bruker ikke funnet' });
    }
    res.status(500).json({ feil: 'Kunne ikke registrere bruker' });
  }
});

/**
 * POST /api/auth/login-update
 * Oppdaterer sist innlogget og returnerer full brukerprofil.
 * Kalles av frontend etter vellykket Firebase Auth-innlogging.
 */
ruter.post('/login-update', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ feil: 'Ikke innlogget' });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const ref = adminDB.collection('users').doc(decoded.uid);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({ feil: 'Brukerprofil ikke funnet' });
    }

    const data = doc.data();

    // Blokker ikke-godkjente bedrifter
    if (data.rolle === 'bedrift' && data.godkjent === false) {
      return res.status(403).json({ feil: 'Kontoen venter godkjenning fra Opplæringskontoret' });
    }

    await ref.update({ sistInnlogget: new Date() });

    res.json({ bruker: { ...data, sistInnlogget: new Date() } });
  } catch (err) {
    console.error('Login-update feil:', err);
    res.status(401).json({ feil: 'Ugyldig token' });
  }
});

/**
 * GET /api/auth/meg
 * Returnerer innlogget brukers fulle profil fra Firestore.
 */
ruter.get('/meg', krevAuth, async (req, res) => {
  res.json(req.user);
});

/**
 * POST /api/auth/logg-ut
 * Firebase håndterer selve utloggingen på klientsiden.
 * Ruten beholdes for bakoverkompatibilitet.
 */
ruter.post('/logg-ut', (req, res) => {
  res.json({ ok: true });
});

/**
 * PATCH /api/auth/profil
 * Oppdaterer brukerprofil i Firestore (navn, bio, cv_filnavn, utdanningsprogram, skole).
 */
ruter.patch('/profil', krevAuth, async (req, res) => {
  const { navn, bio, cv_filnavn, utdanningsprogram, skole } = req.body;
  const oppdateringer = {};

  if (navn) oppdateringer.navn = navn.trim();

  if (req.user.rolle === 'laerling') {
    if (bio !== undefined) oppdateringer.bio = bio;
    if (cv_filnavn)        oppdateringer.cv_filnavn = cv_filnavn;
    if (utdanningsprogram) oppdateringer.utdanningsprogram = utdanningsprogram;
    if (skole)             oppdateringer.skole = skole;
  }

  if (Object.keys(oppdateringer).length === 0) {
    return res.status(400).json({ feil: 'Ingen felt å oppdatere' });
  }

  try {
    await adminDB.collection('users').doc(req.user.uid).update(oppdateringer);
    res.json({ ok: true });
  } catch (err) {
    console.error('Profiloppdatering feil:', err);
    res.status(500).json({ feil: 'Kunne ikke oppdatere profil' });
  }
});

export default ruter;
