import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {brokerPackages} from './broker-packages.js';
import {heroSlides} from './hero-slides.js';
import {serviceCategories} from '../components/community/service-categories.js';
import {adminAccounts} from './admin-accounts.js';
import {handleAccountSecurity} from './account-security.js';
import { getSupabaseAdmin } from './config/supabase.js';
import { ApiError, apiErrorResponse, authenticateRequest, type SessionUser } from './lib/api.js';

const uuid=z.string().uuid();
const BUCKET='creator-media';
const mediaTypes:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
const db=()=>getSupabaseAdmin();
function checked<T extends {error: unknown}>(result:T):T {if(result.error)throw result.error;return result;}
async function identity(request:Request){
 const token=await authenticateRequest(request);
 const {data}=checked(await db().from('users').select('id,name,email,roles,status,account_category').eq('id',token.id).maybeSingle());
 if(!data||data.status!=='active')throw new ApiError(403,'Your account is not active.');
 return data as SessionUser & {name:string};
}
function admin(user:SessionUser){if(!user.roles.includes('admin'))throw new ApiError(403,'Super admin access required.');}
function filterPosts(query:any,url:URL){
 query=query.is('deleted_at',null);
 const type=z.enum(['','property','service']).parse(url.searchParams.get('postType')??'');if(type)query=query.eq('post_type',type);
 const service=z.enum(['',...serviceCategories]).parse(url.searchParams.get('serviceCategory')??'');if(service)query=query.eq('post_type','service').eq('service_category',service);
 const category=z.enum(['','user','broker','dealer','builder']).parse(url.searchParams.get('authorType')??'');
 if(category)query=query.eq('creator.account_category',category==='user'?'customer':category);
 const search=z.string().max(100).parse(url.searchParams.get('search')??'').replace(/[^\p{L}\p{N}\s-]/gu,' ').trim();
 if(search){
  const clauses=[`caption.ilike.%${search}%`,`location.ilike.%${search}%`,`intent.ilike.%${search}%`];
  if(/^\d+(\.\d+)?$/.test(search))clauses.push(`price.eq.${Number(search)}`);
  query=query.or(clauses.join(','));
 }
 const intent=z.enum(['','Sell','Rent']).parse(url.searchParams.get('intent')??'');
 if(intent)query=query.eq('post_type','property').eq('intent',intent);
 return query;
}
async function rateLimit(user:string,table:string,column:string,max:number,seconds=60){
 const {count}=checked(await db().from(table).select('id',{count:'exact',head:true}).eq(column,user).gte('created_at',new Date(Date.now()-seconds*1000).toISOString()));
 if((count??0)>=max)throw new ApiError(429,'Too many requests. Please try again shortly.');
}
function bankKey(){const value=process.env.BANK_DETAILS_KEY??'';if(!/^[a-f0-9]{64}$/i.test(value))throw new ApiError(503,'Bank withdrawals are not configured yet. Please contact the administrator.');return Buffer.from(value,'hex');}
export function encryptBank(value:unknown){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',bankKey(),iv);const content=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),content].map(b=>b.toString('base64')).join('.');}
export function decryptBank(value:string){const [iv,tag,content]=value.split('.').map(p=>Buffer.from(p,'base64'));const cipher=createDecipheriv('aes-256-gcm',bankKey(),iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(content),cipher.final()]).toString('utf8'));}

async function formatPosts(posts:Record<string,any>[],user?:SessionUser){
 if(!posts.length)return [];
 const ids=posts.map(p=>p.id);
 const [mediaResult,countsResult,authorsResult]=await Promise.all([
  db().from('creator_media').select('id,post_id,path,mime').in('post_id',ids),
  db().from('creator_post_counts').select('*').in('post_id',ids),
  db().from('users').select('id,name').in('id',[...new Set(posts.map(p=>p.author_id))]),
 ]);
 const media=checked(mediaResult).data??[];const counts=checked(countsResult).data??[];const authors=checked(authorsResult).data??[];
 const events=user?checked(await db().from('creator_events').select('post_id,kind').in('post_id',ids).eq('user_id',user.id)).data??[]:[];
 const urls=media.length?checked(await db().storage.from(BUCKET).createSignedUrls(media.map(m=>m.path),300)).data??[]:[];
 return posts.map(p=>({ ...p,
  // Phone is disclosed only after an authenticated call action.
  phone:p.author_id===user?.id?p.phone:undefined,hasPhone:Boolean(p.phone),author:authors.find(a=>a.id===p.author_id)?.name??'Creator',authorType:p.creator?.account_category==='customer'?'User':p.creator?.account_category??'Creator',creator:undefined,
  media:media.filter(m=>m.post_id===p.id).map(m=>({id:m.id,mime:m.mime,url:urls.find(u=>u.path===m.path)?.signedUrl??''})),
  counts:{view:Number(counts.find(c=>c.post_id===p.id)?.views??0),like:Number(counts.find(c=>c.post_id===p.id)?.likes??0),share:Number(counts.find(c=>c.post_id===p.id)?.shares??0),save:Number(counts.find(c=>c.post_id===p.id)?.saves??0)},
  liked:events.some(e=>e.post_id===p.id&&e.kind==='like'),
  saved:events.some(e=>e.post_id===p.id&&e.kind==='save'),
 }));
}

async function threadFor(user:SessionUser,id:string){
 const {data}=checked(await db().from('creator_threads').select('*').eq('id',uuid.parse(id)).maybeSingle());
 if(!data||![data.member_a,data.member_b].includes(user.id))throw new ApiError(404,'Conversation not found.');
 return data;
}

export async function handleCommunity(request:Request){
 try{
  const url=new URL(request.url);const resource=url.searchParams.get('resource')??'feed';
  if(resource==='hero-slides'&&request.method==='GET')return await heroSlides();
  if(resource==='account'&&['GET','POST'].includes(request.method))return await handleAccountSecurity(request);
  if(request.method==='GET'&&resource==='feed'){
   const user=request.headers.has('authorization')?await identity(request):undefined;
   let query=filterPosts(db().from('creator_posts').select('*,creator:users!author_id!inner(account_category)').eq('status','approved').order('created_at',{ascending:false}).limit(30),url);
   if(url.searchParams.get('post'))query=query.eq('id',uuid.parse(url.searchParams.get('post')));
   const before=url.searchParams.get('before');if(before)query=query.lt('created_at',z.string().datetime().parse(before));
   const {data}=checked(await query);return Response.json({posts:await formatPosts(data??[],user)});
  }
  const user=await identity(request);
  if(request.method==='GET'){
   if(resource==='packages')return await brokerPackages(user);
   if(resource==='admin-slides')return await heroSlides(user);
   if(resource==='deleted-posts'){admin(user);const page=z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('page')??0);const {data,count}=checked(await db().from('creator_deletion_logs').select('id,post_id,actor_id,reason,snapshot,created_at',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(page*25,page*25+24));return Response.json({logs:data??[],total:count??0});}
   if(resource==='contact-enquiries'){
    admin(user);
    const page=z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('page')??0);
    const {data,count}=checked(await db().from('creator_contact_enquiries').select('id,post_id,user_id,role,name,mobile,home_loan,site_visit,created_at',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(page*25,page*25+24));
    const ids=[...new Set((data??[]).map(e=>e.post_id))];
    const posts=ids.length?checked(await db().from('creator_posts').select('id,caption,location,status').in('id',ids)).data??[]:[];
    return Response.json({enquiries:(data??[]).map(e=>({...e,property:posts.find(p=>p.id===e.post_id)??null})),total:count??0});
   }
   if(resource==='comments'){
    const post=uuid.parse(url.searchParams.get('post'));
    const {data:published}=checked(await db().from('creator_posts').select('id').eq('id',post).eq('status','approved').maybeSingle());
    if(!published)throw new ApiError(404,'Published post not found.');
    const {data:comments}=checked(await db().from('creator_comments').select('id,user_id,body,created_at').eq('post_id',post).order('created_at',{ascending:false}).limit(50));
    const ids=[...new Set((comments??[]).map(c=>c.user_id))];
    const people=ids.length?checked(await db().from('users').select('id,name').in('id',ids)).data??[]:[];
    return Response.json({comments:(comments??[]).map(c=>({...c,name:people.find(p=>p.id===c.user_id)?.name??'Community member'}))});
   }
   if(resource==='admin-accounts')return await adminAccounts(user,url);
   if(resource==='me')return Response.json({user});
   if(resource==='mine'||resource==='review'||resource==='saved'){
    let query=filterPosts(db().from('creator_posts').select('*,creator:users!author_id!inner(account_category)').order('created_at',{ascending:false}).limit(60),url);
    if(resource==='review'){
     admin(user);
     const state=z.enum(['all','pending','approved','rejected']).parse(url.searchParams.get('status')??'all');
     if(state!=='all')query=query.eq('status',state);
     const offset=z.coerce.number().int().min(0).max(1000000).parse(url.searchParams.get('offset')??0);
     query=query.order('id').range(offset,offset+59);
    }
    else if(resource==='mine')query=query.eq('author_id',user.id);
    else{const {data}=checked(await db().from('creator_events').select('post_id').eq('user_id',user.id).eq('kind','save'));query=query.in('id',(data??[]).map(e=>e.post_id)).eq('status','approved');}
    const {data}=checked(await query);return Response.json({posts:await formatPosts(data??[],user)});
   }
   if(resource==='threads'){
    const {data}=checked(await db().from('creator_threads').select('*').or(`member_a.eq.${user.id},member_b.eq.${user.id}`).order('created_at',{ascending:false}).limit(100));
    const threads=data??[];if(!threads.length)return Response.json({threads:[]});
    const {data:people}=checked(await db().from('users').select('id,name').in('id',threads.flatMap(t=>[t.member_a,t.member_b])));
    return Response.json({threads:threads.map(t=>({...t,name:people?.find(p=>p.id===(t.member_a===user.id?t.member_b:t.member_a))?.name??'Creator'}))});
   }
   if(resource==='messages'){
    const thread=await threadFor(user,url.searchParams.get('thread')??'');
    const {data}=checked(await db().from('creator_messages').select('id,body,sender_id,created_at').eq('thread_id',thread.id).order('created_at',{ascending:false}).limit(100));
    return Response.json({messages:(data??[]).reverse()});
   }
   if(resource==='wallet'||resource==='admin-wallet'){
    const all=resource==='admin-wallet';if(all)admin(user);
    let ledger=db().from('creator_ledger').select('*').order('created_at',{ascending:false}).limit(100);
    let withdrawals=db().from('creator_withdrawals').select('id,user_id,amount_paise,bank_last4,status,reference,created_at').order('created_at',{ascending:false}).limit(100);
    let wallets=db().from('creator_wallets').select('*');
    if(!all){ledger=ledger.eq('user_id',user.id);withdrawals=withdrawals.eq('user_id',user.id);wallets=wallets.eq('user_id',user.id);}
    const [l,w,b]=await Promise.all([ledger,withdrawals,wallets]);
    const balances=checked(b).data??[];const requests=checked(w).data??[];const entries=checked(l).data??[];
    const userIds=[...new Set([...balances,...requests,...entries].map(x=>x.user_id))];
    const people=all&&userIds.length?checked(await db().from('users').select('id,name').in('id',userIds)).data:[];
    return Response.json({ledger:entries,withdrawals:requests,wallets:balances,people,balance:balances.reduce((sum,b)=>sum+Number(b.balance_paise),0)});
   }
   if(resource==='post-audit'){
    admin(user);const id=uuid.parse(url.searchParams.get('post'));
    const {data}=checked(await db().from('creator_reviews').select('*').eq('post_id',id).order('created_at',{ascending:false}));return Response.json({reviews:data});
   }
   throw new ApiError(404,'Not found');
  }
  if(request.method!=='POST')throw new ApiError(405,'Method not allowed');
  const body=await request.json();
  const action=z.string().parse(body.action);
  if(action==='save-package')return await brokerPackages(user,body);
  if(action==='hero-slide')return await heroSlides(user,body);
  if(action==='owner-post'){
   const input=z.object({post:uuid,version:z.number().int().nonnegative(),operation:z.enum(['edit','delete'])}).parse(body);
   const changes=input.operation==='edit'?z.object({caption:z.string().trim().min(10).max(3000),location:z.string().trim().min(2).max(150),price:z.number().min(0).max(1e12),intent:z.enum(['Sell','Rent']),phone:z.string().regex(/^\+?[0-9]{7,15}$/).or(z.literal('')),serviceCategory:z.enum(serviceCategories).optional()}).parse(body.changes):{};
   const reason=input.operation==='delete'?z.string().trim().min(5).max(500).parse(body.reason):'';
   if(input.operation==='edit'&&body.media!==undefined){
    const ids=z.array(uuid).min(1).max(8).refine(v=>new Set(v).size===v.length).parse(body.media);
    const {data:owned}=checked(await db().from('creator_posts').select('id').eq('id',input.post).eq('author_id',user.id).is('deleted_at',null).maybeSingle());
    if(!owned)throw new ApiError(403,'You can only edit your own posts.');
    const {data:files}=checked(await db().from('creator_media').select('id,path,bytes,mime,post_id').in('id',ids).eq('owner_id',user.id));
    if(files?.length!==ids.length||files.some(f=>f.post_id&&f.post_id!==input.post))throw new ApiError(400,'One or more files are unavailable.');
    for(const file of files){const {data:info,error}=await db().storage.from(BUCKET).info(file.path);if(error||!info||Number(info.size)!==Number(file.bytes)||info.contentType!==file.mime)throw new ApiError(400,'An uploaded file is missing or does not match its declared type/size.');}
    checked(await db().rpc('creator_owner_edit_media',{p_user:user.id,p_post:input.post,p_version:input.version,p_changes:changes,p_media:ids}));return Response.json({ok:true});
   }
   checked(await db().rpc('creator_owner_change',{p_user:user.id,p_post:input.post,p_version:input.version,p_action:input.operation,p_changes:changes,p_reason:reason}));return Response.json({ok:true});
  }
  if(action==='update-account')return await adminAccounts(user,url,body);
  if(action==='upload'){
   await rateLimit(user.id,'creator_media','owner_id',20,3600);
   const input=z.object({mime:z.enum(['image/jpeg','image/png','image/webp','video/mp4','video/webm']),bytes:z.number().int().positive().max(50*1024*1024)}).parse(body);
   const id=randomUUID();const path=`${user.id}/${id}.${mediaTypes[input.mime]}`;
   checked(await db().from('creator_media').insert({id,owner_id:user.id,path,mime:input.mime,bytes:input.bytes}));
   const {data}=checked(await db().storage.from(BUCKET).createSignedUploadUrl(path));
   return Response.json({id,url:data!.signedUrl});
  }
  if(action==='post'){
   await rateLimit(user.id,'creator_posts','author_id',10,3600);
   const input=z.object({postType:z.enum(['property','service']).default('property'),serviceCategory:z.enum(serviceCategories).optional(),caption:z.string().trim().min(10).max(3000),location:z.string().trim().min(2).max(150),intent:z.enum(['Sell','Rent']),price:z.number().min(0).max(1e12),phone:z.string().regex(/^\+?[0-9]{7,15}$/).optional().or(z.literal('')),media:z.array(uuid).min(1).max(8),consent:z.literal(true)}).parse(body);
   if(input.postType==='service'&&!input.serviceCategory)throw new ApiError(400,'Select a service category.');
   const {data:media}=checked(await db().from('creator_media').select('*').in('id',input.media).eq('owner_id',user.id).is('post_id',null));
   if(media?.length!==input.media.length)throw new ApiError(400,'One or more files are not available. Upload them again.');
   for(const m of media){const {data:info,error}=await db().storage.from(BUCKET).info(m.path);if(error||!info||Number(info.size)!==Number(m.bytes)||info.contentType!==m.mime)throw new ApiError(400,'A file is missing or does not match the declared size/type.');}
   const result=checked(await db().rpc(input.postType==='service'?'creator_submit_service':'creator_submit',{p_user:user.id,p_caption:input.caption,p_location:input.location,...(input.postType==='service'?{p_category:input.serviceCategory}:{p_intent:input.intent}),p_price:input.price,p_phone:input.phone||null,p_media:input.media}));
   return Response.json({id:result.data,status:'pending'}, {status:201});
  }
  if(action==='moderate'){
   admin(user);const input=z.object({post:uuid,status:z.enum(['approved','rejected']),note:z.string().trim().min(5).max(1000),reviewedAll:z.literal(true),safe:z.boolean()}).parse(body);
   if(input.status==='approved'&&!input.safe)throw new ApiError(400,'Unsafe or adult content cannot be approved.');
   checked(await db().rpc('creator_moderate',{p_admin:user.id,p_post:input.post,p_status:input.status,p_note:input.note}));return Response.json({ok:true});
  }
  if(['event','contact','thread','comment'].includes(action)){
   const id=uuid.parse(body.post);const {data:post}=checked(await db().from('creator_posts').select('*').eq('id',id).eq('status','approved').maybeSingle());
   if(!post)throw new ApiError(404,'Published post not found.');
   if(action==='comment'){
    const text=z.string().trim().min(1).max(1000).parse(body.body);
    await rateLimit(user.id,'creator_comments','user_id',10);
    checked(await db().from('creator_comments').insert({post_id:id,user_id:user.id,body:text}));
    return Response.json({ok:true},{status:201});
   }
   if(action==='contact'){
    const input=z.object({role:z.enum(['dealer','broker','buyer']),name:z.string().trim().min(2).max(120),mobile:z.string().trim().transform(v=>v.replace(/[\s()-]/g,'')).pipe(z.string().regex(/^\+?\d{7,15}$/)),homeLoan:z.boolean(),siteVisit:z.boolean()}).parse(body);
    if(!post.phone)throw new ApiError(404,'No contact number is available. Please message the creator.');
    checked(await db().from('creator_contact_enquiries').upsert({post_id:id,user_id:user.id,role:input.role,name:input.name,mobile:input.mobile,home_loan:input.homeLoan,site_visit:input.siteVisit},{onConflict:'post_id,user_id'}));
    return Response.json({phone:post.phone});
   }
   if(action==='event'){
    const kind=z.enum(['view','like','save','share']).parse(body.kind);const active=z.boolean().parse(body.active);
    if(post.author_id===user.id&&['view','share'].includes(kind))return Response.json({ok:true});
    if(!active&&!['like','save'].includes(kind))throw new ApiError(400,'This counter cannot be removed.');
    checked(await(active?db().from('creator_events').upsert({post_id:id,user_id:user.id,kind},{onConflict:'post_id,user_id,kind',ignoreDuplicates:true}):db().from('creator_events').delete().eq('post_id',id).eq('user_id',user.id).eq('kind',kind)));
    const {count}=checked(await db().from('creator_events').select('*',{count:'exact',head:true}).eq('post_id',id).eq('kind',kind));
    return Response.json({ok:true,count:count??0});
   }
   if(post.author_id===user.id)throw new ApiError(400,'You cannot message yourself.');
   const [a,b]=[user.id,post.author_id].sort();
   checked(await db().from('creator_threads').upsert({member_a:a,member_b:b,post_id:id},{onConflict:'member_a,member_b,post_id',ignoreDuplicates:true}));
   const {data}=checked(await db().from('creator_threads').select('id').eq('member_a',a).eq('member_b',b).eq('post_id',id).single());return Response.json(data);
  }
  if(action==='message'){
   const input=z.object({thread:uuid,body:z.string().trim().min(1).max(2000)}).parse(body);await threadFor(user,input.thread);
   await rateLimit(user.id,'creator_messages','sender_id',20);
   checked(await db().from('creator_messages').insert({thread_id:input.thread,sender_id:user.id,body:input.body}));return Response.json({ok:true},{status:201});
  }
  if(action==='credit'){
   admin(user);const input=z.object({post:uuid,amount:z.number().int().min(1).max(10000000),note:z.string().trim().min(5).max(500),key:uuid}).parse(body);
   checked(await db().rpc('creator_credit',{p_admin:user.id,p_post:input.post,p_amount:input.amount,p_note:input.note,p_key:input.key}));return Response.json({ok:true});
  }
  if(action==='withdraw'){
   const input=z.object({amount:z.number().int().min(10000).max(10000000),holder:z.string().trim().min(2).max(100),account:z.string().regex(/^\d{9,18}$/),ifsc:z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),key:uuid}).parse(body);
   const encrypted=encryptBank({holder:input.holder,account:input.account,ifsc:input.ifsc});
   checked(await db().rpc('creator_withdraw',{p_user:user.id,p_amount:input.amount,p_bank:encrypted,p_last4:input.account.slice(-4),p_key:input.key}));return Response.json({ok:true});
  }
  if(action==='bank-details'){
   admin(user);const id=uuid.parse(body.id);const {data}=checked(await db().from('creator_withdrawals').select('bank_encrypted,status').eq('id',id).single());
   if(!data||data.status!=='requested')throw new ApiError(400,'This request has already been resolved or does not exist.');
   checked(await db().from('creator_audit').insert({admin_id:user.id,action:'bank-details-viewed',target_id:id}));return Response.json({bank:decryptBank(data.bank_encrypted)});
  }
  if(action==='settle'){
   admin(user);const input=z.object({id:uuid,status:z.enum(['paid','rejected']),reference:z.string().trim().min(5).max(150)}).parse(body);
   checked(await db().rpc('creator_settle',{p_admin:user.id,p_id:input.id,p_status:input.status,p_reference:input.reference}));return Response.json({ok:true});
  }
  throw new ApiError(400,'Unknown action');
 }catch(error){
  if(error&&typeof error==='object'&&'code' in error){
   const e=error as {code:string;message?:string};
   if(['42P01','PGRST205'].includes(e.code)&&e.message?.includes('broker_packages'))return Response.json({message:'Apply the broker-packages migration to enable package plans.'},{status:503});
   if(e.code==='PGRST202'&&e.message?.includes('creator_owner_edit_media'))return Response.json({message:'Apply the owner-post-media migration to enable image replacement.'},{status:503});
   if(['42P01','PGRST205'].includes(e.code)&&e.message?.includes('hero_settings'))return Response.json({message:'Apply the hero-playback migration to manage autoplay and single-slide mode.'},{status:503});
   if(['42703','PGRST204'].includes(e.code)&&e.message?.includes('media_type'))return Response.json({message:'Apply the hero-media migration to enable carousel images and videos.'},{status:503});
   if(['42P01','PGRST205'].includes(e.code)&&e.message?.includes('hero_slides'))return Response.json({message:'Apply the hero-slides migration to manage the carousel.'},{status:503});
   if(['42703','42P01','PGRST204','PGRST205','PGRST202'].includes(e.code)&&/deleted_at|edit_version|creator_deletion_logs|creator_owner_change/.test(e.message??''))return Response.json({message:'Apply the owner-post-management migration to enable post editing and deletion logs.'},{status:503});
   if(['42703','42P01','PGRST204','PGRST202'].includes(e.code)&&/post_type|service_category|creator_submit_service/.test(e.message??''))return Response.json({message:'Apply the business-services migration to enable service posts.'},{status:503});
   if(['42P01','PGRST205'].includes(e.code)&&e.message?.includes('creator_comments'))return Response.json({message:'Apply the post-comments database migration to enable comments.'},{status:503});
   if(['42P01','PGRST205','PGRST202'].includes(e.code)&&/account_password_resets|account_issue_reset|account_consume_reset|account_update_profile/.test(e.message??''))return Response.json({message:'Apply the account-security database migration to enable profile updates and customer password resets.'},{status:503});
   if(['42P01','PGRST205'].includes(e.code)&&e.message?.includes('creator_contact_enquiries'))return Response.json({message:'Contact enquiries are not configured yet. Ask your administrator to apply the contact-enquiries migration.'},{status:503});
   if(e.code==='23505')return Response.json({message:'That email address is already in use.'},{status:409});
   if(['42703','PGRST204'].includes(e.code)&&/account_category|business_profile|admin_notes|profile_version/.test(e.message??''))return Response.json({message:'Apply the admin-accounts database migration to enable account management.'},{status:503});
   if(e.message?.includes('fetch failed'))return Response.json({message:'The community service is currently unavailable. Please try again later.'},{status:503});
   if(['42P01','PGRST205','PGRST202'].includes(e.code)){
    console.error('Community schema unavailable:', e.code, e.message);
    return Response.json({message:'The social platform database update has not been applied yet. Ask your administrator to run the creator-platform migration.'},{status:503});
   }
   if(e.code==='P0001')return Response.json({message:e.message??'Request could not be completed.'},{status:409});
  }
  return apiErrorResponse(error);
 }
}
