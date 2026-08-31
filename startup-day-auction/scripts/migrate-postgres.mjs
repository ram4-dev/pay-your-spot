import { readFile,readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const databaseUrl=process.env.POSTGRES_URL_NON_POOLING??process.env.POSTGRES_URL;
if(!databaseUrl)throw new Error("POSTGRES_URL_NON_POOLING or POSTGRES_URL is required");

const migrationDirectoryUrl=new URL("../supabase/migrations/",import.meta.url);
const migrationDirectory=fileURLToPath(migrationDirectoryUrl);
const migrationFiles=(await readdir(migrationDirectory)).filter(file=>file.endsWith(".sql")).sort();
const sql=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:15,idle_timeout:5});

try{
  for(const file of migrationFiles)await sql.unsafe(await readFile(`${migrationDirectory}/${file}`,"utf8"));
  const [{spots,bids}]=await sql`select (select count(*)::int from public.spots) as spots,(select count(*)::int from public.bids) as bids`;
  process.stdout.write(`${migrationFiles.length} migrations applied: ${spots} spots, ${bids} bids\n`);
}finally{
  await sql.end();
}
