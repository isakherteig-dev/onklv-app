import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { adminDB, adminStorage } from '../firebase/config.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const TILLATTE_EXT   = ['.pdf', '.docx', '.doc'];
const TILLATTE_TYPER = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (TILLATTE_EXT.includes(ext) && TILLATTE_TYPER.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Kun PDF og Word-filer (.pdf, .docx, .doc) kan lastes opp'));
    }
  }
});

async function lastOppCvTilStorage(buffer, originalname, uid, mimetype) {
  const ext = path.extname(originalname).toLowerCase();
  const filnavn = `cv/${uid}/${Date.now()}${ext}`;
  const bucket = adminStorage.bucket();
  const fil = bucket.file(filnavn);
  await fil.save(buffer, { contentType: mimetype });
  await fil.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${filnavn}`;
}

async function slettGammelCvFraStorage(cvUrl) {
  if (!cvUrl) return;
  try {
    const bucket = adminStorage.bucket();
    const url = new URL(cvUrl);
    const filnavn = decodeURIComponent(url.pathname.replace(`/${bucket.name}/`, ''));
    await bucket.file(filnavn).delete();
  } catch { /* ikke kritisk */ }
}

const ruter = Router();

/**
 * POST /api/cv
 * Laster opp CV-fil for innlogget lærling.
 */
ruter.post('/', krevAuth, krevRolle('laerling'), (req, res) => {
  upload.single('cv')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ feil: 'Filen er for stor. Maks 5 MB er tillatt.' });
      }
      return res.status(400).json({ feil: 'Feil ved opplasting. Prøv igjen.' });
    }
    if (err) return res.status(400).json({ feil: err.message });
    if (!req.file) return res.status(400).json({ feil: 'Ingen fil ble lastet opp.' });

    try {
      const ref = adminDB.collection('users').doc(req.user.uid);
      const doc = await ref.get();

      // Slett gammel CV fra Firebase Storage
      if (doc.exists && doc.data().cv_url) {
        await slettGammelCvFraStorage(doc.data().cv_url);
      }

      const cvUrl = await lastOppCvTilStorage(
        req.file.buffer,
        req.file.originalname,
        req.user.uid,
        req.file.mimetype
      );

      await ref.update({
        cv_filnavn:    req.file.originalname,
        cv_url:        cvUrl,
        cv_lastet_opp: new Date().toISOString()
      });

      res.json({
        ok: true,
        cv_filnavn: req.file.originalname,
        melding: `CV «${req.file.originalname}» er lastet opp.`
      });
    } catch (dbFeil) {
      console.error('CV feil:', dbFeil);
      res.status(500).json({ feil: 'Kunne ikke lagre CV. Prøv igjen.' });
    }
  });
});

/**
 * GET /api/cv/min
 * Returnerer nedlastingslenke til CV for innlogget lærling.
 */
ruter.get('/min', krevAuth, krevRolle('laerling'), async (req, res) => {
  try {
    const doc = await adminDB.collection('users').doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ feil: 'Brukerprofil ikke funnet.' });

    const { cv_url, cv_filnavn } = doc.data();
    if (!cv_url) return res.status(404).json({ feil: 'Du har ikke lastet opp noen CV ennå.' });

    res.redirect(cv_url);
  } catch (err) {
    console.error('CV nedlasting feil:', err);
    res.status(500).json({ feil: 'Kunne ikke laste ned CV. Prøv igjen.' });
  }
});

/**
 * DELETE /api/cv
 * Sletter CV-fil fra Firebase Storage og fjerner referansen fra Firestore.
 */
ruter.delete('/', krevAuth, krevRolle('laerling'), async (req, res) => {
  try {
    const ref = adminDB.collection('users').doc(req.user.uid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ feil: 'Brukerprofil ikke funnet.' });

    await slettGammelCvFraStorage(doc.data().cv_url);

    await ref.update({
      cv_filnavn: null, cv_url: null, cv_lastet_opp: null
    });

    res.json({ ok: true, melding: 'CV er slettet.' });
  } catch (err) {
    console.error('CV sletting feil:', err);
    res.status(500).json({ feil: 'Kunne ikke slette CV. Prøv igjen.' });
  }
});

export default ruter;
