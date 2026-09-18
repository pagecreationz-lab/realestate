import {createHash,randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {getSupabaseAdmin} from './config/supabase.js';
import {ApiError,authenticateRequest} from './lib/api.js';

const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const password=z.string().min(12).max(72).refine(v=>Buffer.byteLength(v,'utf8')<=72,'Password must not exceed 72 UTF-8 bytes');
const checked=<T extends {error:unknown}>(r:T)=>{if(r.error)throw r.error;return r;};
export async function handleAccountSecurity(request:Request){
 const db=getSupabaseAdmin();
 const body=request.method==='POST'?await request.json():{};
 if(body.action==='request-reset'){
  const email=z.string().trim().email().max(254).parse(body.email).toLowerCase();
  const key=process.env.RESEND_API_KEY,from=process.env.RESET_EMAIL_FROM,site=process.env.PASSWORD_RESET_SITE_URL;
  if(!key||!from||!site)throw new ApiError(503,'Email password reset is not configured. Contact the administrator.');
  const origin=new URL(site);if(origin.protocol!=='https:'&&!(origin.protocol==='http:'&&origin.hostname==='localhost'))throw new ApiError(503,'Password reset URL is not configured securely.');
  const {data:user}=checked(await db.from('users').select('id,roles').eq('email',email).eq('status','active').maybeSingle());
  const message='If this is an eligible customer account, a reset link will be emailed. Please allow a few minutes before requesting another.';
  if(user&&user.roles.includes('user')&&!user.roles.some((r:string)=>['admin','broker'].includes(r))){
   const token=randomBytes(32).toString('hex');
   const {data:issued}=checked(await db.rpc('account_issue_reset',{p_user:user.id,p_token:digest(token)}));
   if(issued){
    const link=new URL('/reset-password',origin);link.hash=new URLSearchParams({user:user.id,token}).toString();
    try{
     const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','User-Agent':'EaseHome/1.0'},body:JSON.stringify({from,to:[email],subject:'Reset your EASE HOME password',text:`You requested a password reset. Open this link within 20 minutes: ${link.toString()}\nIf you did not request this, ignore this email.`}),signal:AbortSignal.timeout(10000)});
     if(!sent.ok)console.error('Password reset email delivery failed:',sent.status);
    }catch{console.error('Password reset email service unavailable');}
   }
  }
  return Response.json({message});
 }
 if(body.action==='complete-reset'){
  const input=z.object({user:z.string().uuid(),token:z.string().regex(/^[a-f0-9]{64}$/),password}).parse(body);
  const {data:ok}=checked(await db.rpc('account_consume_reset',{p_user:input.user,p_token:digest(input.token),p_password:await bcrypt.hash(input.password,12)}));
  if(!ok)throw new ApiError(400,'Reset link is invalid or expired. Request a new link.');
  return Response.json({message:'Password reset. Sign in with your new password.'});
 }
 const session=await authenticateRequest(request);
 const {data:user}=checked(await db.from('users').select('id,name,email,mobile,roles,status,password_hash,verification').eq('id',session.id).single());
 if(!user||user.status!=='active')throw new ApiError(403,'Account is not active.');
 if(request.method==='GET')return Response.json({user:{id:user.id,name:user.name,email:user.email,mobile:user.mobile,roles:user.roles}});
 if(body.action==='update-profile'){
  const input=z.object({name:z.string().trim().min(2).max(120),mobile:z.string().trim().regex(/^\+?[0-9]{7,15}$/).or(z.literal(''))}).parse(body);
  checked(await db.rpc('account_update_profile',{p_user:session.id,p_name:input.name,p_mobile:input.mobile}));
  return Response.json({message:'Profile updated.'});
 }
 if(body.action==='admin-password'){
  if(!user.roles.includes('admin'))throw new ApiError(403,'Only super admins can use this password change.');
  const input=z.object({currentPassword:z.string().min(1).max(200),password}).parse(body);
  if(!await bcrypt.compare(input.currentPassword,user.password_hash))throw new ApiError(400,'Current password is incorrect.');
  const {data}=checked(await db.from('users').update({password_hash:await bcrypt.hash(input.password,12)}).eq('id',session.id).eq('password_hash',user.password_hash).select('id'));
  if(!data?.length)throw new ApiError(409,'Password changed meanwhile. Sign in again.');
  return Response.json({message:'Password changed. Sign in again.'});
 }
 throw new ApiError(400,'Unknown account action');
}
