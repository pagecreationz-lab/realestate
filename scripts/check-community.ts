import {getSupabaseAdmin} from '../server/config/supabase';
// Bound each network call so an unavailable project does not leave this diagnostic hanging.
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,options)=>originalFetch(input,{...options,signal:AbortSignal.timeout(10000)});
const db=getSupabaseAdmin();
let missing=false;
for(const table of ['creator_posts','creator_media','creator_events','creator_post_counts','creator_reviews','creator_audit','creator_threads','creator_messages','creator_wallets','creator_withdrawals','creator_ledger']){
 // A GET retains PostgREST's schema error body; HEAD can lose that detail.
 const {error}=await db.from(table).select('*').limit(0);
 console.log(table+': '+(error?'unavailable ('+(error.code||'connection error')+')':'ready'));
 if(error)missing=true;
}
const {data,error}=await db.storage.getBucket('creator-media');
console.log('Private media bucket: '+(!error&&data&&!data.public?'ready':error?'unavailable; verify project connectivity and migration':'must be private'));if(error||data?.public)missing=true;
if(error)console.log('Storage check: '+error.message);
console.log('Bank encryption key: '+(/^[a-f0-9]{64}$/i.test(process.env.BANK_DETAILS_KEY??'')?'configured':'not configured'));
process.exitCode=missing?1:0;
