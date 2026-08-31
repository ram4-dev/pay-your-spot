import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import postgres from "postgres";

const filename=process.env.DATABASE_PATH??"./data/startup-day-auction.sqlite";
await access(filename);
const databaseUrl=process.env.POSTGRES_URL_NON_POOLING??process.env.POSTGRES_URL;
if(!databaseUrl)throw new Error("POSTGRES_URL_NON_POOLING or POSTGRES_URL is required");

const sqlite=new DatabaseSync(filename,{readOnly:true});
const spots=sqlite.prepare("select * from spots order by rowid").all();
const bids=sqlite.prepare("select * from bids order by created_at").all();
sqlite.close();

const sql=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:15,idle_timeout:5});
try{
  const [{count}]=await sql`select count(*)::int count from public.bids`;
  if(Number(count)>0)throw new Error("Remote bids already exist; refusing to merge automatically");
  await sql.begin(async tx=>{
    for(const bid of bids){
      await tx`insert into public.bids(id,spot_id,bidder_company,bidder_email,amount_cents,status,created_at,updated_at,contacted_at,bidder_logo,logo_mime_type)
        values(${bid.id},${bid.spot_id},${bid.bidder_company},${bid.bidder_email},${bid.amount_cents},${bid.status},${bid.created_at},${bid.updated_at},${bid.contacted_at},${bid.bidder_logo},${bid.logo_mime_type})
        on conflict(id) do nothing`;
    }
    for(const spot of spots){
      await tx`update public.spots set status=${spot.status},started_at=${spot.started_at},ends_at=${spot.ends_at},reserved_at=${spot.reserved_at},leading_bid_id=${spot.leading_bid_id},auction_round=${spot.auction_round} where id=${spot.id}`;
    }
  });
  process.stdout.write(`SQLite data migrated: ${spots.length} spots, ${bids.length} bids\n`);
}finally{
  await sql.end();
}
