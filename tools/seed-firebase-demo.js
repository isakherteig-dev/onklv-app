/**
 * seed-firebase-demo.js
 * Oppretter demo-kontoer i Firebase Authentication + Firestore.
 *
 * Kjøres EN gang manuelt:
 *   node tools/seed-firebase-demo.js
 */

import 'dotenv/config';
import '../firebase/config.js';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
  try {
    const eksisterende = await adminAuth.getUserByEmail(epost);
    await adminAuth.deleteUser(eksisterende.uid);
    console.log(`  Slettet eksisterende: ${epost}`);
  } catch { /* ingen eksisterende — OK */ }

  const authBruker = await adminAuth.createUser({
    email:         epost,
    password:      DEMO_PASSORD,
    displayName:   navn,
    emailVerified: true
  });
  console.log(`  Auth opprettet: ${epost} (${authBruker.uid})`);

  await adminAuth.setCustomUserClaims(authBruker.uid, { rolle });

  const now = new Date();
  await adminDB.collection('users').doc(authBruker.uid).set({
    uid:               authBruker.uid,
    navn,
    epost,
    telefon:           null,
    rolle,
    opprettet:         now,
    sistInnlogget:     now,
    samtykkeGitt:      now,
    samtykkeVersjon:   '1.0',
    aktiv:             true,
    godkjent:          ekstra.godkjent ?? true,
    utdanningsprogram: ekstra.utdanningsprogram || null,
    skole:             ekstra.skole || null,
    bio:               ekstra.bio || null,
    cv_filnavn:        null,
    orgNr:             ekstra.orgNr || null,
    bransje:           ekstra.bransje || null,
    bedriftBeskrivelse: null
  });
  console.log(`  Firestore-profil opprettet (rolle: ${rolle})`);

  return authBruker.uid;
}

async function seedDemoLaereplasser(bedriftUid) {
  // Slett eksisterende demo-læreplasser for bedriften
  const snap = await adminDB.collection('laereplasser')
    .where('bedrift_user_id', '==', bedriftUid).get();
  const batch = adminDB.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  const plasser = [
    {
      tittel:      'Elektriker-lærling',
      beskrivelse: 'Vi søker motiverte lærlinger til elektroarbeid på næringsbygg og boliger i Bergensregionen.',
      sted:        'Bergen',
      fagomraade:  'Elektrofag',
      frist:       '2026-06-15',
      antall:      2
    },
    {
      tittel:      'Ventilasjonsmontor-lærling',
      beskrivelse: 'Spennende stilling for lærling innen ventilasjonsmontør-faget.',
      sted:        'Bergen',
      fagomraade:  'Elektrofag',
      frist:       '2026-07-01',
      antall:      1
    }
  ];

  for (const p of plasser) {
    await adminDB.collection('laereplasser').add({
      bedrift_user_id: bedriftUid,
      bedrift_navn:    'Bergen Elektro AS',
      tittel:          p.tittel,
      beskrivelse:     p.beskrivelse,
      sted:            p.sted,
      fagomraade:      p.fagomraade,
      frist:           p.frist,
      antall_plasser:  p.antall,
      aktiv:           true,
      opprettet:       new Date()
    });
    console.log(`  Lærlingplass opprettet: ${p.tittel}`);
  }
}

async function main() {
  console.log('Starter seeding av demo-kontoer...\n');

  let bedriftUid;
  for (const bruker of brukere) {
    console.log(`-> ${bruker.epost}`);
    const uid = await opprettBruker(bruker);
    if (bruker.rolle === 'bedrift') bedriftUid = uid;
    console.log('');
  }

  if (bedriftUid) {
    console.log('-> Demo-laereplasser i Firestore');
    await seedDemoLaereplasser(bedriftUid);
    console.log('');
  }

  console.log('Seeding ferdig!\n');
  console.log('Demo-kontoer:');
  console.log('  Laerling: laerling@demo.no / demo1234');
  console.log('  Bedrift:  bedrift@demo.no  / demo1234');
  console.log('  Admin:    admin@demo.no    / demo1234');
  process.exit(0);
}

main().catch(err => {
  console.error('Seeding feilet:', err);
  process.exit(1);
});
