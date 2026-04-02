import 'dotenv/config';
import { adminDB, adminStorage } from '../firebase/config.js';

const FIRESTORE_BATCH_SIZE = 450;
const QUERY_CHUNK_SIZE = 30;
const VARSEL_TYPER = [
  'ny_soknad',
  'soknad_under_behandling',
  'soknad_godkjent',
  'soknad_avslatt',
  'ny_chat_melding'
];

function chunkArray(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

function hentStoragePathFraUrl(url, bucketName) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const path = parsed.pathname || '';

    const direktePrefix = `/${bucketName}/`;
    if (path.startsWith(direktePrefix)) {
      return decodeURIComponent(path.slice(direktePrefix.length));
    }

    const objectIndex = path.indexOf('/o/');
    if (objectIndex !== -1) {
      return decodeURIComponent(path.slice(objectIndex + 3));
    }
  } catch {
    return null;
  }

  return null;
}

async function hentChatMeldingerForSoknader(soknadIds) {
  const docs = [];

  for (const chunk of chunkArray(soknadIds, QUERY_CHUNK_SIZE)) {
    const snap = await adminDB.collection('chat_meldinger')
      .where('soknad_id', 'in', chunk)
      .get();
    docs.push(...snap.docs);
  }

  return docs;
}

async function hentSoknadsrelaterteVarsler() {
  const docs = [];

  for (const chunk of chunkArray(VARSEL_TYPER, QUERY_CHUNK_SIZE)) {
    const snap = await adminDB.collection('varsler')
      .where('type', 'in', chunk)
      .get();
    docs.push(...snap.docs);
  }

  return docs;
}

async function slettDokumenter(docs, etikett) {
  if (docs.length === 0) {
    console.log(`Ingen ${etikett} å slette.`);
    return 0;
  }

  let slettet = 0;
  for (const chunk of chunkArray(docs, FIRESTORE_BATCH_SIZE)) {
    const batch = adminDB.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    slettet += chunk.length;
    console.log(`Slettet ${slettet}/${docs.length} ${etikett}...`);
  }

  return slettet;
}

async function slettVedleggFraStorage(vedleggPaths) {
  if (vedleggPaths.length === 0) {
    console.log('Ingen vedlegg å slette fra Storage.');
    return 0;
  }

  const bucket = adminStorage.bucket(process.env.FB_STORAGE_BUCKET);
  let slettet = 0;

  for (const filnavn of vedleggPaths) {
    try {
      await bucket.file(filnavn).delete();
      slettet += 1;
    } catch (err) {
      if (err?.code === 404) continue;
      console.error(`Klarte ikke å slette vedlegg "${filnavn}":`, err.message);
    }
  }

  console.log(`Slettet ${slettet}/${vedleggPaths.length} vedlegg fra Storage.`);
  return slettet;
}

async function slettAlleLaerlingsoknader() {
  const soknaderSnap = await adminDB.collection('soknader').get();
  if (soknaderSnap.empty) {
    console.log('Ingen søknader å slette.');
    return;
  }

  const soknadDocs = soknaderSnap.docs.filter((doc) => Boolean(doc.data()?.laerling_user_id));
  if (soknadDocs.length === 0) {
    console.log('Fant ingen søknader sendt av lærlinger.');
    return;
  }

  const bucket = adminStorage.bucket(process.env.FB_STORAGE_BUCKET);
  const vedleggPaths = [...new Set(
    soknadDocs
      .map((doc) => hentStoragePathFraUrl(doc.data()?.vedlegg, bucket.name))
      .filter(Boolean)
  )];

  const soknadIds = soknadDocs.map((doc) => doc.id);
  const [chatDocs, varselDocs] = await Promise.all([
    hentChatMeldingerForSoknader(soknadIds),
    hentSoknadsrelaterteVarsler()
  ]);

  console.log(`Fant ${soknadDocs.length} lærlingsøknad(er).`);
  console.log(`Fant ${chatDocs.length} tilhørende chatmelding(er).`);
  console.log(`Fant ${varselDocs.length} søknadsrelaterte varsel(r).`);
  console.log(`Fant ${vedleggPaths.length} vedlegg i Storage.`);

  await slettVedleggFraStorage(vedleggPaths);
  await slettDokumenter(chatDocs, 'chatmeldinger');
  await slettDokumenter(varselDocs, 'varsler');
  await slettDokumenter(soknadDocs, 'søknader');

  console.log('\nFerdig. Alle søknader sendt av lærlinger er slettet.');
}

slettAlleLaerlingsoknader().catch((err) => {
  console.error('Kritisk feil under sletting av søknader:', err);
  process.exit(1);
});
