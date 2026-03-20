import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { adminDB } from '../firebase/config.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Sikre at mappen finnes
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const lagring = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    // Format: <uid>_<timestamp><ext> — aldri originalfilnavn direkte
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.uid}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage: lagring,
  limits: { fileSize: 5 * 1024 * 1024 }, // maks 5 MB
  fileFilter: (_req, file, cb) => {
    const tillatteExt = ['.pdf', '.docx', '.doc'];
    const tillatteTyper = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (tillatteExt.includes(ext) && tillatteTyper.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Kun PDF og Word-filer (.pdf, .docx, .doc) kan lastes opp'));
    }
  }
});

const ruter = Router();

/**
 * POST /api/cv
 * Laster opp CV-fil for innlogget lærling.
 * Sletter eventuell tidligere CV og oppdaterer Firestore-profilen.
 */
ruter.post('/', krevAuth, krevRolle('laerling'), (req, res) => {
  upload.single('cv')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ feil: 'Filen er for stor. Maks 5 MB er tillatt.' });
      }
      return res.status(400).json({ feil: 'Feil ved opplasting. Prøv igjen.' });
    }
    if (err) {
      return res.status(400).json({ feil: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ feil: 'Ingen fil ble lastet opp.' });
    }

    try {
      const ref = adminDB.collection('users').doc(req.user.uid);
      const doc = await ref.get();

      // Slett gammel CV-fil hvis den finnes
      if (doc.exists) {
        const gammelFilnavn = doc.data().cv_filnavn_intern;
        if (gammelFilnavn) {
          const gammelSti = path.join(UPLOADS_DIR, gammelFilnavn);
          if (fs.existsSync(gammelSti)) {
            fs.unlinkSync(gammelSti);
          }
        }
      }

      // Lagre metadata i Firestore
      await ref.update({
        cv_filnavn:       req.file.originalname,    // Brukes til visning
        cv_filnavn_intern: req.file.filename,        // Brukes til filhåndtering
        cv_lastet_opp:    new Date().toISOString()
      });

      res.json({
        ok: true,
        cv_filnavn: req.file.originalname,
        melding: `CV «${req.file.originalname}» er lastet opp.`
      });
    } catch (dbFeil) {
      console.error('CV Firestore-feil:', dbFeil);
      // Rydd opp fil hvis DB-oppdatering feilet
      fs.unlinkSync(req.file.path);
      res.status(500).json({ feil: 'Kunne ikke lagre CV. Prøv igjen.' });
    }
  });
});

/**
 * GET /api/cv/min
 * Laster ned CV-fil for innlogget lærling.
 */
ruter.get('/min', krevAuth, krevRolle('laerling'), async (req, res) => {
  try {
    const doc = await adminDB.collection('users').doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ feil: 'Brukerprofil ikke funnet.' });

    const { cv_filnavn_intern, cv_filnavn } = doc.data();
    if (!cv_filnavn_intern) return res.status(404).json({ feil: 'Du har ikke lastet opp noen CV ennå.' });

    const filSti = path.join(UPLOADS_DIR, cv_filnavn_intern);
    if (!fs.existsSync(filSti)) {
      // Fil mangler — rydd opp Firestore
      await adminDB.collection('users').doc(req.user.uid).update({
        cv_filnavn: null, cv_filnavn_intern: null, cv_lastet_opp: null
      });
      return res.status(404).json({ feil: 'CV-filen ble ikke funnet. Last opp på nytt.' });
    }

    res.download(filSti, cv_filnavn || cv_filnavn_intern);
  } catch (err) {
    console.error('CV nedlasting feil:', err);
    res.status(500).json({ feil: 'Kunne ikke laste ned CV. Prøv igjen.' });
  }
});

/**
 * DELETE /api/cv
 * Sletter CV-fil og fjerner referansen fra Firestore.
 */
ruter.delete('/', krevAuth, krevRolle('laerling'), async (req, res) => {
  try {
    const ref = adminDB.collection('users').doc(req.user.uid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ feil: 'Brukerprofil ikke funnet.' });

    const { cv_filnavn_intern } = doc.data();
    if (cv_filnavn_intern) {
      const filSti = path.join(UPLOADS_DIR, cv_filnavn_intern);
      if (fs.existsSync(filSti)) fs.unlinkSync(filSti);
    }

    await ref.update({
      cv_filnavn: null, cv_filnavn_intern: null, cv_lastet_opp: null
    });

    res.json({ ok: true, melding: 'CV er slettet.' });
  } catch (err) {
    console.error('CV sletting feil:', err);
    res.status(500).json({ feil: 'Kunne ikke slette CV. Prøv igjen.' });
  }
});

export default ruter;
