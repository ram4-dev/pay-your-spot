import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SPOT_SEEDS } from "./constants";

export type AuctionDatabase = DatabaseSync;

const globalForDatabase = globalThis as typeof globalThis & {
  startupDayAuctionDatabase?: DatabaseSync;
};

export function createAuctionDatabase(filename = ":memory:") {
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(filename), { recursive: true });
  }

  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL");
  }
  migrate(database);
  seed(database);
  return database;
}

export function getAuctionDatabase() {
  if (!globalForDatabase.startupDayAuctionDatabase) {
    const filename =
      process.env.DATABASE_PATH ??
      path.join(process.cwd(), "data", "startup-day-auction.sqlite");
    globalForDatabase.startupDayAuctionDatabase = createAuctionDatabase(filename);
  }

  return globalForDatabase.startupDayAuctionDatabase;
}

export function transaction<T>(database: DatabaseSync, work: () => T) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS spots (
      id TEXT PRIMARY KEY,
      placement TEXT NOT NULL,
      description TEXT NOT NULL,
      size_label TEXT NOT NULL,
      tier TEXT NOT NULL,
      tone TEXT NOT NULL,
      starting_amount_cents INTEGER NOT NULL CHECK (starting_amount_cents > 0),
      increment_amount_cents INTEGER NOT NULL CHECK (increment_amount_cents > 0),
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ACTIVE', 'LOCKED')),
      started_at TEXT,
      ends_at TEXT,
      locked_at TEXT,
      leading_bid_id TEXT
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      spot_id TEXT NOT NULL REFERENCES spots(id),
      bidder_company TEXT NOT NULL,
      bidder_email TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      status TEXT NOT NULL CHECK (status IN ('PENDING', 'LEADING', 'REFUND_PENDING', 'REFUND_FAILED', 'REFUNDED', 'WON', 'FAILED')),
      reservation_expires_at TEXT NOT NULL,
      preference_id TEXT UNIQUE,
      checkout_url TEXT,
      payment_id TEXT UNIQUE,
      payment_status TEXT,
      refund_id TEXT,
      refund_reason TEXT,
      refund_attempts INTEGER NOT NULL DEFAULT 0,
      next_refund_at TEXT,
      failure_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      paid_at TEXT,
      refunded_at TEXT
    );

    CREATE INDEX IF NOT EXISTS bids_spot_status_idx ON bids(spot_id, status);
    CREATE INDEX IF NOT EXISTS bids_refund_retry_idx ON bids(status, next_refund_at);
    CREATE INDEX IF NOT EXISTS spots_status_ends_idx ON spots(status, ends_at);
  `);
}

function seed(database: DatabaseSync) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO spots (
      id, placement, description, size_label, tier, tone,
      starting_amount_cents, increment_amount_cents
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  transaction(database, () => {
    for (const spot of SPOT_SEEDS) {
      insert.run(
        spot.id,
        spot.placement,
        spot.description,
        spot.sizeLabel,
        spot.tier,
        spot.tone,
        spot.startingAmountCents,
        spot.incrementAmountCents,
      );
    }
  });
}
