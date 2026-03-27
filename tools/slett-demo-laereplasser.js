/**
 * slett-demo-laereplasser.js
 * Sletter alle læreplasser merket med isDemoData: true fra Firestore.
 *
 * Kjøres manuelt:
 *   node tools/slett-demo-laereplasser.js
 */

import 'dotenv/config';
import '../firebase/config.js';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

async function main() {
  const snap = await db.collection('laereplasser')
    .where('isDemoData', '==', true)
    .get();

  if (snap.empty) {
    console.log('Ingen demo-læreplasser funnet.');
    process.exit(0);
  }

  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  console.log(`${snap.size} demo-læreplasser slettet.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Feil:', err);
  process.exit(1);
});
