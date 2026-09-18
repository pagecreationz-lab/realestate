import {z} from 'zod';
import {getSupabaseAdmin} from './config/supabase.js';
import {ApiError,apiErrorResponse,authenticateRequest} from './lib/api.js';

export async function handleSocial(request:Request){
 try{
  const user=await authenticateRequest(request); const db=getSupabaseAdmin();
  if(request.method==='GET'){
   const {data,error}=await db.from('property_reactions').select('property_id,kind').eq('user_id',user.id);if(error)throw error;
   return Response.json({likes:data.filter(r=>r.kind==='like').map(r=>r.property_id),saves:data.filter(r=>r.kind==='save').map(r=>r.property_id)});
  }
  if(request.method!=='POST')throw new ApiError(405,'Method not allowed');
  const input=z.object({propertyId:z.string().uuid(),kind:z.enum(['like','save']),active:z.boolean()}).parse(await request.json());
  const {data:property,error:lookupError}=await db.from('properties').select('id').eq('id',input.propertyId).eq('moderation_status','approved').maybeSingle();
  if(lookupError)throw lookupError;if(!property)throw new ApiError(404,'Property not found');
  const query=input.active?db.from('property_reactions').upsert({user_id:user.id,property_id:input.propertyId,kind:input.kind},{onConflict:'user_id,property_id,kind'}):db.from('property_reactions').delete().eq('user_id',user.id).eq('property_id',input.propertyId).eq('kind',input.kind);
  const {error}=await query;if(error)throw error;return Response.json({ok:true});
 }catch(error){return apiErrorResponse(error);}
}

export async function handleVideoUpload(request:Request){
 try{
  if(request.method!=='POST')throw new ApiError(405,'Method not allowed');
  const user=await authenticateRequest(request);
  const {data:account,error}=await getSupabaseAdmin().from('users').select('status').eq('id',user.id).maybeSingle();
  if(error)throw error;if(account?.status!=='active')throw new ApiError(403,'An active account is required');
  const input=z.object({name:z.string().min(1).max(200),size:z.number().int().positive().max(500*1024*1024),type:z.enum(['video/mp4','video/quicktime','video/webm'])}).parse(await request.json());
  const token=process.env.VIMEO_ACCESS_TOKEN;
  if(!token)throw new ApiError(503,'Video uploads are not configured yet. Add a Vimeo or YouTube link, or ask the administrator to connect Vimeo.');
  const response=await fetch('https://api.vimeo.com/me/videos',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/vnd.vimeo.*+json;version=3.4'},body:JSON.stringify({upload:{approach:'tus',size:input.size},name:input.name,description:'EASE HOME property walkthrough',privacy:{view:'unlisted',embed:'public'}})});
  if(!response.ok)throw new ApiError(502,'The video host could not create an upload. Check Vimeo upload access and account quota.');
  const video=await response.json();
  return Response.json({uploadUrl:video.upload.upload_link,videoUrl:video.link});
 }catch(error){return apiErrorResponse(error);}
}
