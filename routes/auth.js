import { Router } from 'express';
import { adminAuth, adminDB, adminStorage } from '../firebase/config.js';
import { krevAuth } from '../middleware/auth.js';
import { sendVerifiseringsEpost } from '../tools/epost.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import { bedriftHarRelasjonTilLaerling } from '../utils/relasjonssjekk.js';

// IP-basert rate limiter for uautentiserte endepunkter (register)
function ipRateLimiter(maks = 5, vindusMs = 600_000) {
  return (req, res, next) => {
    req.user = { uid: req.ip || 'unknown-ip' };
    rateLimiter(maks, vindusMs)(req, res, next);
  };
}

const registerLimit = ipRateLimiter(5, 10 * 60 * 1000); // 5 per 10 min per IP
const verifiseringLimit = rateLimiter(3, 10 * 60 * 1000); // 3 per 10 min per bruker

const ruter = Router();

/**
 * POST /api/auth/register
 */
ruter.post('/register', registerLimit, async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ feil: 'Ikke innlogget' });

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch (err) {
    console.error('Token-verifisering feilet:', err);
    return res.status(401).json({ feil: 'Ugyldig token' });
  }

  const { navn, epost, telefon, rolle, utdanningsprogram, skole, bio,
          orgNr, bransje, bedriftBeskrivelse, samtykkeVersjon } = req.body;

  if (!navn || !epost || !rolle) {
    return res.status(400).json({ feil: 'Mangler påkrevde felt (navn, epost, rolle)' });
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
    res.status(500).json({ feil: 'Kunne ikke registrere bruker' });
  }
});

/**
 * POST /api/auth/send-verifisering
 * Genererer 6-sifret kode, lagrer i Firestore, sender på e-post.
 */
ruter.post('/send-verifisering', verifiseringLimit, async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ feil: 'Ikke innlogget' });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const ref = adminDB.collection('users').doc(decoded.uid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ feil: 'Bruker ikke funnet' });

    const { epost } = doc.data();
    const kode = String(Math.floor(100000 + Math.random() * 900000));
    const utloper = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await ref.update({
      verifiseringKode: kode,
      verifiseringUtloper: utloper,
      verifiseringForsok: 0,
      epostVerifisert: false
    });

    await sendVerifiseringsEpost(epost, kode);
    res.json({ ok: true });
  } catch (err) {
    console.error('send-verifisering feil:', err);
    res.status(500).json({ feil: 'Kunne ikke sende verifiseringskode' });
  }
});

/**
 * POST /api/auth/verifiser-kode
 * Sjekker kode mot Firestore, markerer brukeren som verifisert.
 */
ruter.post('/verifiser-kode', async (req, res) => {
  const { uid, kode } = req.body;
  if (!uid || !kode) return res.status(400).json({ feil: 'Mangler uid eller kode' });

  try {
    const ref = adminDB.collection('users').doc(uid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ feil: 'Bruker ikke funnet' });

    const data = doc.data();

    // Maks 5 forsøk
    const forsok = data.verifiseringForsok || 0;
    if (forsok >= 5) {
      return res.status(400).json({ feil: 'For mange forsøk. Be om en ny kode.' });
    }

    // Sjekk utløp
    const utloper = data.verifiseringUtloper?.toDate?.() ?? data.verifiseringUtloper;
    if (!utloper || new Date() > new Date(utloper)) {
      return res.status(400).json({ feil: 'Koden har utløpt. Be om en ny kode.' });
    }

    // Sjekk kode
    if (String(data.verifiseringKode) !== String(kode)) {
      await ref.update({ verifiseringForsok: forsok + 1 });
      const gjenvaerende = 4 - forsok;
      return res.status(400).json({
        feil: gjenvaerende > 0
          ? `Feil kode. Prøv igjen. (${gjenvaerende} forsøk igjen)`
          : 'Feil kode. Be om en ny kode.'
      });
    }

    // Korrekt — marker som verifisert og rydd opp
    await ref.update({
      epostVerifisert: true,
      verifiseringKode: null,
      verifiseringUtloper: null,
      verifiseringForsok: null
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('verifiser-kode feil:', err);
    res.status(500).json({ feil: 'Kunne ikke verifisere koden' });
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
    const erGoogle = firebaseUser.providerData?.some(p => p.providerId === 'google.com');
    if (!erGoogle && data.epostVerifisert !== true) {
      return res.status(403).json({ feil: 'Du må verifisere e-posten din først.' });
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
 * GET /api/auth/bruker/:uid
 * Henter offentlig brukerdata for en spesifikk lærling (for admin/bedrift).
 */
ruter.get('/bruker/:uid', krevAuth, async (req, res) => {
  const { uid } = req.params;

  if (req.user.uid !== uid) {
    if (req.user.rolle === 'admin') {
      // Admin har alltid tilgang
    } else if (req.user.rolle === 'bedrift') {
      const harRelasjon = await bedriftHarRelasjonTilLaerling(req.user.uid, uid);
      if (!harRelasjon) {
        return res.status(403).json({ feil: 'Ingen tilgang — ingen aktiv søknad/relasjon' });
      }
    } else {
      return res.status(403).json({ feil: 'Ingen tilgang' });
    }
  }

  try {
    const userDoc = await adminDB.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ feil: 'Bruker ikke funnet' });
    }

    const d = userDoc.data();
    // Returner kun det som er nødvendig — ikke sensitiv intern data
    res.json({
      uid: d.uid,
      navn: d.navn,
      utdanningsprogram: d.utdanningsprogram || null,
      skole: d.skole || null,
      bio: d.bio || null,
      cv_url: d.cv_url || null,
      cv_filnavn: d.cv_filnavn || null,
      avatar_url: d.avatar_url || null,
      rolle: d.rolle,
      epost: req.user.rolle === 'admin' ? d.epost : undefined
    });
  } catch (err) {
    console.error('Bruker henting feil:', err);
    res.status(500).json({ feil: 'Kunne ikke hente brukerdata' });
  }
});

/**
 * GET /api/auth/profildata
 * Henter profilData/main for innlogget bruker (eller annen bruker hvis admin/bedrift).
 */
ruter.get('/profildata', krevAuth, async (req, res) => {
  const targetUid = req.query.uid;

  // Kun innlogget bruker selv, admin eller bedrift kan se profildata
  if (targetUid && targetUid !== req.user.uid) {
    if (req.user.rolle === 'admin') {
      // Admin har alltid tilgang
    } else if (req.user.rolle === 'bedrift') {
      const harRelasjon = await bedriftHarRelasjonTilLaerling(req.user.uid, targetUid);
      if (!harRelasjon) {
        return res.status(403).json({ feil: 'Ingen tilgang — ingen aktiv søknad/relasjon' });
      }
    } else {
      return res.status(403).json({ feil: 'Ingen tilgang' });
    }
  }

  const uid = targetUid || req.user.uid;

  try {
    const doc = await adminDB.collection('users').doc(uid).collection('profilData').doc('main').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (err) {
    console.error('Profildata henting feil:', err);
    res.status(500).json({ feil: 'Kunne ikke hente profildata' });
  }
});

/**
 * PATCH /api/auth/profildata
 * Lagrer profilData/main for innlogget bruker (kun sin egen).
 * Tillatte felter: referanser, ferdigheter, portefolje, tidslinje, motivasjon,
 *                  sted, alder, kanStarte, stillingsprosent, tilgjengeligeDager, harReferanse
 */
ruter.patch('/profildata', krevAuth, async (req, res) => {
  if (req.user.rolle !== 'laerling') {
    return res.status(403).json({ feil: 'Kun lærlinger kan oppdatere profildata' });
  }

  const TILLATTE_FELTER = [
    'referanser', 'ferdigheter', 'portefolje', 'tidslinje',
    'motivasjon', 'sted', 'alder', 'kanStarte',
    'stillingsprosent', 'tilgjengeligeDager', 'harReferanse'
  ];

  const oppdatering = {};
  for (const felt of TILLATTE_FELTER) {
    if (req.body[felt] !== undefined) oppdatering[felt] = req.body[felt];
  }

  if (Object.keys(oppdatering).length === 0) {
    return res.status(400).json({ feil: 'Ingen gyldige felt å oppdatere' });
  }

  try {
    const ref = adminDB.collection('users').doc(req.user.uid).collection('profilData').doc('main');
    await ref.set(oppdatering, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('Profildata oppdatering feil:', err);
    res.status(500).json({ feil: 'Kunne ikke lagre profildata' });
  }
});

/**
 * DELETE /api/auth/slett-konto
 */
ruter.delete('/slett-konto', krevAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    // Hent brukerdata og profildata for å finne Storage-filer
    const userDoc = await adminDB.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const profilDoc = await adminDB.collection('users').doc(uid)
      .collection('profilData').doc('main').get();
    const profilData = profilDoc.exists ? profilDoc.data() : {};

    // Slett Storage-filer (avatar, CV, video)
    const bucket = adminStorage.bucket(process.env.FB_STORAGE_BUCKET || 'onklv-app.firebasestorage.app');
    const filerASlette = [];

    if (userData.avatar_url && userData.avatar_url.includes('storage.googleapis.com')) {
      try {
        const url = new URL(userData.avatar_url);
        const filnavn = decodeURIComponent(url.pathname.replace(`/${bucket.name}/`, ''));
        filerASlette.push(bucket.file(filnavn).delete().catch(() => {}));
      } catch { /* ikke kritisk */ }
    }

    if (userData.cv_url && userData.cv_url.includes('storage.googleapis.com')) {
      try {
        const url = new URL(userData.cv_url);
        const filnavn = decodeURIComponent(url.pathname.replace(`/${bucket.name}/`, ''));
        filerASlette.push(bucket.file(filnavn).delete().catch(() => {}));
      } catch { /* ikke kritisk */ }
    }

    if (profilData.videoPath) {
      filerASlette.push(bucket.file(profilData.videoPath).delete().catch(() => {}));
    }

    await Promise.all(filerASlette);

    // Slett Firestore-data i parallell
    const [soknaderSnap, laereplasserSnap, varslerSnap, chatSnap] = await Promise.all([
      adminDB.collection('soknader').where('laerling_user_id', '==', uid).get(),
      adminDB.collection('laereplasser').where('bedrift_user_id', '==', uid).get(),
      adminDB.collection('varsler').where('mottaker_id', '==', uid).get(),
      adminDB.collection('chat_meldinger').where('avsender_id', '==', uid).get()
    ]);

    // Slett vedlegg fra Storage for alle søknader
    const vedleggSletting = soknaderSnap.docs
      .map(d => d.data().vedlegg)
      .filter(url => url && url.includes('storage.googleapis.com'))
      .map(url => {
        try {
          const parsedUrl = new URL(url);
          const filnavn = decodeURIComponent(parsedUrl.pathname.replace(`/${bucket.name}/`, ''));
          return bucket.file(filnavn).delete().catch(() => {});
        } catch { return Promise.resolve(); }
      });
    await Promise.all(vedleggSletting);

    // Hent chatmeldinger der brukeren er mottaker (via søknader)
    const soknadIder = soknaderSnap.docs.map(d => d.id);
    let chatMottakerDocs = [];
    if (soknadIder.length > 0) {
      const chunks = [];
      for (let i = 0; i < soknadIder.length; i += 30) chunks.push(soknadIder.slice(i, i + 30));
      const chunkResults = await Promise.all(
        chunks.map(chunk => adminDB.collection('chat_meldinger').where('soknad_id', 'in', chunk).get())
      );
      chatMottakerDocs = chunkResults.flatMap(s => s.docs);
    }

    const batch = adminDB.batch();
    soknaderSnap.docs.forEach(d => batch.delete(d.ref));
    laereplasserSnap.docs.forEach(d => batch.delete(d.ref));
    varslerSnap.docs.forEach(d => batch.delete(d.ref));
    chatSnap.docs.forEach(d => batch.delete(d.ref));
    chatMottakerDocs.forEach(d => batch.delete(d.ref));

    // Slett profilData subcollection
    if (profilDoc.exists) batch.delete(profilDoc.ref);

    // Slett rate_limits for denne brukeren
    const rateLimitSnap = await adminDB.collection('rate_limits')
      .where('uid', '==', uid).get();
    rateLimitSnap.docs.forEach(d => batch.delete(d.ref));

    // Slett selve brukerdokumentet
    batch.delete(adminDB.collection('users').doc(uid));
    await batch.commit();

    // Revoke tokens og slett Firebase Auth-bruker
    await adminAuth.revokeRefreshTokens(uid);
    await adminAuth.deleteUser(uid);

    res.json({ ok: true, melding: 'Kontoen din er slettet.' });
  } catch (err) {
    console.error('Sletting av konto feilet:', err);
    res.status(500).json({ feil: 'Kunne ikke slette kontoen din. Prøv igjen.' });
  }
});

export default ruter;
