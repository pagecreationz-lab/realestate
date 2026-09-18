import {z} from 'zod';
import {getSupabaseAdmin} from './config/supabase.js';
import {ApiError,type SessionUser} from './lib/api.js';

export const accountFields='id,name,email,mobile,roles,status,account_type,account_category,business_profile,verification,admin_notes,profile_version,created_at,updated_at';
function checked<T extends {error:unknown}>(result:T){if(result.error)throw result.error;return result;}
const schema=z.object({
 name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254),mobile:z.string().regex(/^\+?[\d\s-]{7,20}$/).or(z.literal('')),
 account_category:z.enum(['customer','dealer','broker','builder','admin']),status:z.enum(['active','suspended','blocked']),
 roles:z.array(z.enum(['user','broker','admin'])).min(1).max(3),
 verification:z.object({mobile:z.boolean(),identity:z.boolean(),business:z.boolean(),broker:z.boolean()}),
 business_profile:z.object({company:z.string().max(200),registration:z.string().max(100),rera:z.string().max(100),city:z.string().max(100),address:z.string().max(500),website:z.union([z.literal(''),z.string().url().startsWith('https://')]),custom:z.record(z.string().max(60),z.string().max(300)).refine(v=>Object.keys(v).length<=20)}),
 admin_notes:z.string().max(3000),
});
export async function adminAccounts(user:SessionUser,url:URL,body?:Record<string,unknown>){
 if(!user.roles.includes('admin'))throw new ApiError(403,'Super admin access required.');
 const db=getSupabaseAdmin();
 if(body){
  const input=z.object({id:z.string().uuid(),version:z.number().int().nonnegative(),reason:z.string().trim().min(5).max(500),changes:schema}).parse(body);
  const c=input.changes;
  if((c.account_category==='admin')!==c.roles.includes('admin'))throw new ApiError(400,'Super admin category and admin permission must match.');
  if(['broker','dealer','builder'].includes(c.account_category)&&!c.roles.includes('broker'))throw new ApiError(400,'Business accounts require the professional portal permission.');
  checked(await db.rpc('admin_update_account',{p_admin:user.id,p_user:input.id,p_version:input.version,p_changes:c,p_reason:input.reason}));return Response.json({ok:true});
 }
 const id=url.searchParams.get('id');
 if(!id){
  const page=z.coerce.number().int().min(0).max(10000).parse(url.searchParams.get('page')??0);
  let query=db.from('users').select(accountFields,{count:'exact'}).order('created_at',{ascending:false}).order('id').range(page*25,page*25+24);
  const category=url.searchParams.get('category');if(category)query=query.eq('account_category',z.enum(['customer','dealer','broker','builder','admin']).parse(category));
  const status=url.searchParams.get('status');if(status)query=query.eq('status',z.enum(['active','suspended','blocked']).parse(status));
  const search=(url.searchParams.get('search')??'').replace(/[^\p{L}\p{N}@. +_-]/gu,'').slice(0,100);
  if(search)query=query.or(`name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%`);
  const {data,count}=checked(await query);return Response.json({accounts:data,total:count??0,page});
 }
 z.string().uuid().parse(id);
 const {data:account}=checked(await db.from('users').select(accountFields).eq('id',id).maybeSingle());
 if(!account)throw new ApiError(404,'Account not found.');
 const historyPage=z.coerce.number().int().min(0).max(10000).parse(url.searchParams.get('historyPage')??0);
 const from=historyPage*25,to=from+24;
 const results=await Promise.all([
  db.from('creator_posts').select('id,caption,status,location,price,created_at',{count:'exact'}).eq('author_id',id).order('created_at',{ascending:false}).range(from,to),
  db.from('creator_wallets').select('balance_paise').eq('user_id',id).maybeSingle(),
  db.from('creator_ledger').select('id,amount_paise,kind,note,created_at',{count:'exact'}).eq('user_id',id).order('created_at',{ascending:false}).range(from,to),
  db.from('creator_withdrawals').select('id,amount_paise,bank_last4,status,reference,created_at',{count:'exact'}).eq('user_id',id).order('created_at',{ascending:false}).range(from,to),
  db.from('admin_account_changes').select('id,admin_id,reason,before_data,after_data,created_at',{count:'exact'}).eq('user_id',id).order('created_at',{ascending:false}).range(from,to),
 ]);
 results.forEach(checked);
 return Response.json({account,posts:results[0].data,balance:results[1].data?.balance_paise??0,ledger:results[2].data,withdrawals:results[3].data,audit:results[4].data,historyPage,hasMore:results.some(r=>'count'in r&&Number(r.count)>to+1)});
}
