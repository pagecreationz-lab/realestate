import {getSupabaseAdmin} from '../server/config/supabase';
const db=getSupabaseAdmin();
const {data,error}=await db.storage.getBucket('creator-media');
if(error && !/not found/i.test(error.message))throw error;
if(data){
 if(data.public)throw new Error('creator-media exists but is public. Apply the creator-platform migration to make it private.');
 console.log('Private creator-media bucket already exists.');
}else{
 const {error:createError}=await db.storage.createBucket('creator-media',{
  public:false,fileSizeLimit:52428800,
  allowedMimeTypes:['image/jpeg','image/png','image/webp','video/mp4','video/webm'],
 });
 if(createError)throw createError;
 console.log('Created private creator-media bucket.');
}
