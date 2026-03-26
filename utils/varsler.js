import { adminDB } from '../firebase/config.js';

export async function lagVarsel(mottakerId, type, tittel, melding, lenke) {
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
