import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SPOT_SEEDS } from "./constants";

export type AuctionDatabase=DatabaseSync;
const globalForDatabase=globalThis as typeof globalThis&{startupDayAuctionDatabase?:DatabaseSync};

export function createAuctionDatabase(filename=":memory:") {
  if(filename!==":memory:") mkdirSync(path.dirname(filename),{recursive:true});
  const database=new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
  if(filename!==":memory:") database.exec("PRAGMA journal_mode=WAL");
  migrate(database);seed(database);return database;
}
export function getAuctionDatabase(){if(!globalForDatabase.startupDayAuctionDatabase){const filename=process.env.DATABASE_PATH??path.join(process.cwd(),"data","startup-day-auction.sqlite");globalForDatabase.startupDayAuctionDatabase=createAuctionDatabase(filename);}return globalForDatabase.startupDayAuctionDatabase;}
export function transaction<T>(database:DatabaseSync,work:()=>T){database.exec("BEGIN IMMEDIATE");try{const result=work();database.exec("COMMIT");return result;}catch(error){database.exec("ROLLBACK");throw error;}}

function createSchema(database:DatabaseSync){database.exec(`
  CREATE TABLE IF NOT EXISTS spots(
    id TEXT PRIMARY KEY,placement TEXT NOT NULL,description TEXT NOT NULL,size_label TEXT NOT NULL,tier TEXT NOT NULL,tone TEXT NOT NULL,
    starting_amount_cents INTEGER NOT NULL CHECK(starting_amount_cents>0),increment_amount_cents INTEGER NOT NULL CHECK(increment_amount_cents>0),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN('AVAILABLE','ACTIVE','RESERVED')),
    started_at TEXT,ends_at TEXT,reserved_at TEXT,leading_bid_id TEXT,auction_round INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS bids(
    id TEXT PRIMARY KEY,spot_id TEXT NOT NULL REFERENCES spots(id),bidder_company TEXT NOT NULL,bidder_email TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK(amount_cents>0),status TEXT NOT NULL CHECK(status IN('LEADING','OUTBID','RESERVED','CONTACTED','FAILED')),
    created_at TEXT NOT NULL,updated_at TEXT NOT NULL,contacted_at TEXT,bidder_logo BLOB,logo_mime_type TEXT CHECK(logo_mime_type IN('image/png','image/jpeg'))
  );
  CREATE INDEX IF NOT EXISTS bids_spot_status_idx ON bids(spot_id,status);
  CREATE INDEX IF NOT EXISTS bids_email_idx ON bids(bidder_email);
  CREATE INDEX IF NOT EXISTS spots_status_ends_idx ON spots(status,ends_at);
`);}

function migrate(database:DatabaseSync){
  const existing=database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bids'").get() as {sql:string}|undefined;
  if(!existing){createSchema(database);database.exec("PRAGMA user_version=4");return;}
  if(existing.sql.includes("'RESERVED'")){createSchema(database);const columns=database.prepare("PRAGMA table_info(bids)").all() as Array<{name:string}>;if(!columns.some(column=>column.name==="bidder_logo"))database.exec("ALTER TABLE bids ADD COLUMN bidder_logo BLOB; ALTER TABLE bids ADD COLUMN logo_mime_type TEXT CHECK(logo_mime_type IN('image/png','image/jpeg'));");database.exec("PRAGMA user_version=4");return;}
  database.exec("PRAGMA foreign_keys=OFF");
  transaction(database,()=>{
    database.exec("ALTER TABLE bids RENAME TO bids_legacy; ALTER TABLE spots RENAME TO spots_legacy;");createSchema(database);
    database.exec(`
      INSERT INTO spots(id,placement,description,size_label,tier,tone,starting_amount_cents,increment_amount_cents,status,started_at,ends_at,reserved_at,leading_bid_id,auction_round)
      SELECT s.id,s.placement,s.description,s.size_label,s.tier,s.tone,s.starting_amount_cents,s.increment_amount_cents,
        CASE WHEN s.status='ACTIVE' THEN 'ACTIVE'
          WHEN s.status IN('AWAITING_PAYMENT','LOCKED') OR EXISTS(SELECT 1 FROM bids_legacy b WHERE b.spot_id=s.id AND b.status='PAYMENT_EXPIRED') THEN 'RESERVED'
          ELSE 'AVAILABLE' END,
        s.started_at,s.ends_at,
        CASE WHEN s.status IN('AWAITING_PAYMENT','LOCKED') OR EXISTS(SELECT 1 FROM bids_legacy b WHERE b.spot_id=s.id AND b.status='PAYMENT_EXPIRED') THEN COALESCE(s.locked_at,s.ends_at,s.started_at) END,
        COALESCE(s.leading_bid_id,(SELECT b.id FROM bids_legacy b WHERE b.spot_id=s.id AND b.status='PAYMENT_EXPIRED' ORDER BY b.updated_at DESC LIMIT 1)),
        CASE WHEN s.leading_bid_id IS NOT NULL OR EXISTS(SELECT 1 FROM bids_legacy b WHERE b.spot_id=s.id) THEN 1 ELSE 0 END
      FROM spots_legacy s;
      INSERT INTO bids(id,spot_id,bidder_company,bidder_email,amount_cents,status,created_at,updated_at)
      SELECT b.id,b.spot_id,b.bidder_company,b.bidder_email,b.amount_cents,
        CASE WHEN b.status IN('PAYMENT_PENDING','PAYMENT_EXPIRED','PAID','WON') THEN 'RESERVED'
          WHEN b.status='LEADING' AND (SELECT status FROM spots WHERE id=b.spot_id)='RESERVED' THEN 'RESERVED'
          WHEN b.status='LEADING' THEN 'LEADING' WHEN b.status='OUTBID' THEN 'OUTBID'
          WHEN b.status IN('REFUND_PENDING','REFUND_FAILED','REFUNDED') THEN 'OUTBID' ELSE 'FAILED' END,
        b.created_at,b.updated_at FROM bids_legacy b;
      DROP TABLE bids_legacy;DROP TABLE spots_legacy;
    `);
  });
  database.exec("PRAGMA user_version=4; PRAGMA foreign_keys=ON");
}

function seed(database:DatabaseSync){const insert=database.prepare("INSERT INTO spots(id,placement,description,size_label,tier,tone,starting_amount_cents,increment_amount_cents)VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET starting_amount_cents=excluded.starting_amount_cents,increment_amount_cents=excluded.increment_amount_cents");transaction(database,()=>{for(const s of SPOT_SEEDS)insert.run(s.id,s.placement,s.description,s.sizeLabel,s.tier,s.tone,s.startingAmountCents,s.incrementAmountCents);});}
