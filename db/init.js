import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data.db');

let db;

export function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      epost       TEXT    UNIQUE NOT NULL,
      passord_hash TEXT   NOT NULL,
      rolle       TEXT    NOT NULL CHECK(rolle IN ('laerling','bedrift','admin')),
      navn        TEXT    NOT NULL,
      godkjent    INTEGER NOT NULL DEFAULT 1,
      opprettet   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS laerlinger (
      user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      utdanningsprogram TEXT,
      skole             TEXT,
      bio               TEXT,
      cv_filnavn        TEXT
    );

    CREATE TABLE IF NOT EXISTS bedrifter (
      user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      org_nr      TEXT,
      bransje     TEXT,
      beskrivelse TEXT,
      godkjent    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS laereplasser (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      bedrift_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tittel          TEXT    NOT NULL,
      beskrivelse     TEXT,
      sted            TEXT,
      bransje         TEXT,
      frist           TEXT,
      antall_plasser  INTEGER NOT NULL DEFAULT 1,
      aktiv           INTEGER NOT NULL DEFAULT 1,
      opprettet       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS soknader (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      laerling_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      laerplass_id    INTEGER NOT NULL REFERENCES laereplasser(id) ON DELETE CASCADE,
      melding         TEXT,
      status          TEXT NOT NULL DEFAULT 'sendt' CHECK(status IN ('sendt','under_vurdering','akseptert','avvist')),
      sendt_dato      TEXT NOT NULL DEFAULT (date('now')),
      UNIQUE(laerling_user_id, laerplass_id)
    );
  `);

  // Seed demo-brukere hvis DB er tom
  const antall = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (antall === 0) {
    seedDemoData();
  }

  return db;
}

export function getDB() {
  if (!db) throw new Error('DB ikke initialisert — kall initDB() først');
  return db;
}

function seedDemoData() {
  // Passord: demo1234 (bcrypt hash)
  const demoHash = '$2b$10$af2mX7eBVDeTY5QXx8rwleHFcFnz/6rFubqyI0KGYr/k5KS3lAMwe';

  const insertUser = db.prepare(
    'INSERT INTO users (epost, passord_hash, rolle, navn, godkjent) VALUES (?,?,?,?,?)'
  );
  const insertLaerling = db.prepare(
    'INSERT INTO laerlinger (user_id, utdanningsprogram, skole, bio) VALUES (?,?,?,?)'
  );
  const insertBedrift = db.prepare(
    'INSERT INTO bedrifter (user_id, org_nr, bransje, godkjent) VALUES (?,?,?,?)'
  );
  const insertLaerplass = db.prepare(`
    INSERT INTO laereplasser (bedrift_user_id, tittel, beskrivelse, sted, bransje, frist, antall_plasser)
    VALUES (?,?,?,?,?,?,?)
  `);

  const laerlingId = insertUser.run('laerling@demo.no', demoHash, 'laerling', 'Marius Haugen', 1).lastInsertRowid;
  insertLaerling.run(laerlingId, 'Elektrofag', 'Åsane videregående skole', 'Motivert elev fra Bergen som brenner for elektrofaget.');

  const bedriftId = insertUser.run('bedrift@demo.no', demoHash, 'bedrift', 'Bergen Elektro AS', 1).lastInsertRowid;
  insertBedrift.run(bedriftId, '912345678', 'Elektrofag', 1);

  insertUser.run('admin@demo.no', demoHash, 'admin', 'Jimmy Pasali', 1);

  // Demo-læreplasser
  insertLaerplass.run(bedriftId, 'Elektriker-lærling', 'Vi søker motiverte lærlinger til elektroarbeid på næringsbygg og boliger i Bergensregionen.', 'Bergen', 'Elektrofag', '2026-04-15', 2);
  insertLaerplass.run(bedriftId, 'Ventilasjonsmontor-lærling', 'Spennende stilling for lærling innen ventilasjonsmontør-faget.', 'Bergen', 'Elektrofag', '2026-05-01', 1);
}
