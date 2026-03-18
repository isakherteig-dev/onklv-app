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
    -- bedrift_naam er denormalisert fra Firestore ved opprettelse
    CREATE TABLE IF NOT EXISTS laereplasser (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      bedrift_user_id TEXT    NOT NULL,
      bedrift_naam    TEXT,
      tittel          TEXT    NOT NULL,
      beskrivelse     TEXT,
      sted            TEXT,
      bransje         TEXT,
      frist           TEXT,
      antall_plasser  INTEGER NOT NULL DEFAULT 1,
      aktiv           INTEGER NOT NULL DEFAULT 1,
      opprettet       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Søknader: bruker Firebase UID (TEXT) som lærling-referanse
    -- Laerling-info er denormalisert fra Firestore ved opprettelse
    CREATE TABLE IF NOT EXISTS soknader (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      laerling_user_id  TEXT    NOT NULL,
      laerling_naam     TEXT,
      laerling_epost    TEXT,
      utdanningsprogram TEXT,
      skole             TEXT,
      laerplass_id      INTEGER NOT NULL REFERENCES laereplasser(id) ON DELETE CASCADE,
      melding           TEXT,
      status            TEXT NOT NULL DEFAULT 'sendt'
                        CHECK(status IN ('sendt','under_vurdering','akseptert','avvist')),
      sendt_dato        TEXT NOT NULL DEFAULT (date('now')),
      UNIQUE(laerling_user_id, laerplass_id)
    );
  `);

  return db;
}

export function getDB() {
  if (!db) throw new Error('DB ikke initialisert — kall initDB() først');
  return db;
}
