import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {getSupabaseAdmin} from './config/supabase.js';
import {ApiError,type SessionUser} from './lib/api.js';
const checked=<T extends {error:unknown}>(r:T)=>{if(r.error)throw r.error;return r;};
export async function heroSlides(user?:SessionUser,body?:Record<string,unknown>){
 const db=getSupabaseAdmin();
 if(user&&!user.roles.includes('admin'))throw new ApiError(403,'Super admin required.');
 if(body){
  if(!user)throw new ApiError(403,'Super admin required.');
  if(body.operation==='settings'){
   const settings=z.object({mode:z.enum(['single','autoplay']),interval_seconds:z.number().int().min(3).max(60),selected_slide_id:z.string().uuid().nullable()}).parse(body);
   checked(await db.from('hero_settings').upsert({id:1,...settings}));return Response.json({ok:true});
  }
  if(body.operation==='upload'){
   const input=z.object({mime:z.enum(['image/jpeg','image/png','image/webp','video/mp4','video/webm']),bytes:z.number().int().positive().max(50*1024*1024)}).parse(body);
   const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
   const path=`${user.id}/${randomUUID()}.${extensions[input.mime]}`;
   const {data,error}=await db.storage.from('hero-media').createSignedUploadUrl(path);
   if(error||!data)throw new ApiError(503,'Hero upload storage is unavailable. Apply the hero-media migration and check Supabase Storage.');
   return Response.json({uploadUrl:data.signedUrl,publicUrl:db.storage.from('hero-media').getPublicUrl(path).data.publicUrl,mediaType:input.mime.startsWith('video/')?'video':'image'});
  }
  if(body.operation==='delete'){checked(await db.from('hero_slides').delete().eq('id',z.string().uuid().parse(body.id)));return Response.json({ok:true});}
  const input=z.object({id:z.string().uuid().optional(),title:z.string().trim().min(2).max(100),description:z.string().max(300),media_type:z.enum(['image','video']).default('image'),image_url:z.union([z.literal(''),z.string().url().startsWith('https://')]),link_url:z.string().max(1000).refine(v=>/^\/(?!\/)[^\\\s]*$/.test(v)||/^https:\/\//.test(v),'Use a local path or HTTPS URL'),button_text:z.string().trim().min(1).max(40),sort_order:z.number().int().min(0).max(1000),active:z.boolean()}).parse(body);
  checked(await db.from('hero_slides').upsert(input));return Response.json({ok:true});
 }
 let query=db.from('hero_slides').select('id,title,description,image_url,media_type,link_url,button_text,sort_order,active').order('sort_order').order('id');if(!user)query=query.eq('active',true);
 const slides=checked(await query).data??[];
 const result=await db.from('hero_settings').select('mode,interval_seconds,selected_slide_id').eq('id',1).maybeSingle();
 if(result.error&&!['42P01','PGRST205'].includes(result.error.code))throw result.error;
 return Response.json({slides,settings:result.data??{mode:'single',interval_seconds:6,selected_slide_id:null}});
}
