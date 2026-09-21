import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import {PGlite} from '@electric-sql/pglite';
import {env} from '../server/config/env';
import {credentialVersion} from '../server/lib/api';
import {deliver,encryptSmtpPassword,decryptSmtpPassword,smtpSaveSchema} from '../server/smtp';
import {verificationEndpoint} from '../server/email-verification';
import {mailSettings,storedMailSettings} from './smtp-fixture';

test('SMTP settings explain invalid host and mismatched port security',()=>{
 const invalid=smtpSaveSchema.safeParse({...mailSettings,smtp_host:'user@gmail.com',smtp_security:'tls'});
 assert.equal(invalid.success,false);
 if(!invalid.success){
  assert.ok(invalid.error.issues.some(i=>i.path[0]==='smtp_host'&&i.message.includes('smtp.gmail.com')));
  assert.ok(invalid.error.issues.some(i=>i.path[0]==='smtp_security'&&i.message.includes('587 requires STARTTLS')));
 }
 assert.equal(smtpSaveSchema.safeParse(mailSettings).success,true);
 assert.equal(smtpSaveSchema.safeParse({...mailSettings,smtp_port:465,smtp_security:'tls'}).success,true);
 assert.equal(smtpSaveSchema.safeParse({...mailSettings,smtp_port:465}).success,false);
});

test('SMTP authentication failures explain app passwords without exposing provider details',async()=>{
 const transport=mock.method(nodemailer,'createTransport',()=>({sendMail:async()=>{throw Object.assign(new Error('private provider details'),{code:'EAUTH'});},close(){}}));
 try{
  await assert.rejects(deliver('recipient@example.test','Test','Hello',{...mailSettings,smtp_host:'smtp.gmail.com'}),error=>error instanceof Error&&error.message.includes('App Password')&&!error.message.includes('private provider details'));
 }finally{transport.mock.restore();}
});

test('SMTP uses encrypted transport, authenticated delivery, safe failures and cleanup',async()=>{
 let closed=0,fail=false;
 const transport=mock.method(nodemailer,'createTransport',(options)=>{
  assert.equal(options.host,mailSettings.smtp_host);assert.deepEqual(options.auth,{user:mailSettings.smtp_username,pass:mailSettings.smtp_password});
  assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.logger,false);
  return {sendMail:async(message)=>{assert.equal(message.to,'recipient@example.test');if(fail)throw new Error('secret provider response');},close(){closed++;}};
 });
 try{
  await deliver('recipient@example.test','Test','Hello',mailSettings);
  assert.equal(transport.mock.calls[0].arguments[0].requireTLS,true);assert.equal(transport.mock.calls[0].arguments[0].secure,false);
  await deliver('recipient@example.test','Test','Hello',{...mailSettings,smtp_port:465,smtp_security:'tls'});
  assert.equal(transport.mock.calls[1].arguments[0].secure,true);
  fail=true;await assert.rejects(deliver('recipient@example.test','Test','Hello',mailSettings),error=>error instanceof Error&&!error.message.includes('secret provider response')&&error.message.includes('SMTP'));
  assert.equal(closed,3);
 }finally{transport.mock.restore();}
});

test('Super Admin saves encrypted credentials, can keep or replace them, and never reads the password',async()=>{
 const previous={...env},original=globalThis.fetch;
 env.supabaseUrl='https://smtp-test.invalid';env.supabaseSecretKey='test';env.jwtSecret='smtp-test-secret';
 const user={id:randomUUID(),email:'admin@example.test',roles:['admin'],status:'active',password_hash:'test-hash'};
 let stored=storedMailSettings();
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('/users'))return Response.json(user);
  assert.match(String(url),/email_verification_settings/);
  if(options?.method==='PATCH')stored={...stored,...JSON.parse(String(options.body))};
  return Response.json(stored);
 };
 const token=jwt.sign({id:user.id,credentialVersion:credentialVersion(user.password_hash)},env.jwtSecret);
 const request=(body?:unknown)=>new Request('http://localhost/api/community?resource=email-settings',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  const {smtp_password,...publicSettings}=mailSettings;
  assert.equal((await verificationEndpoint(request({...publicSettings,smtp_password}),true)).status,200);
  assert.notEqual(stored.smtp_password_enc,smtp_password);assert.equal(decryptSmtpPassword(stored.smtp_password_enc),smtp_password);
  const result=await (await verificationEndpoint(request(),true)).json();
  assert.equal(result.passwordConfigured,true);assert.equal(result.settings.smtp_password_enc,undefined);assert.equal(result.settings.smtp_password,undefined);
  const encrypted=stored.smtp_password_enc;
  await verificationEndpoint(request({...publicSettings,smtp_password:''}),true);assert.equal(stored.smtp_password_enc,encrypted);
  await assert.rejects(verificationEndpoint(request({...publicSettings,smtp_host:'new.example.test',smtp_password:''}),true),/Re-enter/);
  await verificationEndpoint(request({...publicSettings,smtp_password:'replacement-password'}),true);assert.equal(decryptSmtpPassword(stored.smtp_password_enc),'replacement-password');
  user.roles=['broker'];await assert.rejects(verificationEndpoint(request({...publicSettings,smtp_password:'bad'}),true),/do not have access/);
  const encryptedAgain=encryptSmtpPassword(smtp_password);assert.notEqual(encryptedAgain,encrypted);
  env.jwtSecret='rotated-key';assert.throws(()=>decryptSmtpPassword(encrypted),/save the SMTP password again/);
 }finally{globalThis.fetch=original;Object.assign(env,previous);}
});

test('SMTP migration keeps settings private',async()=>{
 const pg=new PGlite();try{
  await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create table users(id uuid primary key,email text,status text,verification jsonb,updated_at timestamptz);');
  for(const file of ['202609290001_email_verification.sql','202610010001_smtp_settings.sql'])await pg.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await pg.exec("update email_verification_settings set smtp_password_enc='encrypted';set role authenticated;");
  await assert.rejects(pg.query('select smtp_password_enc from email_verification_settings'),/permission denied/);
  await pg.exec('reset role;set role service_role;');
  assert.equal((await pg.query<{smtp_port:number}>('select smtp_port from email_verification_settings')).rows[0].smtp_port,587);
 }finally{await pg.close();}
});

