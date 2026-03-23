import { Router } from 'express';
import { getDB } from '../db/init.js';
import { krevAuth } from '../middleware/auth.js';

const ruter = Router();

function lagVarsel(db, mottakerId, type, tittel, melding, lenke) {
  try {
    db.prepare(`INSERT INTO varsler (mottaker_id, type, tittel, melding, lenke) VALUES (?,?,?,?,?)`)
      .run(mottakerId, type, tittel, melding, lenke || null);
  } catch { /* varsler er ikke kritiske */ }
}

function hentSoknadMedTilgang(db, soknadId, uid, rolle) {
  const soknad = db.prepare(`
    SELECT s.id, s.laerling_user_id, s.laerling_naam, s.laerling_epost,
           l.bedrift_user_id, l.tittel AS laerplass_tittel, l.bedrift_naam
    FROM soknader s
    JOIN laereplasser l ON l.id = s.laerplass_id
    WHERE s.id = ?
  `).get(soknadId);

  if (!soknad) return null;

  const harTilgang =
    rolle === 'admin' ||
    (rolle === 'laerling' && soknad.laerling_user_id === uid) ||
    (rolle === 'bedrift'  && soknad.bedrift_user_id  === uid);

  return harTilgang ? soknad : null;
}

// GET /api/chat/:soknad_id — hent meldinger for en søknad
ruter.get('/:soknad_id', krevAuth, (req, res) => {
  const soknadId = Number.parseInt(req.params.soknad_id, 10);
  if (!Number.isInteger(soknadId)) {
    return res.status(400).json({ feil: 'Ugyldig søknad-id' });
  }

  const db = getDB();
  const soknad = hentSoknadMedTilgang(db, soknadId, req.user.uid, req.user.rolle);
  if (!soknad) return res.status(403).json({ feil: 'Ingen tilgang til denne chatten' });

  const meldinger = db.prepare(`
    SELECT id, avsender_id, tekst, lest, opprettet
    FROM chat_meldinger
    WHERE soknad_id = ?
    ORDER BY opprettet ASC
  `).all(soknadId);

  // Marker motpartens meldinger som lest
  const motpartId = req.user.rolle === 'laerling'
    ? soknad.bedrift_user_id
    : soknad.laerling_user_id;

  db.prepare(`
    UPDATE chat_meldinger SET lest = 1
    WHERE soknad_id = ? AND avsender_id = ? AND lest = 0
  `).run(soknadId, motpartId);

  res.json({ meldinger, soknad });
});

// POST /api/chat/:soknad_id — send melding
ruter.post('/:soknad_id', krevAuth, (req, res) => {
  const soknadId = Number.parseInt(req.params.soknad_id, 10);
  if (!Number.isInteger(soknadId)) {
    return res.status(400).json({ feil: 'Ugyldig søknad-id' });
  }

  const tekst = (req.body.tekst || '').trim();
  if (!tekst) {
    return res.status(400).json({ feil: 'Meldingen kan ikke være tom' });
  }
  if (tekst.length > 2000) {
    return res.status(400).json({ feil: 'Meldingen er for lang (maks 2000 tegn)' });
  }

  const db = getDB();
  const soknad = hentSoknadMedTilgang(db, soknadId, req.user.uid, req.user.rolle);
  if (!soknad) return res.status(403).json({ feil: 'Ingen tilgang til denne chatten' });

  const id = db.prepare(`
    INSERT INTO chat_meldinger (soknad_id, avsender_id, tekst)
    VALUES (?, ?, ?)
  `).run(soknadId, req.user.uid, tekst).lastInsertRowid;

  // Varsle mottakeren
  const erLaerling = req.user.rolle === 'laerling';
  const mottakerId = erLaerling ? soknad.bedrift_user_id : soknad.laerling_user_id;
  const avsenderNavn = req.user.navn || (erLaerling ? 'Lærlingen' : soknad.bedrift_naam || 'Bedriften');
  const lenke = erLaerling ? '/bedrift/soknader.html' : '/laerling/mine-soknader.html';

  lagVarsel(
    db,
    mottakerId,
    'ny_chat_melding',
    `Ny melding fra ${avsenderNavn}`,
    `Ang. "${soknad.laerplass_tittel}": ${tekst.slice(0, 80)}${tekst.length > 80 ? '…' : ''}`,
    lenke
  );

  res.status(201).json({ ok: true, id });
});

// GET /api/chat/:soknad_id/uleste — antall uleste meldinger fra motparten
ruter.get('/:soknad_id/uleste', krevAuth, (req, res) => {
  const soknadId = Number.parseInt(req.params.soknad_id, 10);
  if (!Number.isInteger(soknadId)) {
    return res.status(400).json({ feil: 'Ugyldig søknad-id' });
  }

  const db = getDB();
  const soknad = hentSoknadMedTilgang(db, soknadId, req.user.uid, req.user.rolle);
  if (!soknad) return res.status(403).json({ feil: 'Ingen tilgang' });

  const motpartId = req.user.rolle === 'laerling'
    ? soknad.bedrift_user_id
    : soknad.laerling_user_id;

  const row = db.prepare(`
    SELECT COUNT(*) AS antall FROM chat_meldinger
    WHERE soknad_id = ? AND avsender_id = ? AND lest = 0
  `).get(soknadId, motpartId);

  res.json({ antall: row.antall });
});

export default ruter;
