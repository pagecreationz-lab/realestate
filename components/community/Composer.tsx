import {useState,type FormEvent} from 'react';
import {Upload, X,ShieldCheck,Send,Film,ImagePlus} from 'lucide-react';
import {community} from './client';
import {serviceCategories} from './service-categories';

export default function Composer({close,done}:{close:()=>void;done:()=>void}){
 const [postType,setPostType]=useState('property');
 const [files,setFiles]=useState<File[]>([]);const [busy,setBusy]=useState(false);const [progress,setProgress]=useState('');const [error,setError]=useState('');const [uploaded,setUploaded]=useState<{file:File;id:string}[]>([]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!files.length){setError('Attach at least one photo or video.');return;}
  const form=new FormData(e.currentTarget);setBusy(true);setError('');
  try{
   const ids:string[]=[];
   for(const [i,file] of files.entries()){
    const existing=uploaded.find(u=>u.file===file);if(existing){ids.push(existing.id);continue;}
    setProgress(`Uploading ${i+1} of ${files.length} — ${file.name}`);
    const ticket=await community('',{action:'upload',mime:file.type,bytes:file.size});
    const response=await fetch(ticket.url,{method:'PUT',headers:ticket.headers??{'Content-Type':file.type,'x-upsert':'false'},body:file});
    if(!response.ok)throw new Error('Upload failed. Your post has not been published. Please retry.');
    ids.push(ticket.id);setUploaded(previous=>[...previous,{file,id:ticket.id}]);
   }
   setProgress('Sending your post for review…');
   await community('',{action:'post',postType,serviceCategory:postType==='service'?form.get('serviceCategory'):undefined,caption:form.get('caption'),location:form.get('location'),intent:postType==='service'?'Sell':form.get('intent'),price:Number(form.get('price')),phone:form.get('phone'),media:ids,consent:form.get('consent')==='on'});
   done();
  }catch(err){setError((err as Error).message);}finally{setBusy(false);}
 }
 return <div className="cs-overlay"><section className="cs-modal" role="dialog" aria-modal="true" aria-label="Create a property post"><header><div><small>YOUR SPACE. YOUR STORY.</small><h2>Create a post</h2></div><button aria-label="Close composer" disabled={busy} onClick={close}><X/></button></header><form onSubmit={submit}>
 <label>Post type<select aria-label="Post type" value={postType} disabled={busy} onChange={e=>setPostType(e.target.value)}><option value="property">Property</option><option value="service">Business / service</option></select></label>
 {postType==='service'&&<label>Service category<select aria-label="Service category" name="serviceCategory" required>{serviceCategories.map(c=><option key={c}>{c}</option>)}</select></label>}
 <label className="cs-upload"><Upload size={30}/><strong>Drop into their next chapter.</strong><span>Choose photos or a video walkthrough</span><input aria-label="Select photos or videos" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={busy} onChange={e=>{const chosen=Array.from(e.target.files??[]);if(chosen.length>8||chosen.some(f=>f.size>50*1024*1024||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(f.type))){setError('Choose up to 8 JPG, PNG, WebP, MP4 or WebM files, each under 50 MB.');return;}setFiles(chosen);setError('');}}/><small>Up to 8 files · 50 MB each · MP4, WebM, JPG, PNG, WebP</small></label>
 {files.length>0&&<ul className="cs-file-list">{files.map((f,i)=><li key={i}>{f.type.startsWith('video')?<Film size={16}/>:<ImagePlus size={16}/>}<span>{f.name}</span><small>{(f.size/1024/1024).toFixed(1)} MB</small></li>)}</ul>}
 <label>Tell the story<textarea name="caption" required minLength={10} maxLength={3000} placeholder={postType==='service'?'Business name, services offered, experience, service area and pricing details…':'Describe your property…'}/></label>
 <div className="cs-fields">{postType==='property'&&<label>I'm posting to<select name="intent"><option>Sell</option><option>Rent</option></select></label>}<label>{postType==='service'?'Starting price (₹, enter 0 for quote)':'Asking price (₹)'}<input name="price" type="number" min="0" max="1000000000000" step="0.01" required/></label></div>
 <div className="cs-fields"><label>Location / service area<input name="location" required minLength={2} maxLength={150} placeholder="Adyar, Chennai"/></label><label>Call number (optional)<input name="phone" type="tel" pattern="\+?[0-9]{7,15}" placeholder="+919876543210"/></label></div>
 <p className="cs-help">If added, your phone number is available to signed-in viewers through the Call button.</p>
 <div className="cs-review-note"><ShieldCheck/><p><strong>Reviewed before it's shared.</strong> Every photo and video stays private until a super admin reviews it. Adult content, nudity and unrelated content are not allowed.</p></div>
 <label className="cs-check"><input name="consent" type="checkbox" required/>I own or have permission to share this content, and it contains no adult content.</label>
 {error&&<p className="cs-error" role="alert">{error}</p>}{busy&&<p role="status">{progress}</p>}<button className="cs-primary" disabled={busy}>{busy?'Uploading…':'Send for approval'}<Send size={16}/></button>
 </form></section></div>;
}

