import { Router } from 'express';
import { adminDB } from '../firebase/config.js';
import { krevAuth } from '../middleware/auth.js';
import { lagVarsel } from '../utils/varsler.js';

const ruter = Router();


async function hentSoknadMedTilgang(soknadId, uid, rolle) {
  const doc = await adminDB.collection('soknader').doc(soknadId).get();
  if (!doc.exists) return null;

  const s = doc.data();

  // Hent laerplass for bedrift_user_id og tittel
  const plassDoc = await adminDB.collection('laereplasser').doc(s.laerplass_id).get();
  if (!plassDoc.exists) return null;

  const plass = plassDoc.data();

  const soknad = {
    id: doc.id,
    laerling_user_id: s.laerling_user_id,
    laerling_navn: s.laerling_navn || s.laerling_naam,
    laerling_epost: s.laerling_epost,
    bedrift_user_id: plass.bedrift_user_id,
    laerplass_tittel: plass.tittel,
    bedrift_navn: plass.bedrift_navn
  };

  const harTilgang =
    rolle === 'admin' ||
    (rolle === 'laerling' && soknad.laerling_user_id === uid) ||
    (rolle === 'bedrift'  && soknad.bedrift_user_id  === uid);

  return harTilgang ? soknad : null;
}

// GET /api/chat/:soknad_id — hent meldinger for en søknad
ruter.get('/:soknad_id', krevAuth, async (req, res) => {
  try {
    const soknadId = req.params.soknad_id;

    const soknad = await hentSoknadMedTilgang(soknadId, req.user.uid, req.user.rolle);
    if (!soknad) return res.status(403).json({ feil: 'Ingen tilgang til denne chatten' });

    const snap = await adminDB.collection('chat_meldinger')
      .where('soknad_id', '==', soknadId)
      .orderBy('opprettet', 'asc')
      .get();

    const meldinger = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        opprettet: data.opprettet?.toDate?.()?.toISOString?.() ?? data.opprettet ?? null
      };
    });

    // Marker motpartens meldinger som lest (bare for laerling/bedrift, ikke admin)
    const motpartId = req.user.rolle === 'laerling'
      ? soknad.bedrift_user_id
      : req.user.rolle === 'bedrift'
        ? soknad.laerling_user_id
        : null;

    const uleste = motpartId ? snap.docs.filter(d =>
      d.data().avsender_id === motpartId && d.data().lest === false
    ) : [];
    if (uleste.length > 0) {
      const batch = adminDB.batch();
      uleste.forEach(d => batch.update(d.ref, { lest: true }));
      await batch.commit();
    }

    res.json({ meldinger, soknad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente meldinger' });
  }
});

// POST /api/chat/:soknad_id — send melding
ruter.post('/:soknad_id', krevAuth, async (req, res) => {
  const soknadId = req.params.soknad_id;

  const tekst = (req.body.tekst || '').trim();
  if (!tekst) {
    return res.status(400).json({ feil: 'Meldingen kan ikke være tom' });
  }
  if (tekst.length > 2000) {
    return res.status(400).json({ feil: 'Meldingen er for lang (maks 2000 tegn)' });
  }

  try {
    const soknad = await hentSoknadMedTilgang(soknadId, req.user.uid, req.user.rolle);
    if (!soknad) return res.status(403).json({ feil: 'Ingen tilgang til denne chatten' });

    const ref = await adminDB.collection('chat_meldinger').add({
      soknad_id: soknadId,
      avsender_id: req.user.uid,
      tekst,
      lest: false,
      opprettet: new Date()
    });

    // Varsle mottakeren
    const erLaerling = req.user.rolle === 'laerling';
    const mottakerId = erLaerling ? soknad.bedrift_user_id : soknad.laerling_user_id;
    const avsenderNavn = req.user.navn || (erLaerling ? 'Lærlingen' : soknad.bedrift_navn || 'Bedriften');
    const lenke = erLaerling ? '/bedrift/soknader.html' : '/laerling/mine-soknader.html';

    await lagVarsel(
      mottakerId,
      'ny_chat_melding',
      `Ny melding fra ${avsenderNavn}`,
      `Ang. "${soknad.laerplass_tittel}": ${tekst.slice(0, 80)}${tekst.length > 80 ? '…' : ''}`,
      lenke
    );

    res.status(201).json({ ok: true, id: ref.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke sende melding' });
  }
});

// GET /api/chat/:soknad_id/uleste — antall uleste meldinger fra motparten
ruter.get('/:soknad_id/uleste', krevAuth, async (req, res) => {
  const soknadId = req.params.soknad_id;

  try {
    const soknad = await hentSoknadMedTilgang(soknadId, req.user.uid, req.user.rolle);
    if (!soknad) return res.status(403).json({ feil: 'Ingen tilgang' });

    const motpartId = req.user.rolle === 'laerling'
      ? soknad.bedrift_user_id
      : soknad.laerling_user_id;

    const snap = await adminDB.collection('chat_meldinger')
      .where('soknad_id', '==', soknadId)
      .where('avsender_id', '==', motpartId)
      .where('lest', '==', false)
      .count().get();

    res.json({ antall: snap.data().count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ feil: 'Kunne ikke hente uleste meldinger' });
  }
});

export default ruter;
