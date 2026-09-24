import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {z} from 'zod';
import {env} from './config/env.js';
import {getSupabaseAdmin} from './config/supabase.js';
import {ApiError,apiErrorResponse,authenticateRequest,authorizeRequest,credentialVersion} from './lib/api.js';

const db=()=>getSupabaseAdmin();
const scope='https://www.googleapis.com/auth/drive.file';
const fileId=z.string().regex(/^[a-zA-Z0-9_-]+$/);
function checked<T extends {error:unknown}>(r:T):T{if(r.error)throw new ApiError(503,'Google Drive storage is unavailable. Apply the Google Drive migration and check database access.');return r;}
function secret(){if(!env.jwtSecret||env.jwtSecret==='change-this-secret-before-production')throw new ApiError(503,'Configure JWT_SECRET before connecting Google Drive.');return env.jwtSecret;}
function key(){return createHash('sha256').update('easehome:google-drive:v1:'+secret()).digest();}
export function encryptDriveToken(value:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const content=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),content].map(v=>v.toString('base64')).join('.');}
function decryptToken(value:string){try{const [iv,tag,content]=value.split('.').map(v=>Buffer.from(v,'base64'));const cipher=createDecipheriv('aes-256-gcm',key(),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(content),cipher.final()]).toString('utf8');}catch{throw new ApiError(503,'Reconnect the EASE HOME Google Drive account in Super Admin Settings.');}}
function oauthConfig(){
 const client=process.env.GOOGLE_DRIVE_CLIENT_ID,clientSecret=process.env.GOOGLE_DRIVE_CLIENT_SECRET,redirect=process.env.GOOGLE_DRIVE_REDIRECT_URI;
 if(!client||!clientSecret||!redirect)throw new ApiError(503,'Configure GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REDIRECT_URI on the server.');
 const url=new URL(redirect);if(url.username||url.password||url.pathname!=='/api/drive-callback'||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&url.hostname==='localhost')))throw new ApiError(503,'Google Drive redirect URL must be your HTTPS website /api/drive-callback, or HTTP localhost.');
 return {client,clientSecret,redirect};
}
async function tokenRequest(values:Record<string,string>){
 const config=oauthConfig();let response:Response;
 try{response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.client,client_secret:config.clientSecret,...values}),signal:AbortSignal.timeout(15000)});}catch{throw new ApiError(503,'Google authorization is temporarily unavailable. Try again.');}
 if(!response.ok)throw new ApiError(503,'Google Drive authorization failed. Reconnect the EASE HOME account in Super Admin Settings.');
 return await response.json() as {access_token:string;refresh_token?:string;scope?:string;expires_in?:number};
}
async function connection(){const {data}=checked(await db().from('drive_connection').select('*').eq('id',1).single());if(!data?.refresh_token_enc)throw new ApiError(503,'Connect the EASE HOME Google Drive account in Super Admin Settings before uploading.');return data;}
let cachedAccess:{credential:string;token:string;expires:number}|undefined;
async function access(){
 const config=await connection();
 if(cachedAccess&&cachedAccess.credential===config.refresh_token_enc&&cachedAccess.expires>Date.now())return {token:cachedAccess.token,root:config.root_folder_id};
 const token=await tokenRequest({grant_type:'refresh_token',refresh_token:decryptToken(config.refresh_token_enc)});
 cachedAccess={credential:config.refresh_token_enc,token:token.access_token,expires:Date.now()+Math.max(0,Math.min(token.expires_in??3600,3600)-60)*1000};
 return {token:token.access_token,root:config.root_folder_id};
}
export async function driveApiError(response:Response){
 let body:{error?:{errors?:{reason?:string}[];details?:{reason?:string}[]}}={};
 try{body=await response.json();}catch{/* Do not expose raw Google responses or credentials. */}
 const reasons=[...(body.error?.errors??[]),...(body.error?.details??[])].map(e=>e.reason);
 const has=(...values:string[])=>values.some(v=>reasons.includes(v));
 let message:string;
 if(has('accessNotConfigured','SERVICE_DISABLED','API_DISABLED'))message='Google Drive API is disabled for the OAuth client project. In Google Cloud, select that project, open APIs & Services → Library → Google Drive API, and enable it. Wait a few minutes, then reconnect from Super Admin Settings.';
 else if(has('storageQuotaExceeded'))message='The EASE HOME Google Drive account has no available storage. Free up Drive space or increase its storage, then reconnect.';
 else if(has('insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'))message='Google did not grant the required Drive permissions. Reconnect from Super Admin Settings and allow the requested Drive file access.';
 else if(has('appNotAuthorizedToFile')||response.status===404)message='The EASE HOME Drive folder is missing or this OAuth client cannot access it. Restore the folder and reconnect using the original Google account and OAuth client project.';
 else if(has('domainPolicy','adminPolicyEnforced'))message='Your Google Workspace administrator has blocked this Drive integration. Ask them to allow the EASE HOME OAuth app.';
 else if(has('rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded')||response.status===429)message='Google Drive API quota was reached. Wait and retry, or check the project quota in Google Cloud.';
 else if(response.status===401)message='Google Drive authorization expired or was revoked. Reconnect from Super Admin Settings.';
 else message=`Google Drive rejected the request (HTTP ${response.status}). Check that Google Drive API is enabled in the OAuth client project and that the selected account can use Drive.`;
 return new ApiError(503,message);
}
async function driveFetch(token:string,path:string,init:RequestInit={}){
 let response:Response;try{response=await fetch('https://www.googleapis.com/'+path,{...init,headers:{...init.headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});}catch{throw new ApiError(503,'Google Drive is temporarily unavailable. Please retry.');}
 if(!response.ok)throw await driveApiError(response);return response;
}
async function jsonDrive(token:string,path:string,body?:unknown){return (await driveFetch(token,path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})).json();}
async function newId(token:string){const data=await jsonDrive(token,'drive/v3/files/generateIds?count=1&space=drive&type=files');return fileId.parse(data.ids?.[0]);}
async function uploaderFolder(token:string,root:string,user:string){
 let {data}=checked(await db().from('drive_uploader_folders').select('folder_id').eq('user_id',user).maybeSingle());
 if(!data){const id=await newId(token);checked(await db().from('drive_uploader_folders').upsert({user_id:user,folder_id:id},{onConflict:'user_id',ignoreDuplicates:true}));data=checked(await db().from('drive_uploader_folders').select('folder_id').eq('user_id',user).single()).data;}
 const id=fileId.parse(data!.folder_id);
 const existing=await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,parents,trashed`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 if(existing.status===404){
  const response=await fetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({id,name:'Uploader '+user,mimeType:'application/vnd.google-apps.folder',parents:[root]}),signal:AbortSignal.timeout(15000)});
  if(!response.ok&&response.status!==409)throw new ApiError(503,'Unable to create the uploader folder in Google Drive.');
 }else if(!existing.ok)throw new ApiError(503,'Unable to access the uploader folder in Google Drive.');
 else{const folder=await existing.json();if(folder.trashed||!folder.parents?.includes(root))throw new ApiError(503,'Restore the uploader folder to the EASE HOME Drive folder.');}
 return id;
}
export async function createDriveUpload(user:string,id:string,mime:string,bytes:number,extension:string,origin:string){
 const website=new URL(origin);
 if(!['http:','https:'].includes(website.protocol)||website.username||website.password||website.origin!==origin)throw new ApiError(400,'Invalid upload website origin.');
 const {token,root}=await access(),folder=await uploaderFolder(token,root,user),driveId=await newId(token);
 const response=await driveFetch(token,'upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(bytes),Origin:origin},body:JSON.stringify({id:driveId,name:id+'.'+extension,mimeType:mime,parents:[folder],appProperties:{easehome_owner:user,easehome_media:id}})});
 const url=response.headers.get('location');if(!url||new URL(url).origin!=='https://www.googleapis.com')throw new ApiError(503,'Google Drive did not provide an upload session.');
 return {path:'drive:'+driveId,url,headers:{'Content-Type':mime}};
}
export async function validateDriveMedia(file:{id:string;owner_id?:string;path:string;bytes:number;mime:string}){
 const {token}=await access();const id=fileId.parse(file.path.slice(6));
 const metadata=await jsonDrive(token,`drive/v3/files/${id}?fields=id,size,mimeType,trashed,appProperties`);
 if(metadata.trashed||Number(metadata.size)!==Number(file.bytes)||metadata.mimeType!==file.mime||metadata.appProperties?.easehome_media!==file.id||(file.owner_id&&metadata.appProperties?.easehome_owner!==file.owner_id))throw new ApiError(400,'A Drive upload is incomplete or does not match its declared size, type or owner.');
}
export function driveMediaUrl(media:string,post:{id:string;edit_version?:number},privateAccess:boolean){
 const token=jwt.sign({media,post:post.id,version:post.edit_version??0,privateAccess},secret(),{algorithm:'HS256',audience:'drive-media',expiresIn:'5m'});
 return '/api/drive-media?token='+encodeURIComponent(token);
}
export async function handleDriveSettings(request:Request){
 const user=await authenticateRequest(request);authorizeRequest(user,'admin');
 if(request.method==='GET'){
  const {data}=checked(await db().from('drive_connection').select('account_email,root_folder_id,updated_at').eq('id',1).single());
  return Response.json({connected:Boolean(data?.root_folder_id),accountEmail:data?.account_email||'',folderUrl:data?.root_folder_id?'https://drive.google.com/drive/folders/'+data.root_folder_id:'',oauthConfigured:Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID&&process.env.GOOGLE_DRIVE_CLIENT_SECRET&&process.env.GOOGLE_DRIVE_REDIRECT_URI)});
 }
 if(request.method!=='POST')throw new ApiError(405,'Method not allowed');
 const config=oauthConfig();const nonce=randomUUID();
 const {data:account}=checked(await db().from('users').select('password_hash').eq('id',user.id).single());
 checked(await db().from('drive_oauth_states').delete().lt('expires_at',new Date().toISOString()));
 checked(await db().from('drive_oauth_states').insert({id:nonce,admin_id:user.id,expires_at:new Date(Date.now()+600000).toISOString()}));
 const state=jwt.sign({nonce,admin:user.id,version:credentialVersion(account!.password_hash)},secret(),{algorithm:'HS256',audience:'drive-connect',expiresIn:'10m'});
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.client,redirect_uri:config.redirect,response_type:'code',scope,access_type:'offline',prompt:'consent select_account',state}).toString();
 return Response.json({url:String(url)},{headers:{'Set-Cookie':`easehome_drive_state=${nonce}; HttpOnly; SameSite=Lax; Path=/api/drive-callback; Max-Age=600${config.redirect.startsWith('https:')?'; Secure':''}`,'Cache-Control':'no-store'}});
}
export async function handleDriveCallback(request:Request){
 let message='Google Drive connected. Return to Super Admin Settings.',status=200;
 try{
  const url=new URL(request.url);const state=jwt.verify(url.searchParams.get('state')||'',secret(),{algorithms:['HS256'],audience:'drive-connect'}) as {nonce:string;admin:string;version:string};
  const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('easehome_drive_state='))?.slice('easehome_drive_state='.length);
  if(!cookie||cookie!==state.nonce)throw new ApiError(400,'Connection expired or started in another browser. Start again from Super Admin Settings.');
  const {data:used}=checked(await db().from('drive_oauth_states').delete().eq('id',state.nonce).eq('admin_id',state.admin).gt('expires_at',new Date().toISOString()).select('id').maybeSingle());
  if(!used)throw new ApiError(400,'Connection expired or already used. Start again from Super Admin Settings.');
  const {data:admin}=checked(await db().from('users').select('roles,status,password_hash,verification').eq('id',state.admin).single());
  if(!admin?.roles.includes('admin')||admin.status!=='active'||(admin.verification?.email_required&&!admin.verification?.email)||credentialVersion(admin.password_hash)!==state.version)throw new ApiError(403,'An active Super Admin session is required.');
  if(url.searchParams.has('error'))throw new ApiError(400,'Google Drive connection was cancelled. Start again from Super Admin Settings.');
  const code=z.string().min(1).parse(url.searchParams.get('code'));const tokens=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:oauthConfig().redirect});
  if(!tokens.refresh_token||!tokens.scope?.split(' ').includes(scope))throw new ApiError(400,'Allow Drive file access and reconnect to grant offline access.');
  const about=await jsonDrive(tokens.access_token,'drive/v3/about?fields=user(emailAddress,permissionId)');
  const {data:old}=checked(await db().from('drive_connection').select('google_user_id,root_folder_id').eq('id',1).single());
  if(old?.google_user_id&&old.google_user_id!==about.user.permissionId)throw new ApiError(400,'Reconnect the original EASE HOME Google account to preserve access to uploaded media.');
  let root=old?.root_folder_id;
  if(!root){const folder=await jsonDrive(tokens.access_token,'drive/v3/files?fields=id',{name:'EASE HOME Uploads',mimeType:'application/vnd.google-apps.folder'});root=folder.id;}
  else{const folder=await jsonDrive(tokens.access_token,`drive/v3/files/${fileId.parse(root)}?fields=id,trashed`);if(folder.trashed)throw new ApiError(400,'Restore the EASE HOME Uploads folder from Drive Trash before reconnecting.');}
  checked(await db().rpc('drive_save_connection',{p_google_user:about.user.permissionId,p_email:about.user.emailAddress,p_token:encryptDriveToken(tokens.refresh_token),p_root:root}));
 }catch(error){status=error instanceof ApiError?error.status:400;message=error instanceof ApiError?error.message:'Google Drive connection failed or expired. Start again from Super Admin Settings.';}
 const safe=message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>EASE HOME Drive</title></head><body><main><h1>Google Drive</h1><p>${safe}</p><a href="/portal/admin">Return to Super Admin</a></main></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'",'Set-Cookie':'easehome_drive_state=; HttpOnly; SameSite=Lax; Path=/api/drive-callback; Max-Age=0'}});
}
export async function handleDriveMedia(request:Request){
 try{
  if(!['GET','HEAD'].includes(request.method))throw new ApiError(405,'Method not allowed');
  let claim:{media:string;post:string;version:number;privateAccess:boolean};
  try{claim=jwt.verify(new URL(request.url).searchParams.get('token')||'',secret(),{algorithms:['HS256'],audience:'drive-media'}) as typeof claim;}catch{throw new ApiError(403,'Media link expired. Refresh the feed.');}
  const {data:file}=checked(await db().from('creator_media').select('id,path,mime,bytes,post_id').eq('id',claim.media).eq('post_id',claim.post).maybeSingle());
  const {data:post}=checked(await db().from('creator_posts').select('status,deleted_at,edit_version').eq('id',claim.post).maybeSingle());
  if(!file?.path.startsWith('drive:')||!post||post.deleted_at||(post.edit_version??0)!==claim.version||(!claim.privateAccess&&post.status!=='approved'))throw new ApiError(404,'Media is unavailable.');
  const range=request.headers.get('range');if(range&&!/^bytes=(\d+-\d*|-\d+)$/.test(range))throw new ApiError(416,'Unsupported byte range');
  const {token}=await access();
  // Bound connection setup without aborting a video stream after a fixed playback interval.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  let response:Response;
  try{response=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId.parse(file.path.slice(6))}?alt=media`,{method:request.method,headers:{Authorization:'Bearer '+token,...(range?{Range:range}:{})},signal:controller.signal});}finally{clearTimeout(timer);}
  if(!response.ok){if(response.status===416)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.bytes}`}});throw new ApiError(503,'Media delivery is temporarily unavailable. Please retry.');}
  const headers=new Headers({'Content-Type':file.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
  for(const name of ['content-length','content-range']){const value=response.headers.get(name);if(value)headers.set(name,value);}
  return new Response(response.body,{status:response.status,headers});
 }catch(error){return apiErrorResponse(error);}
}

