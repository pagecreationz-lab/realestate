import {useEffect,useState,type FormEvent} from 'react';
import {community,when} from './client';
export default function Comments({post}:{post:string}){
 const [comments,setComments]=useState<{id:string;name:string;body:string;created_at:string}[]>([]),[body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const d=await community('comments&post='+encodeURIComponent(post));setComments(d.comments);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[post]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await community('',{action:'comment',post,body});setBody('');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="cs-review-panel"><h3>Comments</h3>{error&&<p role="alert" className="cs-error">{error}</p>}{comments.map(c=><div key={c.id}><strong>{c.name}</strong><small> · {when(c.created_at)}</small><p>{c.body}</p></div>)}<form onSubmit={submit}><label>Add a comment<textarea required minLength={1} maxLength={1000} value={body} onChange={e=>setBody(e.target.value)}/></label><button className="cs-primary" disabled={busy}>Post comment</button></form></section>;
}
