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
  const bucket = adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET);
  const fil = bucket.file(filnavn);
  await fil.save(buffer, { contentType: mimetype });
  await fil.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${filnavn}`;
}

async function slettGammelCvFraStorage(cvUrl) {
  if (!cvUrl) return;
  try {
    const bucket = adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET);
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

// ─── Avatar-opplasting ───────────────────────────────────────────────────────

const TILLATTE_BILDE_EXT   = ['.jpg', '.jpeg', '.png', '.webp'];
const TILLATTE_BILDE_TYPER = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_STR = 2 * 1024 * 1024; // 2 MB

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_STR },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (TILLATTE_BILDE_EXT.includes(ext) && TILLATTE_BILDE_TYPER.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Kun JPG, PNG og WebP er tillatt som profilbilde'));
    }
  }
});

async function slettGammelAvatarFraStorage(avatarUrl) {
  if (!avatarUrl || !avatarUrl.includes('storage.googleapis.com')) return;
  try {
    const bucket = adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET);
    const url = new URL(avatarUrl);
    const filnavn = decodeURIComponent(url.pathname.replace(`/${bucket.name}/`, ''));
    await bucket.file(filnavn).delete();
  } catch { /* ikke kritisk */ }
}

/**
 * POST /api/cv/avatar
 * Laster opp profilbilde for innlogget bruker.
 */
ruter.post('/avatar', krevAuth, (req, res) => {
  avatarUpload.single('avatar')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ feil: 'Bildet er for stort. Maks 2 MB er tillatt.' });
      }
      return res.status(400).json({ feil: 'Feil ved opplasting. Prøv igjen.' });
    }
    if (err) return res.status(400).json({ feil: err.message });
    if (!req.file) return res.status(400).json({ feil: 'Ingen fil ble lastet opp.' });

    try {
      const ref = adminDB.collection('users').doc(req.user.uid);
      const userDoc = await ref.get();

      // Slett gammelt avatar fra Firebase Storage
      if (userDoc.exists && userDoc.data().avatar_url) {
        await slettGammelAvatarFraStorage(userDoc.data().avatar_url);
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const filnavn = `avatarer/${req.user.uid}/${Date.now()}${ext}`;
      const bucket = adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET);
      const fil = bucket.file(filnavn);
      await fil.save(req.file.buffer, { contentType: req.file.mimetype });
      await fil.makePublic();

      const avatarUrl = `https://storage.googleapis.com/${bucket.name}/${filnavn}`;
      await ref.update({ avatar_url: avatarUrl });

      res.json({ ok: true, avatar_url: avatarUrl });
    } catch (dbFeil) {
      console.error('Avatar opplasting feil:', dbFeil);
      res.status(500).json({ feil: 'Kunne ikke lagre profilbilde. Prøv igjen.' });
    }
  });
});

// ─── Videopresentasjon ───────────────────────────────────────────────────────

const TILLATTE_VIDEO_EXT   = ['.mp4', '.webm', '.mov'];
const TILLATTE_VIDEO_TYPER = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_VIDEO_BYTES       = 100 * 1024 * 1024; // 100 MB

async function slettGammelVideoFraStorage(videoPath) {
  if (!videoPath) return;
  try { await adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET).file(videoPath).delete(); } catch { /* ikke kritisk */ }
}

/**
 * POST /api/cv/video/signed-url
 * Utsteder en signert Firebase Storage-URL slik at klienten kan laste opp
 * videofilen direkte (omgår Vercels 4,5 MB body-grense).
 * Kun for lærling-eier.
 */
ruter.post('/video/signed-url', krevAuth, krevRolle('laerling'), async (req, res) => {
  const { filnavn, contentType, size } = req.body;

  if (!filnavn || !contentType || size == null) {
    return res.status(400).json({ feil: 'Manglende filinfo (filnavn, contentType, size).' });
  }

  const ext = path.extname(filnavn).toLowerCase();
  if (!TILLATTE_VIDEO_EXT.includes(ext) || !TILLATTE_VIDEO_TYPER.includes(contentType)) {
    return res.status(400).json({ feil: 'Filformatet er ikke tillatt. Kun MP4, WebM og MOV er tillatt.' });
  }
  if (size > MAX_VIDEO_BYTES) {
    return res.status(400).json({ feil: 'Videoen er for stor. Maks 100 MB er tillatt.' });
  }

  try {
    const uid = req.user.uid;
    const profilRef = adminDB.collection('users').doc(uid).collection('profilData').doc('main');
    const profilDoc = await profilRef.get();

    // Slett gammel video fra Storage hvis den finnes
    if (profilDoc.exists && profilDoc.data().videoPath) {
      await slettGammelVideoFraStorage(profilDoc.data().videoPath);
    }

    const storagePath = `profileVideos/${uid}/intro${ext}`;
    const bucket = adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET);
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutter
      contentType
    });

    // Marker at opplasting er i gang
    await profilRef.set({
      uploadPending: true,
      uploadPendingAt: new Date().toISOString(),
      uploadPendingStopath: storagePath
    }, { merge: true });

    res.json({ ok: true, signedUrl, storagePath, contentType });
  } catch (err) {
    console.error('Video signed-url feil:', err);
    res.status(500).json({ feil: 'Kunne ikke klargjøre opplasting. Prøv igjen.' });
  }
});

/**
 * POST /api/cv/video/confirm
 * Bekrefter at klienten har lastet opp videofilen direkte til Storage.
 * Backend verifiserer at filen finnes, gjør den offentlig og skriver metadata til Firestore.
 */
ruter.post('/video/confirm', krevAuth, krevRolle('laerling'), async (req, res) => {
  const { storagePath, filnavn, contentType, size } = req.body;

  if (!storagePath || !filnavn || !contentType || size == null) {
    return res.status(400).json({ feil: 'Manglende feltinfo.' });
  }

  // Eiersjekk: storagePath må tilhøre denne brukeren
  const forventetPrefix = `profileVideos/${req.user.uid}/`;
  if (!storagePath.startsWith(forventetPrefix)) {
    return res.status(403).json({ feil: 'Ingen tilgang til denne lagringsbanen.' });
  }

  try {
    const bucket = adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET);
    const fil = bucket.file(storagePath);
    const [exists] = await fil.exists();
    if (!exists) {
      return res.status(400).json({ feil: 'Videofil ble ikke funnet etter opplasting. Prøv igjen.' });
    }

    const [videoURL] = await fil.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 år
    });

    const now = new Date().toISOString();
    await adminDB.collection('users').doc(req.user.uid)
      .collection('profilData').doc('main')
      .set({
        videoPath:        storagePath,
        videoURL,
        videoFilnavn:     filnavn,
        videoContentType: contentType,
        videoSize:        size,
        videoUploadedAt:  now,
        videoUpdatedAt:   now,
        uploadPending:        false,
        uploadPendingAt:      null,
        uploadPendingStopath: null
      }, { merge: true });

    res.json({ ok: true, videoURL, videoFilnavn: filnavn });
  } catch (err) {
    console.error('Video confirm feil:', err);
    res.status(500).json({ feil: 'Kunne ikke lagre videoinformasjon. Prøv igjen.' });
  }
});

/**
 * DELETE /api/cv/video
 * Sletter videopresentasjonen fra Firebase Storage og fjerner metadata fra Firestore.
 */
ruter.delete('/video', krevAuth, krevRolle('laerling'), async (req, res) => {
  try {
    const profilRef = adminDB.collection('users').doc(req.user.uid)
      .collection('profilData').doc('main');
    const doc = await profilRef.get();

    if (doc.exists && doc.data().videoPath) {
      await slettGammelVideoFraStorage(doc.data().videoPath);
    }

    await profilRef.set({
      videoPath:        null,
      videoURL:         null,
      videoFilnavn:     null,
      videoContentType: null,
      videoSize:        null,
      videoUploadedAt:  null,
      videoUpdatedAt:   null,
      uploadPending:    false
    }, { merge: true });

    res.json({ ok: true, melding: 'Videopresentasjonen er slettet.' });
  } catch (err) {
    console.error('Video sletting feil:', err);
    res.status(500).json({ feil: 'Kunne ikke slette videoen. Prøv igjen.' });
  }
});

export default ruter;
