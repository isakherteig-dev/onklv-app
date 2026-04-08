import { adminDB } from '../firebase/config.js';

/**
 * Sjekker om en bedrift har en dokumentert relasjon til en lærling
 * (dvs. lærlingen har en søknad på en av bedriftens læreplasser).
 * @param {string} bedriftUid - Bedriftens uid
 * @param {string} laerlingUid - Lærlingens uid
 * @returns {Promise<boolean>}
 */
export async function bedriftHarRelasjonTilLaerling(bedriftUid, laerlingUid) {
  // Finn bedriftens læreplasser
  const plassSnap = await adminDB.collection('laereplasser')
    .where('bedrift_user_id', '==', bedriftUid)
    .get();

  if (plassSnap.empty) return false;

  const plassIds = plassSnap.docs.map(d => d.id);

  // Sjekk om lærlingen har søkt på noen av dem (chunks of 30 for Firestore 'in')
  for (let i = 0; i < plassIds.length; i += 30) {
    const chunk = plassIds.slice(i, i + 30);
    const soknadSnap = await adminDB.collection('soknader')
      .where('laerplass_id', 'in', chunk)
      .where('laerling_user_id', '==', laerlingUid)
      .limit(1)
      .get();

    if (!soknadSnap.empty) return true;
  }

  return false;
}
