/**
 * seed-firebase-demo.js
 * Oppretter demo-kontoer i Firebase Authentication + Firestore.
 *
 * Kjøres EN gang manuelt:
 *   node tools/seed-firebase-demo.js
 *
 * Krever at .env er konfigurert med Firebase Admin SDK-variabler.
 */

import 'dotenv/config';
import '../firebase/config.js';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const adminAuth = getAuth();
const adminDB   = getFirestore();

const DEMO_PASSORD = 'demo1234';

const brukere = [
  {
    epost: 'laerling@demo.no',
    navn:  'Marius Haugen',
    rolle: 'laerling',
    utdanningsprogram: 'Elektrofag',
    skole: 'Åsane videregående skole',
    bio:   'Motivert elev fra Bergen som brenner for elektrofaget.',
    godkjent: true
  },
  {
    epost:   'bedrift@demo.no',
    navn:    'Bergen Elektro AS',
    rolle:   'bedrift',
    orgNr:   '912345678',
    bransje: 'Elektrofag',
    godkjent: true
  },
  {
    epost:  'admin@demo.no',
    navn:   'Jimmy Pasali',
    rolle:  'admin',
    godkjent: true
  }
];

async function opprettBruker({ epost, navn, rolle, ...ekstra }) {
  // Slett eksisterende bruker med samme e-post (for idempotent seeding)
  try {
    const eksisterende = await adminAuth.getUserByEmail(epost);
    await adminAuth.deleteUser(eksisterende.uid);
    console.log(`  Slettet eksisterende: ${epost}`);
  } catch { /* Ingen eksisterende bruker — OK */ }

  // Opprett i Firebase Auth
  const authBruker = await adminAuth.createUser({
    email:         epost,
    password:      DEMO_PASSORD,
    displayName:   navn,
    emailVerified: true
  });

  console.log(`  Opprettet i Auth: ${epost} (${authBruker.uid})`);

  // Sett custom claim
  await adminAuth.setCustomUserClaims(authBruker.uid, { rolle });

  // Opprett Firestore-profil
  const now = new Date();
  const userData = {
    uid: authBruker.uid,
    navn,
    epost,
    telefon: null,
    rolle,
    opprettet: now,
    sistInnlogget: now,
    samtykkeGitt: now,
    samtykkeVersjon: '1.0',
    aktiv: true,
    godkjent: ekstra.godkjent ?? true,
    utdanningsprogram: ekstra.utdanningsprogram || null,
    skole:             ekstra.skole || null,
    bio:               ekstra.bio || null,
    cv_filnavn:        null,
    orgNr:             ekstra.orgNr || null,
    bransje:           ekstra.bransje || null,
    bedriftBeskrivelse: null
  };

  await adminDB.collection('users').doc(authBruker.uid).set(userData);
  console.log(`  Firestore-profil opprettet: ${epost} (rolle: ${rolle})`);

  return authBruker.uid;
}

async function seedDemoLaereplasser(bedriftUid, bedriftNavn) {
  const db = (await import('better-sqlite3')).default;
  const path = (await import('path')).default;
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sqlite = new db(path.join(__dirname, '..', 'data.db'));

  sqlite.pragma('journal_mode = WAL');

  // Slett eksisterende demo-data
  sqlite.prepare("DELETE FROM laereplasser WHERE bedrift_user_id = ?").run(bedriftUid);

  const insert = sqlite.prepare(`
    INSERT INTO laereplasser (bedrift_user_id, bedrift_naam, tittel, beskrivelse, sted, bransje, frist, antall_plasser)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(bedriftUid, bedriftNavn, 'Elektriker-lærling',
    'Vi søker motiverte lærlinger til elektroarbeid på næringsbygg og boliger i Bergensregionen.',
    'Bergen', 'Elektrofag', '2026-04-15', 2);

  insert.run(bedriftUid, bedriftNavn, 'Ventilasjonsmontor-lærling',
    'Spennende stilling for lærling innen ventilasjonsmontør-faget.',
    'Bergen', 'Elektrofag', '2026-05-01', 1);

  sqlite.close();
  console.log('  Demo-læreplasser lagt inn i SQLite');
}

async function main() {
  console.log('🌱 Starter seeding av demo-kontoer…\n');

  let bedriftUid;

  for (const bruker of brukere) {
    console.log(`→ ${bruker.epost}`);
    const uid = await opprettBruker(bruker);
    if (bruker.rolle === 'bedrift') bedriftUid = uid;
    console.log('');
  }

  if (bedriftUid) {
    console.log('→ Demo-læreplasser i SQLite');
    await seedDemoLaereplasser(bedriftUid, 'Bergen Elektro AS');
    console.log('');
  }

  console.log('✅ Seeding ferdig!\n');
  console.log('Demo-kontoer:');
  console.log('  Lærling: laerling@demo.no  / demo1234');
  console.log('  Bedrift:  bedrift@demo.no   / demo1234');
  console.log('  Admin:    admin@demo.no     / demo1234');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seeding feilet:', err);
  process.exit(1);
});
