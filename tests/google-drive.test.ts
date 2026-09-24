import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import {PGlite} from '@electric-sql/pglite';
import {env} from '../server/config/env';
import {credentialVersion} from '../server/lib/api';
import {handleCommunity} from '../server/community';
import {driveApiError,validateDriveMedia,encryptDriveToken,handleDriveSettings,handleDriveCallback,driveMediaUrl,handleDriveMedia} from '../server/google-drive';

test('Drive failures distinguish API activation, quota and permissions without leaking provider messages',async()=>{
 for(const [reason,expected] of [['accessNotConfigured','API is disabled'],['SERVICE_DISABLED','API is disabled'],['storageQuotaExceeded','no available storage'],['insufficientPermissions','required Drive permissions'],['domainPolicy','administrator has blocked']]){
  const result=await driveApiError(Response.json({error:{message:'private-provider-details',errors:[{reason}],details:[{reason}]}},{status:403}));
  assert.ok(result.message.includes(expected));assert.ok(!result.message.includes('private-provider-details'));
 }
 assert.match((await driveApiError(new Response('private-provider-details',{status:502}))).message,/HTTP 502/);
});

function setup(){
 const previous={...env},fetch=globalThis.fetch;
 const names=['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_CLIENT_SECRET','GOOGLE_DRIVE_REDIRECT_URI'];
 const vars=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 Object.assign(env,{supabaseUrl:'https://drive-test.invalid',supabaseSecretKey:'test',jwtSecret:'drive-test-secret'});
 process.env.GOOGLE_DRIVE_CLIENT_ID='client';process.env.GOOGLE_DRIVE_CLIENT_SECRET='secret';process.env.GOOGLE_DRIVE_REDIRECT_URI='https://app.example.test/api/drive-callback';
 const connection={refresh_token_enc:encryptDriveToken('private-refresh'),root_folder_id:'root',google_user_id:'google-account',account_email:'easehome@example.test'};
 const user={id:randomUUID(),roles:['user'],status:'active',name:'Test',password_hash:'password-hash',verification:{email:true}};
 const bearer=jwt.sign({id:user.id,credentialVersion:credentialVersion(user.password_hash)},env.jwtSecret);
 const request=(resource:string,body?:unknown)=>new Request('https://app.example.test/api/community?resource='+resource,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 return {connection,user,request,restore(){globalThis.fetch=fetch;Object.assign(env,previous);for(const name of names){if(vars[name]===undefined)delete process.env[name];else process.env[name]=vars[name];}}};
}

test('every public account category receives a private Drive upload, not a Supabase upload',async()=>{
 const s=setup();let media:Record<string,unknown>={},folderCreated=false;
 globalThis.fetch=async(input,options)=>{
  const url=String(input),body=options?.body?JSON.parse(String(options.body).startsWith('{')?String(options.body):'{}'):{};
  if(url.includes('/users'))return Response.json(s.user);
  if(url.includes('drive_connection'))return Response.json(s.connection);
  if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'access'});
  if(url.includes('drive_uploader_folders'))return Response.json({folder_id:'uploader-folder'});
  if(url.includes('/files/uploader-folder'))return folderCreated?Response.json({id:'uploader-folder',parents:['root'],trashed:false}):Response.json({},{status:404});
  if(url.includes('/files/generateIds'))return Response.json({ids:['new-file']});
  if(url.includes('/files?fields=id')){folderCreated=true;assert.equal(body.name,'Uploader '+s.user.id);assert.deepEqual(body.parents,['root']);return Response.json({id:'uploader-folder'});}
  if(url.includes('/upload/drive/')){
   assert.deepEqual(body.parents,['uploader-folder']);assert.equal(body.appProperties.easehome_owner,s.user.id);assert.equal(body.mimeType,'video/mp4');assert.equal(body.id,'new-file');
   assert.equal(new Headers(options?.headers).get('X-Upload-Content-Length'),'128');
   assert.equal(new Headers(options?.headers).get('Origin'),'https://app.example.test');
   return new Response(null,{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=session'}});
  }
  if(url.includes('creator_media')){
   if(options?.method==='HEAD')return new Response(null,{headers:{'content-range':'*/0'}});
   media=body;return Response.json(null,{status:201});
  }
  throw new Error('Unexpected request '+url);
 };
 try{
  for(const category of ['customer','broker','dealer','builder']){
   s.user.roles=[category==='customer'?'user':'broker'];
   const response=await handleCommunity(s.request('',{action:'upload',mime:'video/mp4',bytes:128}));
   assert.equal(response.status,200);const ticket=await response.json();
   assert.equal(ticket.url,'https://www.googleapis.com/upload/drive/v3/files?upload_id=session');assert.deepEqual(ticket.headers,{'Content-Type':'video/mp4'});
   assert.equal(media.path,'drive:new-file');assert.equal(media.owner_id,s.user.id);assert.ok(!JSON.stringify(ticket).includes('private-refresh'));assert.ok(!JSON.stringify(ticket).includes('Bearer'));
  }
 }finally{s.restore();}
});

test('Drive file completion validates size, MIME and ownership',async()=>{
 const s=setup(),id=randomUUID();let metadata={size:'128',mimeType:'image/png',trashed:false,appProperties:{easehome_media:id,easehome_owner:s.user.id}};
 globalThis.fetch=async input=>String(input).includes('drive_connection')?Response.json(s.connection):String(input).includes('oauth2.googleapis.com')?Response.json({access_token:'access'}):Response.json(metadata);
 const file={id,owner_id:s.user.id,path:'drive:file',bytes:128,mime:'image/png'};
 try{
  await validateDriveMedia(file);
  metadata={...metadata,size:'127'};await assert.rejects(validateDriveMedia(file),/incomplete/);
  metadata={...metadata,size:'128',mimeType:'video/mp4'};await assert.rejects(validateDriveMedia(file),/declared/);
  metadata={...metadata,mimeType:'image/png',appProperties:{easehome_media:id,easehome_owner:'other'}};await assert.rejects(validateDriveMedia(file),/owner/);
 }finally{s.restore();}
});

test('only Super Admin can connect; callback is browser-bound, single-use and stores encrypted credentials',async()=>{
 const s=setup();let nonce='',consumed=false,googleAccount='google-account',saved:Record<string,string>={};
 globalThis.fetch=async(input,options)=>{
  const url=String(input);
  if(url.includes('/users'))return Response.json(s.user);
  if(url.includes('drive_oauth_states')){
   if(options?.method==='POST'){nonce=JSON.parse(String(options.body)).id;consumed=false;return Response.json(null);}
   if(url.includes('select=')){const result=consumed?null:{id:nonce};consumed=true;return Response.json(result);}
   return Response.json(null);
  }
  if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'access',refresh_token:'new-private-refresh',scope:'https://www.googleapis.com/auth/drive.file'});
  if(url.includes('/about?'))return Response.json({user:{permissionId:googleAccount,emailAddress:'easehome@example.test'}});
  if(url.includes('drive_connection'))return Response.json(s.connection);
  if(url.includes('/files/root'))return Response.json({id:'root',trashed:false});
  if(url.includes('drive_save_connection')){saved=JSON.parse(String(options?.body));return Response.json(null);}
  throw new Error('Unexpected URL '+url);
 };
 try{
  await assert.rejects(handleDriveSettings(s.request('drive-settings',{action:'connect'})),/do not have access/);
  s.user.roles=['admin'];
  const start=await handleDriveSettings(s.request('drive-settings',{action:'connect'}));const {url}=await start.json();
  assert.match(start.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax/);
  const google=new URL(url);assert.equal(google.searchParams.get('scope'),'https://www.googleapis.com/auth/drive.file');
  const callback='https://app.example.test/api/drive-callback?'+new URLSearchParams({state:google.searchParams.get('state')!,code:'test-code'});
  assert.equal((await handleDriveCallback(new Request(callback))).status,400);assert.equal(consumed,false);
  const request=new Request(callback,{headers:{Cookie:'easehome_drive_state='+nonce}});
  const response=await handleDriveCallback(request);assert.equal(response.status,200);assert.equal(saved.p_google_user,'google-account');assert.notEqual(saved.p_token,'new-private-refresh');
  assert.ok(!(await response.text()).includes('new-private-refresh'));
  assert.equal((await handleDriveCallback(request)).status,400);
  const restart=async()=>{
   const next=await (await handleDriveSettings(s.request('drive-settings',{action:'connect'}))).json();
   return new Request('https://app.example.test/api/drive-callback?'+new URLSearchParams({state:new URL(next.url).searchParams.get('state')!,code:'test-code'}),{headers:{Cookie:'easehome_drive_state='+nonce}});
  };
  googleAccount='another-account';
  const switched=await handleDriveCallback(await restart());assert.equal(switched.status,400);assert.match(await switched.text(),/original EASE HOME/);
  googleAccount='google-account';const demotedRequest=await restart();s.user.roles=['user'];
  assert.equal((await handleDriveCallback(demotedRequest)).status,403);
 }finally{s.restore();}
});

test('Drive media streams byte ranges and denies expired, rejected, deleted and edited posts',async()=>{
 const s=setup(),media=randomUUID(),postId=randomUUID();
 const post={status:'approved',deleted_at:null as string|null,edit_version:0};let downloaded=0;
 globalThis.fetch=async(input,options)=>{
  const url=String(input);
  if(url.includes('creator_media'))return Response.json({id:media,path:'drive:video',post_id:postId,mime:'video/mp4',bytes:10});
  if(url.includes('creator_posts'))return Response.json(post);
  if(url.includes('drive_connection'))return Response.json(s.connection);
  if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'access'});
  downloaded++;assert.equal(new Headers(options?.headers).get('range'),'bytes=0-3');return new Response('test',{status:206,headers:{'Content-Range':'bytes 0-3/10','Content-Length':'4'}});
 };
 const url='https://app.example.test'+driveMediaUrl(media,{id:postId,edit_version:0},false);
 const request=()=>new Request(url,{headers:{Range:'bytes=0-3'}});
 try{
  const response=await handleDriveMedia(request());assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 0-3/10');assert.equal(await response.text(),'test');
  post.status='pending';assert.equal((await handleDriveMedia(request())).status,404);
  post.status='approved';post.deleted_at=new Date().toISOString();assert.equal((await handleDriveMedia(request())).status,404);
  post.deleted_at=null;post.edit_version=1;assert.equal((await handleDriveMedia(request())).status,404);
  assert.equal((await handleDriveMedia(new Request('https://app.example.test/api/drive-media?token=invalid'))).status,403);assert.equal(downloaded,1);
  const expired=jwt.sign({media,post:postId,version:0,privateAccess:false},env.jwtSecret,{audience:'drive-media',expiresIn:-1});
  assert.equal((await handleDriveMedia(new Request('https://app.example.test/api/drive-media?token='+expired))).status,403);
 }finally{s.restore();}
});

test('Drive migration protects tokens and prevents switching the connected account',async()=>{
 const pg=new PGlite();try{
  await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create table users(id uuid primary key);');
  await pg.exec(await readFile(new URL('../supabase/migrations/202610020001_google_drive.sql',import.meta.url),'utf8'));
  await pg.query('select drive_save_connection($1,$2,$3,$4)',['one','one@example.test','encrypted','root']);
  await pg.query('select drive_save_connection($1,$2,$3,$4)',['one','one@example.test','new-encrypted','other-root']);
  assert.equal((await pg.query<{root_folder_id:string}>('select root_folder_id from drive_connection')).rows[0].root_folder_id,'root');
  await assert.rejects(pg.query('select drive_save_connection($1,$2,$3,$4)',['two','two@example.test','encrypted','root']),/original EASE HOME/);
  await pg.exec('set role authenticated');for(const table of ['drive_connection','drive_oauth_states','drive_uploader_folders'])await assert.rejects(pg.query('select * from '+table),/permission denied/);
 }finally{await pg.close();}
});

