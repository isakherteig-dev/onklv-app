import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminDB } from '../firebase/config.js';
import { krevAuth, krevRolle } from '../middleware/auth.js';

const ruter = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROSJEKTROT = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(PROSJEKTROT, 'uploads');
const TILLATTE_FILTYPER = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const TILLATTE_ENDINGER = ['.pdf', '.docx'];

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function lagTrygtFilnavn(originalnavn) {
  const basename = path.basename(originalnavn || 'vedlegg');
  const ext = path.extname(basename).toLowerCase();
  const navnUtenExt = path.basename(basename, ext)
    .normalize('NFKD')
    .replace(/[^\w.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const sikkertNavn = `${navnUtenExt || 'vedlegg'}${ext}`;
  return `${Date.now()}-${sikkertNavn}`;
}

function slettVedleggFil(relativSti) {
  if (!relativSti) return;
  const fullSti = path.join(PROSJEKTROT, relativSti);
  if (fs.existsSync(fullSti)) {
    fs.unlinkSync(fullSti);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, lagTrygtFilnavn(file.originalname))
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const gyldigFiltype = TILLATTE_FILTYPER.includes(file.mimetype) && TILLATTE_ENDINGER.includes(ext);
    if (gyldigFiltype) { cb(null, true); return; }
    cb(new Error('Kun PDF og DOCX-filer er tillatt'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

function haandterValgfrittVedlegg(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) { next(); return; }
  upload.single('vedlegg')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ feil: 'CV-en er for stor. Maks filstørrelse er 5 MB.' });
      return;
    }
    if (err) { res.status(400).json({ feil: err.message || 'Kunne ikke laste opp CV.' }); return; }
    next();
  });
}

async function lagVarsel(mottakerId, type, tittel, melding, lenke) {
  try {
    await adminDB.collection('varsler').add({
      mottaker_id: mottakerId,
      type,
      tittel,
      melding: melding || null,
      lenke: lenke || null,
      lest: false,
      opprettet: new Date()
    });
  } catch { /* varsler er ikke kritiske */ }
}

function soknadTilObj(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    ...d,
    sendt_dato: d.sendt_dato?.toDate?.()?.toISOString?.() ?? d.sendt_dato ?? null,
    behandlet_dato: d.behandlet_dato?.toDate?.()?.toISOString?.() ?? d.behandlet_dato ?? null
  };
}

// Hjelper: hent søknad + tilhørende læreplass i ett kall
async function hentSoknadOgPlass(soknadId) {
  const sokDoc = await adminDB.collection('soknader').doc(soknadId).get();
  if (!sokDoc.exists) return { soknad: null, plass: null };

  const soknad = { id: sokDoc.id, ...sokDoc.data() };

  const plassDoc = await adminDB.collection('laereplasser').doc(soknad.laerplass_id).get();
  const plass = plassDoc.exists ? { id: plassDoc.id, ...plassDoc.data() } : null;

  return { soknad, plass };
}

// GET /api/soknader/mine — lærlingens egne søknader
ruter.get('/mine', krevAuth, krevRolle('laerling'), async (req, res) => {
  try {
    const snap = await adminDB.collection('soknader')
      .where('laerling_user_id', '==', req.user.uid)
      .orderBy('sendt_dato', 'desc')
      .get();

    // Hent tilhørende læreplasser i parallell
    const soknader = snap.docs.map(soknadTilObj);
    const plassIds = [...new Set(soknader.map(s => s.laerplass_id))];
    const plassDocs = await Promise.all(
      plassIds.map(id => adminDB.collection('laereplasser').doc(id).get())
    );
    const plassMap = {};
    plassDocs.forEach(d => { if (d.exists) plassMap[d.id] = d.data(); });

    const resultat = soknader.map(s => {
      const p = plassMap[s.laerplass_id] || {};
      return {
        ...s,
        tittel: p.tittel,
        frist: p.frist,
        sted: p.sted,
        bedrift_navn: p.bedrift_navn,
        fagomraade: p.fagomraade
      };
    });

    res.json(resultat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente søknader' });
  }
});

// GET /api/soknader/bedrift — bedriftens innkomne søknader
ruter.get('/bedrift', krevAuth, krevRolle('bedrift'), async (req, res) => {
  try {
    const { laerplass_id } = req.query;

    // Finn bedriftens læreplasser
    let plassSnap;
    if (laerplass_id) {
      const doc = await adminDB.collection('laereplasser').doc(laerplass_id).get();
      plassSnap = doc.exists && doc.data().bedrift_user_id === req.user.uid ? [doc] : [];
    } else {
      const snap = await adminDB.collection('laereplasser')
        .where('bedrift_user_id', '==', req.user.uid)
        .get();
      plassSnap = snap.docs;
    }

    const plassIds = plassSnap.map(d => d.id);
    const plassMap = {};
    plassSnap.forEach(d => { plassMap[d.id] = d.data(); });

    if (plassIds.length === 0) return res.json([]);

    // Firestore 'in' støtter maks 30 elementer
    const chunks = [];
    for (let i = 0; i < plassIds.length; i += 30) chunks.push(plassIds.slice(i, i + 30));

    let soknader = [];
    for (const chunk of chunks) {
      const sokSnap = await adminDB.collection('soknader')
        .where('laerplass_id', 'in', chunk)
        .orderBy('sendt_dato', 'desc')
        .get();
      soknader.push(...sokSnap.docs.map(d => {
        const data = soknadTilObj(d);
        const p = plassMap[data.laerplass_id] || {};
        return { ...data, laerplass_tittel: p.tittel };
      }));
    }

    soknader.sort((a, b) => new Date(b.sendt_dato) - new Date(a.sendt_dato));
    res.json(soknader);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente søknader' });
  }
});

// GET /api/soknader/admin — alle søknader (admin)
ruter.get('/admin', krevAuth, krevRolle('admin'), async (req, res) => {
  try {
    const { status, sok } = req.query;

    let q = adminDB.collection('soknader');
    if (status && status !== 'alle') q = q.where('status', '==', status);
    q = q.orderBy('sendt_dato', 'desc');

    const snap = await q.get();
    const soknader = snap.docs.map(soknadTilObj);

    // Berik med læreplasstittel og bedriftsnavn
    const plassIds = [...new Set(soknader.map(s => s.laerplass_id))];
    const plassDocs = await Promise.all(
      plassIds.map(id => adminDB.collection('laereplasser').doc(id).get())
    );
    const plassMap = {};
    plassDocs.forEach(d => { if (d.exists) plassMap[d.id] = d.data(); });

    let resultat = soknader.map(s => {
      const p = plassMap[s.laerplass_id] || {};
      return {
        ...s,
        laerplass_tittel: p.tittel,
        bedrift_navn: p.bedrift_navn,
        bedrift_user_id: p.bedrift_user_id
      };
    });

    if (sok) {
      const s = sok.toLowerCase();
      resultat = resultat.filter(r =>
        r.laerling_naam?.toLowerCase().includes(s) ||
        r.laerplass_tittel?.toLowerCase().includes(s) ||
        r.bedrift_navn?.toLowerCase().includes(s)
      );
    }

    res.json(resultat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente søknader' });
  }
});

// GET /api/soknader/stats — søknadsstatistikk (admin)
ruter.get('/stats', krevAuth, krevRolle('admin'), async (req, res) => {
  try {
    const statuser = ['sendt', 'under_behandling', 'godkjent', 'avslatt', 'trukket'];
    const [counts, aktivePlass] = await Promise.all([
      Promise.all(statuser.map(s =>
        adminDB.collection('soknader').where('status', '==', s).count().get()
          .then(snap => ({ status: s, antall: snap.data().count }))
      )),
      adminDB.collection('laereplasser').where('aktiv', '==', true).count().get()
    ]);

    const stats = { sendt: 0, under_behandling: 0, godkjent: 0, avslatt: 0, trukket: 0, totalt: 0 };
    counts.forEach(({ status, antall }) => {
      stats[status] = antall;
      stats.totalt += antall;
    });
    stats.aktiveLaereplasser = aktivePlass.data().count;

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente statistikk' });
  }
});

// POST /api/soknader — send søknad (lærling)
ruter.post('/', krevAuth, krevRolle('laerling'), haandterValgfrittVedlegg, async (req, res) => {
  const laerplassId = req.body.laerplass_id;
  const { melding, erfaring, vg1, vg2, telefon } = req.body;
  const vedleggSti = req.file ? path.posix.join('uploads', req.file.filename) : null;
  const vedleggOriginalnavn = req.file?.originalname || null;

  if (!laerplassId) {
    if (vedleggSti) slettVedleggFil(vedleggSti);
    return res.status(400).json({ feil: 'Mangler laerplass_id' });
  }
  if (!melding || melding.trim().length < 10) {
    if (vedleggSti) slettVedleggFil(vedleggSti);
    return res.status(400).json({ feil: 'Motivasjon er påkrevd (minst 10 tegn)' });
  }

  try {
    // Sjekk duplikat
    const dupSnap = await adminDB.collection('soknader')
      .where('laerling_user_id', '==', req.user.uid)
      .where('laerplass_id', '==', laerplassId)
      .limit(1).get();

    if (!dupSnap.empty) {
      if (vedleggSti) slettVedleggFil(vedleggSti);
      return res.status(409).json({ feil: 'Du har allerede søkt på denne lærlingplassen' });
    }

    // Sjekk at læreplassen eksisterer og er aktiv
    const plassDoc = await adminDB.collection('laereplasser').doc(laerplassId).get();
    if (!plassDoc.exists || !plassDoc.data().aktiv) {
      if (vedleggSti) slettVedleggFil(vedleggSti);
      return res.status(404).json({ feil: 'Læreplassen finnes ikke eller er ikke lenger aktiv' });
    }
    const plass = plassDoc.data();

    const ref = await adminDB.collection('soknader').add({
      laerling_user_id:  req.user.uid,
      laerling_naam:     req.user.navn || null,
      laerling_epost:    req.user.epost || null,
      utdanningsprogram: req.user.utdanningsprogram || null,
      skole:             req.user.skole || null,
      laerplass_id:      laerplassId,
      melding,
      erfaring:          erfaring || null,
      vg1:               vg1 || null,
      vg2:               vg2 || null,
      telefon:           telefon || null,
      vedlegg:           vedleggSti,
      vedlegg_originalnavn: vedleggOriginalnavn,
      admin_kommentar:   null,
      behandlet_av:      null,
      behandlet_dato:    null,
      status:            'sendt',
      sendt_dato:        new Date()
    });

    // Varsle admin og bedrift
    await Promise.all([
      lagVarsel('admin', 'ny_soknad',
        'Ny søknad mottatt',
        `${req.user.navn || 'En lærling'} har søkt på "${plass.tittel}"`,
        '/admin/soknader.html'
      ),
      lagVarsel(plass.bedrift_user_id, 'ny_soknad',
        'Ny søknad på din læreplasse',
        `${req.user.navn || 'En lærling'} har søkt på "${plass.tittel}"`,
        '/bedrift/soknader.html'
      )
    ]);

    res.status(201).json({ ok: true, id: ref.id });
  } catch (err) {
    if (vedleggSti) slettVedleggFil(vedleggSti);
    console.error('Kunne ikke lagre søknad:', err);
    res.status(500).json({ feil: 'Kunne ikke lagre søknaden. Prøv igjen.' });
  }
});

// PATCH /api/soknader/:id/status — oppdater status (bedrift eller admin)
ruter.patch('/:id/status', krevAuth, krevRolle('bedrift', 'admin'), async (req, res) => {
  const { status, admin_kommentar } = req.body;
  const gyldige = ['sendt', 'under_behandling', 'godkjent', 'avslatt', 'trukket'];
  if (!gyldige.includes(status)) {
    return res.status(400).json({ feil: 'Ugyldig status' });
  }

  try {
    const { soknad, plass } = await hentSoknadOgPlass(req.params.id);
    if (!soknad || !plass) return res.status(404).json({ feil: 'Søknad ikke funnet' });

    // Bedrift kan kun endre sine egne søknader
    if (req.user.rolle !== 'admin' && plass.bedrift_user_id !== req.user.uid) {
      return res.status(404).json({ feil: 'Søknad ikke funnet' });
    }

    const oppdatering = {
      status,
      behandlet_av: req.user.uid,
      behandlet_dato: new Date()
    };
    if (admin_kommentar) oppdatering.admin_kommentar = admin_kommentar;

    await adminDB.collection('soknader').doc(req.params.id).update(oppdatering);

    // Varsle lærlingen
    const meldingMap = {
      under_behandling: `Din søknad på "${plass.tittel}" er nå under behandling.`,
      godkjent:         `Gratulerer! Din søknad på "${plass.tittel}" er godkjent!`,
      avslatt:          `Din søknad på "${plass.tittel}" ble dessverre avslått.`
    };
    if (meldingMap[status]) {
      await lagVarsel(
        soknad.laerling_user_id,
        `soknad_${status}`,
        status === 'godkjent' ? 'Søknad godkjent!' : status === 'avslatt' ? 'Søknad avslått' : 'Søknad under behandling',
        meldingMap[status],
        '/laerling/mine-soknader.html'
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke oppdatere status' });
  }
});

// GET /api/soknader/:id/vedlegg — last ned vedlegg for søknad
ruter.get('/:id/vedlegg', krevAuth, async (req, res) => {
  try {
    const { soknad, plass } = await hentSoknadOgPlass(req.params.id);

    if (!soknad || !soknad.vedlegg) {
      return res.status(404).json({ feil: 'Ingen CV funnet for denne søknaden' });
    }

    const harTilgang = req.user.rolle === 'admin'
      || (req.user.rolle === 'laerling' && soknad.laerling_user_id === req.user.uid)
      || (req.user.rolle === 'bedrift' && plass?.bedrift_user_id === req.user.uid);

    if (!harTilgang) {
      return res.status(403).json({ feil: 'Ingen tilgang til vedlegget' });
    }

    const fullSti = path.join(PROSJEKTROT, soknad.vedlegg);
    if (!fs.existsSync(fullSti)) {
      return res.status(404).json({ feil: 'CV-filen ble ikke funnet på serveren' });
    }

    res.download(fullSti, soknad.vedlegg_originalnavn || path.basename(soknad.vedlegg));
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke laste ned vedlegg' });
  }
});

// DELETE /api/soknader/:id — trekk søknad (lærling, kun hvis status=sendt)
ruter.delete('/:id', krevAuth, krevRolle('laerling'), async (req, res) => {
  try {
    const doc = await adminDB.collection('soknader').doc(req.params.id).get();

    if (!doc.exists || doc.data().laerling_user_id !== req.user.uid) {
      return res.status(404).json({ feil: 'Søknad ikke funnet' });
    }

    const soknad = doc.data();
    if (soknad.status !== 'sendt') {
      return res.status(400).json({ feil: 'Kan bare trekke søknader med status "sendt"' });
    }

    if (soknad.vedlegg) slettVedleggFil(soknad.vedlegg);

    await doc.ref.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke trekke søknaden' });
  }
});

export default ruter;
