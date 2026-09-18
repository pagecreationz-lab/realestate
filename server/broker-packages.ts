import {z} from 'zod';
import {getSupabaseAdmin} from './config/supabase.js';
import {ApiError,type SessionUser} from './lib/api.js';
export async function brokerPackages(user:SessionUser,body?:Record<string,unknown>){
 const db=getSupabaseAdmin();const admin=user.roles.includes('admin');
 if(!admin){
  if(!user.roles.includes('broker'))throw new ApiError(403,'Broker or dealer access required.');
  const {data,error}=await db.from('users').select('account_category').eq('id',user.id).single();if(error)throw error;
  if(!['broker','dealer'].includes(data.account_category))throw new ApiError(403,'Broker or dealer access required.');
 }
 if(body){
  if(!admin)throw new ApiError(403,'Only super admins can customize packages.');
  const input=z.object({id:z.number().int().min(1).max(3),name:z.string().trim().min(2).max(60),description:z.string().trim().max(400),price_paise:z.number().int().min(0).max(100000000).nullable(),duration_days:z.number().int().min(1).max(3650),features:z.array(z.string().trim().min(1).max(160)).max(20)}).parse(body);
  const {data,error}=await db.from('broker_packages').update({...input,updated_at:new Date().toISOString()}).eq('id',input.id).select('id');if(error)throw error;if(!data?.length)throw new ApiError(404,'Package not found. Apply the broker-packages migration.');
  return Response.json({ok:true});
 }
 const {data,error}=await db.from('broker_packages').select('id,name,description,price_paise,duration_days,features').order('id');if(error)throw error;
 return Response.json({packages:data??[]});
}
