/**
 * slett_alle_brukere.js
 * Kjøres én gang: node tools/slett_alle_brukere.js
 * Sletter alle brukere fra Firebase Auth + Firestore users-samlingen.
 */

import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const fbPrivateKey = process.env.FB_PRIVATE_KEY ?? process.env.LOCAL_FB_PRIVATE_KEY;

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FB_PROJECT_ID,
      clientEmail: process.env.FB_CLIENT_EMAIL,
      privateKey: fbPrivateKey?.replace(/\\n/g, '\n')
    })
  });
}

const auth = getAuth();
const db = getFirestore();

async function slettAlleFirestoreUsers() {
  const snapshot = await db.collection('users').get();
  if (snapshot.empty) {
    console.log('Ingen Firestore-dokumenter funnet.');
    return;
  }
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Slettet ${snapshot.size} Firestore-dokumenter.`);
}

async function slettAlleAuthUsers() {
  let slettet = 0;
  let pageToken;

  do {
    const result = await auth.listUsers(1000, pageToken);
    if (result.users.length === 0) break;

    const uids = result.users.map(u => u.uid);
    await auth.deleteUsers(uids);
    slettet += uids.length;
    console.log(`Slettet ${uids.length} Firebase Auth-brukere...`);

    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`Totalt ${slettet} Auth-brukere slettet.`);
}

console.log('Starter sletting av alle brukere...\n');
await slettAlleFirestoreUsers();
await slettAlleAuthUsers();
console.log('\nFerdig! Alle brukere er slettet.');
