import {createHmac,randomInt} from 'node:crypto';
import {env} from './config/env.js';
import {z} from 'zod';
import {getSupabaseAdmin} from './config/supabase.js';
import {ApiError,authenticateRequest,authorizeRequest} from './lib/api.js';
import {emailSettingsSchema,smtpSaveSchema,publicMailFields,encryptSmtpPassword,decryptSmtpPassword,deliver,type MailSettings} from './smtp.js';
export {emailSettingsSchema} from './smtp.js';
type StoredMailSettings=Omit<MailSettings,'smtp_password'>&{smtp_password_enc:string};
const checked=<T extends {error:unknown}>(r:T)=>{if(r.error)throw new ApiError(503,'Email verification storage is unavailable. Apply the email-verification migration and check database access.');return r;};
const hash=(email:string,otp:string)=>{
 if(!env.jwtSecret||env.jwtSecret==='change-this-secret-before-production')throw new ApiError(503,'Email verification is not configured. Contact the administrator.');
 return createHmac('sha256',env.jwtSecret).update(`email-verification:${email}:${otp}`).digest('hex');
};
export async function emailSettings(){
 const {data}=checked(await getSupabaseAdmin().from('email_verification_settings').select(publicMailFields+',smtp_password_enc').eq('id',1).single<StoredMailSettings>());
 const {smtp_password_enc,...settings}=data||{};
 const parsed=emailSettingsSchema.safeParse(settings);
 if(!parsed.success||!smtp_password_enc)throw new ApiError(503,'Email delivery is not configured. Ask the Super Admin to save SMTP settings.');
 return {...parsed.data,smtp_password:decryptSmtpPassword(smtp_password_enc)};
}
export async function sendVerification(user:{id:string;email:string},config:Awaited<ReturnType<typeof emailSettings>>){
 const otp=randomInt(0,1000000).toString().padStart(6,'0');
 const {data}=checked(await getSupabaseAdmin().rpc('account_issue_verification',{p_user:user.id,p_token:hash(user.email,otp)}));
 if(!data)return;
 const link=new URL('/verify-email',config.site_url);
 await deliver(user.email,'Your EASE HOME verification code',`Your email verification OTP is ${otp}. Enter it at ${link} within 10 minutes. Do not share this code.\nIf you did not create this account, ignore this message.`,config);
}
export async function verificationEndpoint(request:Request,settings=false){
 const db=getSupabaseAdmin();
 if(settings){
  const user=await authenticateRequest(request);authorizeRequest(user,'admin');
  if(request.method==='GET'){
   const {data}=checked(await db.from('email_verification_settings').select(publicMailFields+',smtp_password_enc').eq('id',1).single<StoredMailSettings>());
   const {smtp_password_enc,...settings}=data||{};
   return Response.json({settings,passwordConfigured:Boolean(smtp_password_enc)});
  }
  if(request.method!=='POST')throw new ApiError(405,'Method not allowed');
  const body=await request.json();
  if(body.action==='test'){
   const {data}=checked(await db.from('users').select('email').eq('id',user.id).single());
   if(!data)throw new ApiError(404,'Admin account not found');
   await deliver(data.email,'EASE HOME email configuration test','Your email verification delivery configuration is working.',await emailSettings());
   return Response.json({message:'Test email sent to your admin email address.'});
  }
  const validation=smtpSaveSchema.safeParse(body);
  if(!validation.success){
   const labels:Record<string,string>={sender:'Sender email',site_url:'Website URL',smtp_host:'SMTP host',smtp_port:'SMTP port',smtp_security:'Connection security',smtp_username:'SMTP username',smtp_password:'SMTP password'};
   throw new ApiError(400,validation.error.issues.map(issue=>`${labels[String(issue.path[0])]||'SMTP settings'}: ${issue.message}`).join(' '));
  }
  const {smtp_password,...input}=validation.data;
  let passwordUpdate={};
  if(smtp_password)passwordUpdate={smtp_password_enc:encryptSmtpPassword(smtp_password)};
  else{
   const {data}=checked(await db.from('email_verification_settings').select('smtp_password_enc,smtp_host,smtp_port,smtp_security,smtp_username').eq('id',1).single());
   if(!data?.smtp_password_enc)throw new ApiError(400,'Enter the SMTP password to configure email delivery.');
   if(data.smtp_host!==input.smtp_host||data.smtp_port!==input.smtp_port||data.smtp_security!==input.smtp_security||data.smtp_username!==input.smtp_username)throw new ApiError(400,'Re-enter the SMTP password when changing the SMTP connection or username.');
   decryptSmtpPassword(data.smtp_password_enc);
  }
  checked(await db.from('email_verification_settings').update({...input,...passwordUpdate,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',1));
  return Response.json({message:'SMTP configuration saved.'});
 }
 if(request.method!=='POST')throw new ApiError(405,'Method not allowed');
 const body=await request.json();
 if(body.action==='verify'){
  const input=z.object({action:z.literal('verify'),email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),otp:z.string().regex(/^[0-9]{6}$/)}).strict().parse(body);
  const {data}=checked(await db.rpc('account_consume_email_otp',{p_email:input.email,p_token:hash(input.email,input.otp)}));
  if(!data)throw new ApiError(400,'Verification code is invalid, expired, already used or has reached the attempt limit. Request a new code after five minutes.');
  return Response.json({message:'Email verified. You can now sign in.'});
 }
 if(body.action!=='resend')throw new ApiError(400,'Unknown verification action');
 const email=z.string().trim().email().max(254).parse(body.email).toLowerCase();
 const config=await emailSettings();
 const {data}=checked(await db.from('users').select('id,email').eq('email',email).eq('status','active').contains('verification',{email_required:true,email:false}).maybeSingle());
 if(data){try{await sendVerification(data,config);}catch{console.error('Verification email delivery failed; check email configuration.');}}
 return Response.json({message:'If your account needs verification, an email will arrive shortly. Check spam, or retry after five minutes.'});
}

