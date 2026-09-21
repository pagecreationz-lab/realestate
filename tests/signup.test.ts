import {test,mock} from 'node:test';
import nodemailer from 'nodemailer';
import {storedMailSettings} from './smtp-fixture';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {signup,signupSchema} from '../server/signup';
import {env} from '../server/config/env';
const input={name:'Test Person',email:'TEST@example.test',mobile:'9876543210',password:'a-long-test-password',category:'customer',company:''};
test('signup rejects privileged fields and hashes passwords with server-owned roles',async()=>{
 assert.equal(signupSchema.safeParse({...input,category:'admin'}).success,false);
 assert.equal(signupSchema.safeParse({...input,roles:['admin']}).success,false);
 assert.equal(signupSchema.safeParse({...input,status:'active',verification:{identity:true}}).success,false);
 assert.equal(signupSchema.safeParse({...input,password:'short'}).success,false);
 const previous={...env},original=globalThis.fetch;env.supabaseUrl='https://signup-test.invalid';env.supabaseSecretKey='test';env.jwtSecret='signup-test-secret';
 const transport=mock.method(nodemailer,'createTransport',()=>({sendMail:async()=>({}),close(){}}));
 let record:Record<string,any>={};globalThis.fetch=async(url,options)=>{
  if(String(url).includes('email_verification_settings'))return Response.json(storedMailSettings());
  if(String(url).includes('account_issue_verification'))return Response.json(true);
  record=JSON.parse(String(options?.body));return Response.json({id:'00000000-0000-4000-8000-000000000001',email:record.email}, {status:201});
 };
 try{
  for(const category of ['customer','broker','dealer','builder']){
   const response=await signup(new Request('http://localhost/api/community?resource=signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,category,company:category==='customer'?'':'Test Business'})}));
   assert.equal(response.status,201);assert.deepEqual(record.roles,[category==='customer'?'user':'broker']);assert.equal(record.email,'test@example.test');assert.equal(record.verification.identity,false);assert.equal(record.account_category,category);assert.notEqual(record.password_hash,input.password);assert.equal(await bcrypt.compare(input.password,record.password_hash),true);
  }
  assert.equal(record.verification.email_required,true);assert.equal(record.verification.email,false);
  assert.equal(transport.mock.callCount(),4);
 }finally{transport.mock.restore();globalThis.fetch=original;Object.assign(env,previous);}
});

