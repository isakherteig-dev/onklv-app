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
    -- Læreplasser: bruker Firebase UID (TEXT) som bedrift-referanse
    CREATE TABLE IF NOT EXISTS laereplasser (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      bedrift_user_id TEXT    NOT NULL,
      bedrift_naam    TEXT,
      tittel          TEXT    NOT NULL,
      beskrivelse     TEXT,
      sted            TEXT,
      bransje         TEXT,
      fagomraade      TEXT    DEFAULT '',
      krav            TEXT    DEFAULT '',
      start_dato      TEXT    DEFAULT '',
      kontaktperson   TEXT    DEFAULT '',
      kontakt_epost   TEXT    DEFAULT '',
      frist           TEXT,
      antall_plasser  INTEGER NOT NULL DEFAULT 1,
      aktiv           INTEGER NOT NULL DEFAULT 1,
      opprettet       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Varsler (notifications)
    CREATE TABLE IF NOT EXISTS varsler (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mottaker_id TEXT    NOT NULL,
      type        TEXT    NOT NULL,
      tittel      TEXT    NOT NULL,
      melding     TEXT,
      lest        INTEGER NOT NULL DEFAULT 0,
      lenke       TEXT,
      opprettet   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: extend laereplasser with new columns if they don't exist
  const lCols = db.pragma('table_info(laereplasser)').map(c => c.name);
  if (!lCols.includes('fagomraade'))    db.exec("ALTER TABLE laereplasser ADD COLUMN fagomraade TEXT DEFAULT ''");
  if (!lCols.includes('krav'))          db.exec("ALTER TABLE laereplasser ADD COLUMN krav TEXT DEFAULT ''");
  if (!lCols.includes('start_dato'))    db.exec("ALTER TABLE laereplasser ADD COLUMN start_dato TEXT DEFAULT ''");
  if (!lCols.includes('kontaktperson')) db.exec("ALTER TABLE laereplasser ADD COLUMN kontaktperson TEXT DEFAULT ''");
  if (!lCols.includes('kontakt_epost')) db.exec("ALTER TABLE laereplasser ADD COLUMN kontakt_epost TEXT DEFAULT ''");

  // Migration: rebuild soknader if old schema (no 'erfaring' column = needs update)
  const sCols = db.pragma('table_info(soknader)').map(c => c.name);
  if (sCols.length > 0 && !sCols.includes('erfaring')) {
    db.exec('DROP TABLE IF EXISTS soknader');
  }

  db.exec(`
    -- Søknader: bruker Firebase UID (TEXT) som lærling-referanse
    CREATE TABLE IF NOT EXISTS soknader (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      laerling_user_id  TEXT    NOT NULL,
      laerling_naam     TEXT,
      laerling_epost    TEXT,
      utdanningsprogram TEXT,
      skole             TEXT,
      laerplass_id      INTEGER NOT NULL REFERENCES laereplasser(id) ON DELETE CASCADE,
      melding           TEXT,
      erfaring          TEXT,
      vg1               TEXT,
      vg2               TEXT,
      telefon           TEXT,
      vedlegg           TEXT,
      vedlegg_originalnavn TEXT,
      admin_kommentar   TEXT,
      behandlet_av      TEXT,
      behandlet_dato    TEXT,
      status            TEXT NOT NULL DEFAULT 'sendt'
                        CHECK(status IN ('sendt','under_behandling','godkjent','avslatt','trukket')),
      sendt_dato        TEXT NOT NULL DEFAULT (date('now')),
      UNIQUE(laerling_user_id, laerplass_id)
    );
  `);

  const sColsEtterCreate = db.pragma('table_info(soknader)').map(c => c.name);
  if (!sColsEtterCreate.includes('vedlegg')) {
    db.exec('ALTER TABLE soknader ADD COLUMN vedlegg TEXT');
  }
  if (!sColsEtterCreate.includes('vedlegg_originalnavn')) {
    db.exec('ALTER TABLE soknader ADD COLUMN vedlegg_originalnavn TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_meldinger (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      soknad_id   INTEGER NOT NULL REFERENCES soknader(id) ON DELETE CASCADE,
      avsender_id TEXT    NOT NULL,
      tekst       TEXT    NOT NULL CHECK(length(trim(tekst)) > 0),
      lest        INTEGER NOT NULL DEFAULT 0,
      opprettet   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_soknad ON chat_meldinger(soknad_id, opprettet);
  `);

  return db;
}

export function getDB() {
  if (!db) throw new Error('DB ikke initialisert — kall initDB() først');
  return db;
}
