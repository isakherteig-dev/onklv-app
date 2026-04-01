import 'dotenv/config';
import { adminDB } from '../firebase/config.js';

const snap = await adminDB.collection('soknader').get();
if (snap.empty) { console.log('Ingen søknader å slette.'); process.exit(0); }

const batch_size = 500;
let slettet = 0;
const docs = snap.docs;

for (let i = 0; i < docs.length; i += batch_size) {
  const batch = adminDB.batch();
  docs.slice(i, i + batch_size).forEach(d => batch.delete(d.ref));
  await batch.commit();
  slettet += Math.min(batch_size, docs.length - i);
}

console.log(`Slettet ${slettet} søknader.`);
