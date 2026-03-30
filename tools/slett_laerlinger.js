/**
 * tools/slett_laerlinger.js
 * Sletter alle lærling-brukere fra Firebase Auth og Firestore.
 * Beholder admin-brukere og bedrifter.
 *
 * Kjør: node tools/slett_laerlinger.js
 */

import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const fbPrivateKey = process.env.FB_PRIVATE_KEY ?? process.env.LOCAL_FB_PRIVATE_KEY;

initializeApp({
  credential: cert({
    projectId: process.env.FB_PROJECT_ID,
    clientEmail: process.env.FB_CLIENT_EMAIL,
    privateKey: fbPrivateKey?.replace(/\\n/g, '\n')
  })
});

const auth = getAuth();
const db = getFirestore();

async function slettLaerlinger() {
  // Hent alle lærling-brukere fra Firestore
  const snap = await db.collection('users').where('rolle', '==', 'laerling').get();
  const laerlinger = snap.docs;

  if (laerlinger.length === 0) {
    console.log('Ingen lærling-brukere funnet.');
    return;
  }

  console.log(`Fant ${laerlinger.length} lærling(er). Starter sletting...`);

  for (const doc of laerlinger) {
    const uid = doc.id;
    const navn = doc.data().navn || uid;

    try {
      // Hent relaterte data
      const [soknaderSnap, varslerSnap] = await Promise.all([
        db.collection('soknader').where('laerling_user_id', '==', uid).get(),
        db.collection('varsler').where('mottaker_id', '==', uid).get()
      ]);

      // Batch-slett Firestore-data
      const batch = db.batch();
      soknaderSnap.docs.forEach(d => batch.delete(d.ref));
      varslerSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(db.collection('users').doc(uid));
      await batch.commit();

      // Slett fra Firebase Auth
      try {
        await auth.deleteUser(uid);
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') throw authErr;
      }

      console.log(`  ✓ Slettet: ${navn} (${uid})`);
    } catch (err) {
      console.error(`  ✗ Feil ved sletting av ${navn} (${uid}):`, err.message);
    }
  }

  console.log('\nFerdig. Alle lærling-brukere er slettet.');
}

slettLaerlinger().catch(err => {
  console.error('Kritisk feil:', err);
  process.exit(1);
});
