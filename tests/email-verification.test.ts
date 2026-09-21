import {test,mock} from 'node:test';
import nodemailer from 'nodemailer';
import {mailSettings} from './smtp-fixture';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {emailSettingsSchema} from '../server/email-verification';
import {verificationEndpoint,sendVerification} from '../server/email-verification';
import {handleLogin} from '../server/handlers';
import {authenticateRequest,credentialVersion} from '../server/lib/api';
import {env} from '../server/config/env';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
test('verification is expiring, single-use, email-bound, throttled and private',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`create role anon;create role authenticated;create role service_role;create table users(id uuid primary key,email text,status text,verification jsonb,updated_at timestamptz);`);
  await pg.exec(await readFile(new URL('../supabase/migrations/202609290001_email_verification.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../supabase/migrations/202609300001_email_otp.sql',import.meta.url),'utf8'));
  const id=randomUUID();await pg.query(`insert into users values($1,'user@example.test','active','{"email_required":true,"email":false}',now())`,[id]);
  const issue=async()=>(await pg.query<{ok:boolean}>('select account_issue_verification($1,$2) ok',[id,'hashed-token'])).rows[0].ok;
  const consume=async(token='hashed-token')=>(await pg.query<{ok:boolean}>('select account_consume_email_otp($1,$2) ok',['user@example.test',token])).rows[0].ok;
  assert.equal(await issue(),true);assert.equal(await issue(),false);assert.equal(await consume('wrong'),false);
  await pg.query(`update account_email_verifications set expires_at=now()-interval '1 second'`);assert.equal(await consume(),false);
  await pg.query(`update account_email_verifications set expires_at=now()+interval '30 minutes',email='other@example.test'`);assert.equal(await consume(),false);
  await pg.query(`update account_email_verifications set email='user@example.test'`);assert.equal(await consume(),true);assert.equal(await consume(),false);
  assert.equal((await pg.query<{verification:{email:boolean}}>('select verification from users')).rows[0].verification.email,true);
  assert.equal(await issue(),false);
  await pg.exec('set role anon');await assert.rejects(pg.query('select * from account_email_verifications'),/permission denied/);await assert.rejects(pg.query('select account_issue_verification($1,$2)',[id,'bad']),/permission denied/);
 }finally{await pg.close();}
});
test('configuration rejects insecure or credential-bearing URLs',()=>{
 const {smtp_password,...settings}=mailSettings;assert.ok(smtp_password);
 for(const site_url of ['http://example.com','javascript:alert(1)','https://user:password@example.com'])assert.equal(emailSettingsSchema.safeParse({...settings,site_url}).success,false);
 assert.equal(emailSettingsSchema.safeParse({...settings,site_url:'http://localhost:3000'}).success,true);
});

test('OTP locks after five failures, resend replaces it, and retired links cannot verify',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`create role anon;create role authenticated;create role service_role;create table users(id uuid primary key,email text,status text,verification jsonb,updated_at timestamptz);`);
  for(const file of ['202609290001_email_verification.sql','202609300001_email_otp.sql'])await pg.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const id=randomUUID();await pg.query(`insert into users values($1,'user@example.test','active','{"email_required":true,"email":false}',now())`,[id]);
  const issue=async(token:string)=>(await pg.query<{ok:boolean}>('select account_issue_verification($1,$2) ok',[id,token])).rows[0].ok;
  const consume=async(token:string)=>(await pg.query<{ok:boolean}>('select account_consume_email_otp($1,$2) ok',['user@example.test',token])).rows[0].ok;
  assert.equal(await issue('first'),true);
  const lifetime=(await pg.query<{seconds:number}>('select extract(epoch from expires_at-requested_at)::integer seconds from account_email_verifications')).rows[0].seconds;
  assert.equal(lifetime,600);
  assert.equal((await pg.query<{ok:boolean}>('select account_consume_verification($1,$2) ok',[id,'first'])).rows[0].ok,false);
  for(let i=0;i<5;i++)assert.equal(await consume('wrong'),false);
  assert.equal(await consume('first'),false);
  assert.equal(await issue('second'),false);
  await pg.exec("update account_email_verifications set requested_at=now()-interval '6 minutes'");
  assert.equal(await issue('second'),true);
  assert.equal(await consume('first'),false);
  assert.equal(await consume('second'),true);
  assert.equal(await consume('second'),false);
  await pg.exec('set role authenticated');await assert.rejects(pg.query('select account_consume_email_otp($1,$2)',['user@example.test','second']),/permission denied/);
 }finally{await pg.close();}
});
test('pending users cannot login or use sessions, and ordinary users cannot configure email',async()=>{
 const previous={...env},original=globalThis.fetch;
 env.supabaseUrl='https://verification-test.invalid';env.supabaseSecretKey='test';env.jwtSecret='test-secret-not-for-production';
 const user={id:randomUUID(),email:'user@example.test',name:'Test',roles:['user'],status:'active',password_hash:await bcrypt.hash('long-test-password',4),verification:{email_required:true,email:false}};
 globalThis.fetch=async()=>Response.json(user);
 try{
  const login=await handleLogin(new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({email:user.email,password:'long-test-password',portal:'user'})}));assert.equal(login.status,403);
  const token=jwt.sign({id:user.id,credentialVersion:credentialVersion(user.password_hash)},env.jwtSecret);
  const req=new Request('http://localhost/api/community?resource=email-settings',{headers:{Authorization:`Bearer ${token}`}});
  await assert.rejects(authenticateRequest(req),/Verify your email/);
  user.verification.email=true;
  for(const roles of [['user'],['broker']]){
   user.roles=roles;
   for(const method of ['GET','POST'])await assert.rejects(verificationEndpoint(new Request(req,{method,body:method==='POST'?JSON.stringify({action:'test'}):undefined}),true),/do not have access/);
  }
  user.roles=['admin'];
  assert.equal((await verificationEndpoint(req,true)).status,200);
  user.roles=['user'];
  assert.equal((await authenticateRequest(req)).id,user.id);
  const verifiedLogin=await handleLogin(new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify({email:user.email,password:'long-test-password',portal:'user'})}));assert.equal(verifiedLogin.status,200);
 }finally{globalThis.fetch=original;Object.assign(env,previous);}
});

test('emailed six-digit OTP verifies using normalized email and a protected hash',async()=>{
 const previous={...env},original=globalThis.fetch;
 env.supabaseUrl='https://otp-test.invalid';env.supabaseSecretKey='test';env.jwtSecret='otp-test-secret';
 let issued='',code='';
 const transport=mock.method(nodemailer,'createTransport',()=>({sendMail:async(body:{text:string})=>{code=body.text.match(/OTP is ([0-9]{6})/)![1];assert.notEqual(issued,code);assert.match(issued,/^[a-f0-9]{64}$/);},close(){}}));
 globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(String(options?.body));
  if(String(url).includes('account_issue_verification')){issued=body.p_token;return Response.json(true);}
  assert.match(String(url),/account_consume_email_otp/);assert.equal(body.p_email,'user@example.test');assert.equal(body.p_token,issued);return Response.json(true);
 };
 try{
  await sendVerification({id:randomUUID(),email:'user@example.test'},mailSettings);
  const response=await verificationEndpoint(new Request('http://localhost/api/community?resource=email-verification',{method:'POST',body:JSON.stringify({action:'verify',email:' USER@example.test ',otp:code})}));
  assert.equal(response.status,200);
 }finally{transport.mock.restore();globalThis.fetch=original;Object.assign(env,previous);}
});

