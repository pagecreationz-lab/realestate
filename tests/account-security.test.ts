import {test,mock} from 'node:test';
import nodemailer from 'nodemailer';
import {storedMailSettings} from './smtp-fixture';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {env} from '../server/config/env';
import {authenticateRequest,credentialVersion} from '../server/lib/api';
import {handleAccountSecurity} from '../server/account-security';

test('password reset uses shared SMTP settings and rejects missing configuration',async()=>{
 const previous={...env},originalFetch=globalThis.fetch;
 env.supabaseUrl='https://reset-test.invalid';env.supabaseSecretKey='test';env.jwtSecret='test-reset-secret';
 let sent:Record<string,unknown>={},configured=true;
 const transport=mock.method(nodemailer,'createTransport',()=>({sendMail:async(message:Record<string,unknown>)=>{sent=message;},close(){}}));
 globalThis.fetch=async(url)=>{
  if(String(url).includes('email_verification_settings'))return Response.json(configured?storedMailSettings():{});
  if(String(url).includes('/users'))return Response.json({id:randomUUID(),roles:['user']});
  assert.match(String(url),/account_issue_reset/);return Response.json(true);
 };
 const request=()=>new Request('http://localhost/api/community?resource=account',{method:'POST',body:JSON.stringify({action:'request-reset',email:'user@example.test'})});
 try{
  assert.equal((await handleAccountSecurity(request())).status,200);
  assert.equal(sent.from,'accounts@example.test');assert.equal(sent.to,'user@example.test');assert.match(String(sent.text),/https:\/\/example.test\/reset-password#user=/);
  assert.equal(transport.mock.callCount(),1);
  configured=false;
  await assert.rejects(handleAccountSecurity(request()),/Super Admin to save SMTP settings/);
 }finally{transport.mock.restore();globalThis.fetch=originalFetch;Object.assign(env,previous);}
});
test('customer reset expiry, one-time consumption, role restrictions and profile isolation',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`create role anon;create role authenticated;create role service_role;
   create table users(id uuid primary key,name text,mobile text,verification jsonb,password_hash text,roles text[],status text,updated_at timestamptz);`);
  await pg.exec(await readFile(new URL('../supabase/migrations/202609200001_account_security.sql',import.meta.url),'utf8'));
  const buyer=randomUUID(),admin=randomUUID(),broker=randomUUID();
  for(const [id,roles] of [[buyer,['user']],[admin,['admin']],[broker,['broker','user']]] as [string,string[]][])
   await pg.query(`insert into users values($1,'Name','9876543210','{"mobile":true,"identity":true}','old',$2,'active',now(),0)`,[id,roles]);
  const call=async(sql:string,args:unknown[])=>(await pg.query<{ok:boolean}>(sql,args)).rows[0].ok;
  assert.equal(await call('select account_issue_reset($1,$2) ok',[admin,'token']),false);
  assert.equal(await call('select account_issue_reset($1,$2) ok',[broker,'token']),false);
  assert.equal(await call('select account_issue_reset($1,$2) ok',[buyer,'token']),true);
  assert.equal(await call('select account_issue_reset($1,$2) ok',[buyer,'other']),false);
  assert.equal(await call('select account_consume_reset($1,$2,$3) ok',[buyer,'wrong','new']),false);
  assert.equal(await call('select account_consume_reset($1,$2,$3) ok',[buyer,'token','new']),true);
  assert.equal(await call('select account_consume_reset($1,$2,$3) ok',[buyer,'token','again']),false);
  await call('select account_issue_reset($1,$2) ok',[buyer,'expired']);
  await pg.query(`update account_password_resets set expires_at=now()-interval '1 minute' where user_id=$1`,[buyer]);
  assert.equal(await call('select account_consume_reset($1,$2,$3) ok',[buyer,'expired','again']),false);
  await pg.query('select account_update_profile($1,$2,$3)',[buyer,'New Name','9876543211']);
  const row=(await pg.query<{verification:{mobile:boolean;identity:boolean};roles:string[];profile_version:number}>('select * from users where id=$1',[buyer])).rows[0];
  assert.equal(row.verification.mobile,false);assert.equal(row.verification.identity,true);assert.deepEqual(row.roles,['user']);assert.equal(row.profile_version,1);
  await pg.exec('set role anon');
  await assert.rejects(pg.query('select * from account_password_resets'),/permission denied/);
  await assert.rejects(pg.query('select account_update_profile($1,$2,$3)',[buyer,'Bad Name','9876543211']),/permission denied/);
 }finally{await pg.close();}
});

test('password changes revoke sessions and professionals cannot change passwords',async()=>{
 const config={...env},originalFetch=globalThis.fetch;
 env.supabaseUrl='https://security-test.invalid';env.supabaseSecretKey='test';env.jwtSecret='only-for-local-security-tests';
 let hash='old-password-hash';const id=randomUUID();
 globalThis.fetch=async()=>Response.json({id,email:'broker@example.test',name:'Broker',roles:['broker'],status:'active',password_hash:hash});
 try{
  const token=jwt.sign({id,roles:['admin'],credentialVersion:credentialVersion(hash)},env.jwtSecret);
  const request=(body?:unknown)=>new Request('http://localhost/api/community?resource=account',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  assert.deepEqual((await authenticateRequest(request())).roles,['broker']);
  await assert.rejects(handleAccountSecurity(request({action:'admin-password',currentPassword:'x',password:'long-new-password'})),/Only super admins/);
  hash='new-password-hash';
  await assert.rejects(authenticateRequest(request()),/Session expired/);
 }finally{globalThis.fetch=originalFetch;Object.assign(env,config);}
});

