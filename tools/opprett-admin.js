/**
 * opprett-admin.js
 * Oppretter en ordentlig admin-konto i Firebase Auth + Firestore.
 *
 * Bruk:
 *   node tools/opprett-admin.js din@epost.no DittPassord123
 */

import 'dotenv/config';
import '../firebase/config.js';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const adminAuth = getAuth();
const adminDB   = getFirestore();

const [,, epost, passord] = process.argv;

if (!epost || !passord) {
  console.error('Bruk: node tools/opprett-admin.js din@epost.no DittPassord123');
  process.exit(1);
}

if (passord.length < 8) {
  console.error('Passordet må være minst 8 tegn');
  process.exit(1);
}

try {
  // Sjekk om brukeren allerede finnes
  let uid;
  try {
    const eksisterende = await adminAuth.getUserByEmail(epost);
    uid = eksisterende.uid;
    console.log(`Bruker finnes allerede i Firebase Auth (${uid})`);
  } catch {
    // Opprett ny bruker
    const ny = await adminAuth.createUser({
      email:         epost,
      password:      passord,
      emailVerified: true
    });
    uid = ny.uid;
    console.log(`Bruker opprettet i Firebase Auth (${uid})`);
  }

  // Sett admin custom claim
  await adminAuth.setCustomUserClaims(uid, { rolle: 'admin' });

  // Opprett/oppdater Firestore-profil
  await adminDB.collection('users').doc(uid).set({
    uid,
    epost,
    navn:            'Admin',
    rolle:           'admin',
    godkjent:        true,
    aktiv:           true,
    opprettet:       new Date(),
    sistInnlogget:   new Date(),
    samtykkeGitt:    new Date(),
    samtykkeVersjon: '1.0',
    telefon:         null,
    bio:             null,
    cv_filnavn:      null,
    utdanningsprogram: null,
    skole:           null,
    orgNr:           null,
    bransje:         null,
    bedriftBeskrivelse: null
  }, { merge: true });

  console.log(`\n✅ Admin-konto klar!`);
  console.log(`   E-post:  ${epost}`);
  console.log(`   Passord: (det du oppga)`);
  console.log(`\nLogg inn på /login.html`);
  process.exit(0);
} catch (err) {
  console.error('Feil:', err.message);
  process.exit(1);
}
