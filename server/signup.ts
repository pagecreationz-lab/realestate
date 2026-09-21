import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {getSupabaseAdmin} from './config/supabase.js';
import {ApiError} from './lib/api.js';
import {emailSettings,sendVerification} from './email-verification.js';
export const signupSchema=z.object({
 name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),
 mobile:z.string().trim().regex(/^\+?[0-9]{7,15}$/),
 password:z.string().min(12).max(72).refine(v=>Buffer.byteLength(v,'utf8')<=72,'Password must be at most 72 UTF-8 bytes'),
 category:z.enum(['customer','broker','dealer','builder']),company:z.string().trim().max(200).default(''),
}).strict().refine(v=>v.category==='customer'||v.company.length>=2,'Business name is required for professional accounts');
export async function signup(request:Request){
 if(request.method!=='POST')throw new ApiError(405,'Use POST to create an account.');
 const input=signupSchema.parse(await request.json());
 const config=await emailSettings();
 const role=input.category==='customer'?'user':'broker';
 const {data,error}=await getSupabaseAdmin().from('users').insert({name:input.name,email:input.email,mobile:input.mobile,password_hash:await bcrypt.hash(input.password,12),roles:[role],account_type:role==='user'?'individual':'business',account_category:input.category,business_profile:{company:input.company},verification:{email_required:true,email:false,mobile:false,identity:false,business:false,broker:false},status:'active'}).select('id,email').single();
 if(error){
  if(error.code==='23505')throw new ApiError(409,'An account with these details already exists. Please sign in or reset your password.');
  throw error;
 }
 try{await sendVerification(data,config);}catch{return Response.json({message:'Account created, but the verification email could not be sent. Please request another email in five minutes or contact the administrator.',portal:role},{status:201});}
 return Response.json({message:'Account created. Check your inbox and verify your email before signing in. The OTP expires in 10 minutes.',portal:role},{status:201});
}

