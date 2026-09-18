import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomBytes,randomUUID} from 'node:crypto';
import {encryptBank,decryptBank,handleCommunity} from '../server/community';
import jwt from 'jsonwebtoken';
import {env} from '../server/config/env';
import {credentialVersion} from '../server/lib/api';

test('creator ledger, moderation and private-data permissions',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role anon; create role authenticated; create role service_role;
   create table public.users(id uuid primary key, name text, roles text[], status text);
   create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  await pg.exec(await readFile(new URL('../supabase/migrations/202609170001_creator_platform.sql',import.meta.url),'utf8'));
  const admin=randomUUID(),author=randomUUID(),viewer=randomUUID(),media=randomUUID();
  await pg.query(`insert into users values($1,'Admin',array['admin'],'active'),($2,'Creator',array['user'],'active'),($3,'Viewer',array['user'],'active')`,[admin,author,viewer]);
  await pg.query(`insert into creator_media(id,owner_id,path,mime,bytes) values($1,$2,'private/test.mp4','video/mp4',20)`,[media,author]);
  const submission=await pg.query<{id:string}>(`select creator_submit($1,'A property video for review','Chennai','Sell',5000000,null,array[$2::uuid]) as id`,[author,media]);
  const post=submission.rows[0].id;
  assert.equal((await pg.query<{status:string}>(`select status from creator_posts where id=$1`,[post])).rows[0].status,'pending');
  assert.equal((await pg.query(`select * from creator_posts where status='approved'`)).rows.length,0,'pending post is not public');
  await assert.rejects(pg.query(`select creator_submit($1,'Steal another user media','Chennai','Sell',100,null,array[$2::uuid])`,[viewer,media]),/Media is unavailable/);
  await assert.rejects(pg.query(`select creator_moderate($1,$2,'approved','review checked')`,[viewer,post]),/Admin required/);
  await assert.rejects(pg.query(`select creator_credit($1,$2,100000,'Pending post credit',$3)`,[admin,post,randomUUID()]),/Only approved/);
  await pg.query(`select creator_moderate($1,$2,'approved','All files reviewed, property content only')`,[admin,post]);
  assert.equal((await pg.query(`select * from creator_reviews where post_id=$1`,[post])).rows.length,1);
  const creditKey=randomUUID();
  await pg.query(`select creator_credit($1,$2,100000,'Reviewed engagement reward',$3)`,[admin,post,creditKey]);
  await pg.query(`select creator_credit($1,$2,100000,'Reviewed engagement reward',$3)`,[admin,post,creditKey]);
  assert.equal(Number((await pg.query<{balance_paise:number}>(`select balance_paise from creator_wallets where user_id=$1`,[author])).rows[0].balance_paise),100000,'retries must not double credit');
  await assert.rejects(pg.query(`select creator_credit($1,$2,100000,'Unauthorized credit',$3)`,[viewer,post,randomUUID()]),/Admin required/);
  const withdrawKey=randomUUID();
  const w=await pg.query<{id:string}>(`select creator_withdraw($1,70000,'encrypted-placeholder','1234',$2) as id`,[author,withdrawKey]);
  const withdrawal=w.rows[0].id;
  const repeated=await pg.query<{id:string}>(`select creator_withdraw($1,70000,'encrypted-placeholder','1234',$2) as id`,[author,withdrawKey]);
  assert.equal(repeated.rows[0].id,withdrawal,'same key reuses request');
  await assert.rejects(pg.query(`select creator_withdraw($1,70000,'encrypted-placeholder','1234',$2)`,[author,randomUUID()]),/Insufficient/);
  await pg.query(`select creator_settle($1,$2,'rejected','Invalid bank information')`,[admin,withdrawal]);
  await assert.rejects(pg.query(`select creator_settle($1,$2,'rejected','Double refund attempt')`,[admin,withdrawal]),/already resolved/);
  assert.equal(Number((await pg.query<{balance_paise:number}>(`select balance_paise from creator_wallets where user_id=$1`,[author])).rows[0].balance_paise),100000);
  const next=await pg.query<{id:string}>(`select creator_withdraw($1,20000,'encrypted-placeholder','1234',$2) as id`,[author,randomUUID()]);
  await pg.query(`select creator_settle($1,$2,'paid','BANK-TEST-REFERENCE')`,[admin,next.rows[0].id]);
  assert.equal(Number((await pg.query<{balance_paise:number}>(`select balance_paise from creator_wallets where user_id=$1`,[author])).rows[0].balance_paise),80000);
  const concurrent=await Promise.allSettled([randomUUID(),randomUUID()].map(key=>pg.query(`select creator_withdraw($1,50000,'encrypted-placeholder','1234',$2)`,[author,key])));
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1,'concurrent requests cannot spend the same balance twice');
  await pg.query(`insert into creator_events(post_id,user_id,kind) values($1,$2,'view') on conflict do nothing`,[post,viewer]);
  await pg.query(`insert into creator_events(post_id,user_id,kind) values($1,$2,'view') on conflict do nothing`,[post,viewer]);
  assert.equal(Number((await pg.query<{views:number}>(`select views from creator_post_counts where post_id=$1`,[post])).rows[0].views),1);
  await pg.query(`select creator_moderate($1,$2,'rejected','Adult content found during follow-up')`,[admin,post]);
  assert.equal((await pg.query(`select * from creator_posts where status='approved'`)).rows.length,0);
  await pg.exec('set role anon');
  await assert.rejects(pg.query('select * from creator_posts'),/permission denied/);
  await assert.rejects(pg.query('select * from creator_messages'),/permission denied/);
  await assert.rejects(pg.query('select * from creator_withdrawals'),/permission denied/);
  await assert.rejects(pg.query(`select creator_credit($1,$2,100,'Unauthorized RPC',$3)`,[admin,post,randomUUID()]),/permission denied/);
  await pg.exec('reset role');
  assert.equal((await pg.query<{public:boolean}>(`select public from storage.buckets where id='creator-media'`)).rows[0].public,false);
 }finally{await pg.close();}
});

test('API protects moderation, private posts and other users conversations',async()=>{
 const originalFetch=globalThis.fetch;const originalConfig={...env};
 const user=randomUUID();const other=randomUUID();const stranger=randomUUID();const thread=randomUUID();
 env.supabaseUrl='https://creator-test.invalid';env.supabaseSecretKey='test-service-key';env.jwtSecret='test-only-key-for-api-authorization-checks';
 const seen:URL[]=[];
 globalThis.fetch=async(input)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(url.hostname,'creator-test.invalid');seen.push(url);
  if(url.pathname.endsWith('/users'))return Response.json({id:user,name:'Viewer',roles:['user'],status:'active',password_hash:'test-password-hash'});
  if(url.pathname.endsWith('/creator_threads'))return Response.json({id:thread,member_a:other,member_b:stranger});
  if(url.pathname.endsWith('/creator_posts'))return Response.json([]);
  throw new Error('Unexpected database call: '+url.pathname);
 };
 try{
  const token=jwt.sign({id:user,email:'test@example.com',roles:['admin'],credentialVersion:credentialVersion('test-password-hash')},env.jwtSecret);
  const post=(body:unknown)=>new Request('http://localhost/api/community',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await handleCommunity(post({action:'credit'}))).status,403,'current database roles override stale admin token claims');
  assert.equal((await handleCommunity(post({action:'moderate'}))).status,403);
  assert.equal((await handleCommunity(post({action:'settle'}))).status,403);
  assert.equal((await handleCommunity(new Request('http://localhost/api/community?resource=messages&thread='+thread,{headers:{Authorization:'Bearer '+token}}))).status,404,'cannot read other people DMs');
  assert.equal((await handleCommunity(post({action:'message',thread,body:'Unauthorized message'}))).status,404);
  assert.equal((await handleCommunity(post({action:'contact',post:randomUUID()}))).status,404,'unapproved posts cannot reveal phone numbers');
  const response=await handleCommunity(new Request('http://localhost/api/community?resource=feed&post='+randomUUID()));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{posts:[]});
  const postQueries=seen.filter(u=>u.pathname.endsWith('/creator_posts'));assert.ok(postQueries.every(u=>u.searchParams.get('status')==='eq.approved'));
 }finally{globalThis.fetch=originalFetch;Object.assign(env,originalConfig);}
});

test('bank account encryption and authentication boundaries',async()=>{
 const previous=process.env.BANK_DETAILS_KEY;process.env.BANK_DETAILS_KEY=randomBytes(32).toString('hex');
 try{
  const bank={holder:'Test Creator',account:'123456789012',ifsc:'TEST0123456'};
  const encrypted=encryptBank(bank);assert.ok(!encrypted.includes(bank.account));assert.deepEqual(decryptBank(encrypted),bank);
  const parts=encrypted.split('.');const corrupt=Buffer.from(parts[2],'base64');corrupt[0]^=1;parts[2]=corrupt.toString('base64');assert.throws(()=>decryptBank(parts.join('.')));
  for(const action of ['moderate','credit','withdraw','settle','bank-details','message','upload','post','event','comment','thread','contact']){
   const response=await handleCommunity(new Request('http://localhost/api/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}));assert.equal(response.status,401,action+' must require authentication');
  }
 }finally{if(previous===undefined)delete process.env.BANK_DETAILS_KEY;else process.env.BANK_DETAILS_KEY=previous;}
});
