/**
 * seed-demo-laereplasser.js
 * Oppretter demo-læreplasser direkte i Firestore (ingen Auth-bruker nødvendig).
 * Alle demo-dokumenter merkes med isDemoData: true så de enkelt kan slettes.
 *
 * Kjøres manuelt:
 *   node tools/seed-demo-laereplasser.js
 *
 * Slett alle demo-plasser etterpå (Firestore Console eller admin-panel).
 */

import 'dotenv/config';
import '../firebase/config.js';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

const DEMO_BEDRIFT_ID = 'demo-bedrift-seed'; // Fiktiv ID, ikke en ekte bruker

const plasser = [
  {
    bedrift_navn:    'Rørlegger Hansen AS',
    bransje:         'Rørleggerfaget',
    fagomraade:      'Rørleggerfaget',
    tittel:          'Rørlegger-lærling',
    beskrivelse:     'Vi er et etablert rørleggerfirma i Bergensregionen med 25 ansatte. Vi søker en engasjert lærling som ønsker å lære faget fra bunnen av. Hos oss vil du jobbe med installasjon av VVS-anlegg i både nybygg og rehabiliteringsprosjekter. Vi legger vekt på HMS og faglig utvikling.',
    sted:            'Bergen',
    frist:           '2026-08-01',
    antall_plasser:  2,
    krav:            'VG2 Rørleggerfaget. Gode samarbeidsevner og punktlighet.',
    start_dato:      '2026-08-18',
    kontaktperson:   'Knut Hansen',
    kontakt_epost:   'knut@rorleggerHansen.no'
  },
  {
    bedrift_navn:    'Autotek Vestland AS',
    bransje:         'Bilfaget',
    fagomraade:      'Bilfaget',
    tittel:          'Billakkerer-lærling',
    beskrivelse:     'Autotek Vestland er en av regionens ledende verksteder for lakkering og karosseri. Vi tilbyr lærlingplass til deg som ønsker å bli en dyktig billakkerer. Du vil jobbe med moderne utstyr og lære teknikker for både skade- og nylakkering. Gode muligheter for fast jobb etter fagbrev.',
    sted:            'Voss',
    frist:           '2026-07-15',
    antall_plasser:  1,
    krav:            'VG2 Bilfaget – billakkerer. Ryddig og nøyaktig.',
    start_dato:      '2026-08-11',
    kontaktperson:   'Silje Andersen',
    kontakt_epost:   'silje@autotek-vestland.no'
  },
  {
    bedrift_navn:    'Fjord Tømrer & Snekker AS',
    bransje:         'Tømrerfaget',
    fagomraade:      'Tømrerfaget',
    tittel:          'Tømrer-lærling',
    beskrivelse:     'Vi er et tømrerfirma med lang erfaring i oppføring av boliger og hytter i Hordaland. Lærlingen vil delta i alle faser av et byggeprosjekt — fra grunnarbeid til ferdig innredning. Vi er opptatt av gode fagfolk og investerer i opplæring.',
    sted:            'Norheimsund',
    frist:           '2026-06-30',
    antall_plasser:  2,
    krav:            'VG2 Byggteknikk. Fysisk god form. Sertifikat er en fordel.',
    start_dato:      '2026-08-04',
    kontaktperson:   'Ole Fjord',
    kontakt_epost:   'ole@fjordtomrer.no'
  },
  {
    bedrift_navn:    'Helse Vest IKT',
    bransje:         'IT-servicefaget',
    fagomraade:      'IT-servicefaget',
    tittel:          'IKT-servicefag-lærling',
    beskrivelse:     'Helse Vest IKT drifter IT-infrastruktur for sykehus og helseforetak på Vestlandet. Vi søker lærling innen IKT-servicefaget. Du vil få jobbe med support, nettverk og utstyr i en spennende offentlig sektor. Gode fremtidsmuligheter i en organisasjon i sterk vekst.',
    sted:            'Bergen',
    frist:           '2026-09-01',
    antall_plasser:  3,
    krav:            'VG2 IKT-servicefaget. Serviceinnstilling og gode kommunikasjonsevner.',
    start_dato:      '2026-09-01',
    kontaktperson:   'Ingrid Solberg',
    kontakt_epost:   'ingrid.solberg@helse-vest.no'
  },
  {
    bedrift_navn:    'Meny Åsane',
    bransje:         'Kokkefaget',
    fagomraade:      'Kokkefaget',
    tittel:          'Kokke-lærling',
    beskrivelse:     'Meny Åsane har et travelt og hyggelig kjøkken med fokus på kvalitet og ferske råvarer. Vi søker en lærling som vil lære seg kokkefaget i et profesjonelt miljø. Du vil jobbe med matlaging, planlegging og råvarehåndtering. Vi er et godt arbeidsmiljø med erfarne kolleger.',
    sted:            'Bergen',
    frist:           '2026-07-01',
    antall_plasser:  1,
    krav:            'VG2 Restaurant og matfag. Punctlig og serviceorientert.',
    start_dato:      '2026-08-11',
    kontaktperson:   'Per Olsen',
    kontakt_epost:   'per.olsen@meny.no'
  },
  {
    bedrift_navn:    'Electra Bergen AS',
    bransje:         'Elektrofag',
    fagomraade:      'Elektrofag',
    tittel:          'Elektriker-lærling',
    beskrivelse:     'Electra Bergen er et mellomstort elektrofirma med oppdrag innen nybygg, rehabilitering og industriinstallasjoner. Vi har lang erfaring med lærlingopplæring og tar det på alvor. Som lærling hos oss får du bred erfaring og tett oppfølging av faglig ansvarlig.',
    sted:            'Bergen',
    frist:           '2026-06-15',
    antall_plasser:  2,
    krav:            'VG2 Elenergi. Sikkerhetsbevisst og lærevillig.',
    start_dato:      '2026-08-04',
    kontaktperson:   'Maria Christensen',
    kontakt_epost:   'maria@electra-bergen.no'
  },
  {
    bedrift_navn:    'Fjordline',
    bransje:         'Maritime fag',
    fagomraade:      'Maritime fag',
    tittel:          'Matros-lærling',
    beskrivelse:     'Fjordline opererer ferger mellom Norge og Europa. Vi søker matros-lærling til opplæring om bord. Du vil lære sjømannskap, sikkerhet og vedlikehold i en internasjonal og spennende arbeidshverdag. Gode muligheter for videre karriere til sjøs.',
    sted:            'Bergen',
    frist:           '2026-08-15',
    antall_plasser:  2,
    krav:            'VG2 Maritime fag – matros. Gyldig helseerklæring for sjøfolk.',
    start_dato:      '2026-09-01',
    kontaktperson:   'Tor Mæland',
    kontakt_epost:   'tor.maeland@fjordline.com'
  },
  {
    bedrift_navn:    'Sparebanken Vest',
    bransje:         'Finansnæringen',
    fagomraade:      'Finansnæringen',
    tittel:          'Finansmedarbeider-lærling',
    beskrivelse:     'Sparebanken Vest er en av de største sparebanksene på Vestlandet. Vi tilbyr lærlingplass der du vil lære om kundservice, betalingsformidling og finansielle produkter. Du vil jobbe i et moderne bankmiljø med god opplæring og kompetente kollegaer.',
    sted:            'Bergen',
    frist:           '2026-09-15',
    antall_plasser:  1,
    krav:            'VG2 Økonomi og administrasjon. Ryddig, tillitvekkende og serviceorientert.',
    start_dato:      '2026-09-14',
    kontaktperson:   'Hilde Bakke',
    kontakt_epost:   'hilde.bakke@spv.no'
  }
];

async function main() {
  console.log('Oppretter demo-læreplasser...\n');

  for (const p of plasser) {
    const ref = await db.collection('laereplasser').add({
      bedrift_user_id: DEMO_BEDRIFT_ID,
      bedrift_navn:    p.bedrift_navn,
      bransje:         p.bransje,
      tittel:          p.tittel,
      beskrivelse:     p.beskrivelse,
      sted:            p.sted,
      fagomraade:      p.fagomraade,
      frist:           p.frist,
      antall_plasser:  p.antall_plasser,
      krav:            p.krav,
      start_dato:      p.start_dato,
      kontaktperson:   p.kontaktperson,
      kontakt_epost:   p.kontakt_epost,
      aktiv:           true,
      isDemoData:      true,
      opprettet:       new Date()
    });
    console.log(`  ✓ ${p.bedrift_navn} — ${p.tittel} (id: ${ref.id})`);
  }

  console.log(`\n${plasser.length} demo-læreplasser opprettet!`);
  console.log('\nFor å slette alle demo-plasser, kjør:');
  console.log('  node tools/slett-demo-laereplasser.js');
  process.exit(0);
}

main().catch(err => {
  console.error('Feil:', err);
  process.exit(1);
});
