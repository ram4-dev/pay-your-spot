import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SPOT_SEEDS } from "./constants";

export type AuctionDatabase = DatabaseSync;
const globalForDatabase = globalThis as typeof globalThis & { startupDayAuctionDatabase?: DatabaseSync };

export function createAuctionDatabase(filename = ":memory:") {
  if (filename !== ":memory:") mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
  migrate(database); seed(database); return database;
}

export function getAuctionDatabase() {
  if (!globalForDatabase.startupDayAuctionDatabase) {
    const filename = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "startup-day-auction.sqlite");
    globalForDatabase.startupDayAuctionDatabase = createAuctionDatabase(filename);
  }
  return globalForDatabase.startupDayAuctionDatabase;
}

export function transaction<T>(database: DatabaseSync, work: () => T) {
  database.exec("BEGIN IMMEDIATE");
  try { const result = work(); database.exec("COMMIT"); return result; }
  catch (error) { database.exec("ROLLBACK"); throw error; }
}

function createSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS spots (
      id TEXT PRIMARY KEY, placement TEXT NOT NULL, description TEXT NOT NULL, size_label TEXT NOT NULL,
      tier TEXT NOT NULL, tone TEXT NOT NULL, starting_amount_cents INTEGER NOT NULL CHECK (starting_amount_cents > 0),
      increment_amount_cents INTEGER NOT NULL CHECK (increment_amount_cents > 0),
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','ACTIVE','AWAITING_PAYMENT','LOCKED')),
      started_at TEXT, ends_at TEXT, payment_due_at TEXT, locked_at TEXT, leading_bid_id TEXT,
      auction_round INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY, spot_id TEXT NOT NULL REFERENCES spots(id), bidder_company TEXT NOT NULL,
      bidder_email TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      status TEXT NOT NULL CHECK (status IN ('LEADING','OUTBID','PAYMENT_PENDING','PAID','PAYMENT_EXPIRED','REFUND_PENDING','REFUND_FAILED','REFUNDED','FAILED')),
      payment_due_at TEXT, preference_id TEXT UNIQUE, checkout_url TEXT, payment_link_sent_at TEXT,
      email_attempts INTEGER NOT NULL DEFAULT 0, next_email_at TEXT, email_failure TEXT,
      payment_id TEXT UNIQUE, payment_status TEXT, refund_id TEXT, refund_reason TEXT,
      refund_attempts INTEGER NOT NULL DEFAULT 0, next_refund_at TEXT, failure_reason TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, paid_at TEXT, refunded_at TEXT
    );
    CREATE INDEX IF NOT EXISTS bids_spot_status_idx ON bids(spot_id, status);
    CREATE INDEX IF NOT EXISTS bids_email_retry_idx ON bids(status, next_email_at);
    CREATE INDEX IF NOT EXISTS bids_refund_retry_idx ON bids(status, next_refund_at);
    CREATE INDEX IF NOT EXISTS spots_status_ends_idx ON spots(status, ends_at);
    CREATE INDEX IF NOT EXISTS spots_payment_due_idx ON spots(status, payment_due_at);
  `);
}

function migrate(database: DatabaseSync) {
  const existing = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bids'").get() as { sql: string } | undefined;
  if (!existing || existing.sql.includes("PAYMENT_PENDING")) {
    createSchema(database); database.exec("PRAGMA user_version = 2"); return;
  }
  database.exec("PRAGMA foreign_keys = OFF");
  transaction(database, () => {
    database.exec("ALTER TABLE bids RENAME TO bids_legacy; ALTER TABLE spots RENAME TO spots_legacy;");
    createSchema(database);
    database.exec(`
      INSERT INTO spots (id,placement,description,size_label,tier,tone,starting_amount_cents,increment_amount_cents,status,started_at,ends_at,locked_at,leading_bid_id,auction_round)
      SELECT id,placement,description,size_label,tier,tone,starting_amount_cents,increment_amount_cents,
        CASE WHEN leading_bid_id IS NOT NULL THEN 'LOCKED' ELSE 'AVAILABLE' END, started_at,ends_at,
        CASE WHEN leading_bid_id IS NOT NULL THEN COALESCE(locked_at,ends_at,started_at) END,leading_bid_id,
        CASE WHEN leading_bid_id IS NOT NULL THEN 1 ELSE 0 END FROM spots_legacy;
      INSERT INTO bids (id,spot_id,bidder_company,bidder_email,amount_cents,status,preference_id,checkout_url,payment_id,payment_status,refund_id,refund_reason,refund_attempts,next_refund_at,failure_reason,created_at,updated_at,paid_at,refunded_at)
      SELECT id,spot_id,bidder_company,bidder_email,amount_cents,
        CASE WHEN status IN ('LEADING','WON') AND payment_status='approved' THEN 'PAID'
          WHEN status='REFUNDED' THEN 'REFUNDED' WHEN status IN ('REFUND_PENDING','REFUND_FAILED') THEN status ELSE 'FAILED' END,
        preference_id,checkout_url,payment_id,payment_status,refund_id,refund_reason,refund_attempts,next_refund_at,failure_reason,created_at,updated_at,paid_at,refunded_at
      FROM bids_legacy;
      DROP TABLE bids_legacy; DROP TABLE spots_legacy;
    `);
  });
  database.exec("PRAGMA user_version = 2; PRAGMA foreign_keys = ON");
}

function seed(database: DatabaseSync) {
  const insert = database.prepare("INSERT OR IGNORE INTO spots (id,placement,description,size_label,tier,tone,starting_amount_cents,increment_amount_cents) VALUES (?,?,?,?,?,?,?,?)");
  transaction(database, () => { for (const s of SPOT_SEEDS) insert.run(s.id,s.placement,s.description,s.sizeLabel,s.tier,s.tone,s.startingAmountCents,s.incrementAmountCents); });
}
