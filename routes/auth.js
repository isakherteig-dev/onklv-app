import { Router } from 'express';
import { adminAuth, adminDB } from '../firebase/config.js';
import { krevAuth } from '../middleware/auth.js';

const ruter = Router();

/**
 * POST /api/auth/register
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
    await adminAuth.getUser(uid);

    const eksisterende = await adminDB.collection('users').doc(uid).get();
    if (eksisterende.exists) {
      return res.status(400).json({ feil: 'Bruker allerede registrert' });
    }

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
      utdanningsprogram: rolle === 'laerling' ? (utdanningsprogram || null) : null,
      skole: rolle === 'laerling' ? (skole || null) : null,
      bio: rolle === 'laerling' ? (bio || null) : null,
      cv_filnavn: null,
      orgNr: rolle === 'bedrift' ? orgNr : null,
      bransje: rolle === 'bedrift' ? (bransje || null) : null,
      bedriftBeskrivelse: rolle === 'bedrift' ? (bedriftBeskrivelse || null) : null,
      godkjent: rolle === 'bedrift' ? false : true
    };

    await adminDB.collection('users').doc(uid).set(userData);
    await adminAuth.setCustomUserClaims(uid, { rolle });

    const svar = { ok: true, rolle };
    if (rolle === 'bedrift') svar.venterGodkjenning = true;

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
    if (data.rolle === 'bedrift' && data.godkjent === false) {
      return res.status(403).json({ feil: 'Kontoen venter godkjenning fra Opplæringskontoret' });
    }

    // Sjekk e-postverifisering (hopp over for Google-brukere)
    const firebaseUser = await adminAuth.getUser(decoded.uid);
    const loggetInnMedGoogle = firebaseUser.providerData?.some(p => p.providerId === 'google.com');
    if (!loggetInnMedGoogle && !firebaseUser.emailVerified) {
      return res.status(403).json({ feil: 'Du må bekrefte e-posten din først. Sjekk innboksen.' });
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
 */
ruter.get('/meg', krevAuth, async (req, res) => {
  res.json(req.user);
});

/**
 * POST /api/auth/logg-ut
 */
ruter.post('/logg-ut', (req, res) => {
  res.json({ ok: true });
});

/**
 * PATCH /api/auth/profil
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

/**
 * DELETE /api/auth/slett-konto
 */
ruter.delete('/slett-konto', krevAuth, async (req, res) => {
  try {
    // Slett Firestore-data i parallell
    const [soknaderSnap, laereplasserSnap, varslerSnap] = await Promise.all([
      adminDB.collection('soknader').where('laerling_user_id', '==', req.user.uid).get(),
      adminDB.collection('laereplasser').where('bedrift_user_id', '==', req.user.uid).get(),
      adminDB.collection('varsler').where('mottaker_id', '==', req.user.uid).get()
    ]);

    const batch = adminDB.batch();
    soknaderSnap.docs.forEach(d => batch.delete(d.ref));
    laereplasserSnap.docs.forEach(d => batch.delete(d.ref));
    varslerSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(adminDB.collection('users').doc(req.user.uid));
    await batch.commit();

    await adminAuth.deleteUser(req.user.uid);

    res.json({ ok: true, melding: 'Kontoen din er slettet.' });
  } catch (err) {
    console.error('Sletting av konto feilet:', err);
    res.status(500).json({ feil: 'Kunne ikke slette kontoen din. Prøv igjen.' });
  }
});

export default ruter;
