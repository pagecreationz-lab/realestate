import {useEffect,useState} from 'react';
import {community,when} from './client';
import './admin-accounts.css';
type Log={id:string;post_id:string;actor_id:string;reason:string;created_at:string;snapshot:{caption:string;location:string;status:string;price:number}};
export default function DeletedPosts(){
 const [page,setPage]=useState(0),[logs,setLogs]=useState<Log[]>([]),[total,setTotal]=useState(0),[error,setError]=useState('');
 useEffect(()=>{let active=true;setError('');community('deleted-posts&page='+page).then(d=>{if(active){setLogs(d.logs);setTotal(d.total);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[page]);
 return <section className="cs-accounts"><h2>Deleted post log</h2><p>Owner deletions are retained here for audit. These posts are not public.</p>{error&&<p role="alert" className="cs-error">{error}</p>}{logs.map(l=><article key={l.id}><h3>{l.snapshot.caption}</h3><p>{l.snapshot.location} · {when(l.created_at)}</p><p>Reason: {l.reason}</p><p>Post: {l.post_id}<br/>Deleted by account: {l.actor_id}</p><details><summary>Post details at deletion</summary><pre>{JSON.stringify(l.snapshot,null,2)}</pre></details></article>)}{!logs.length&&!error&&<p>No deleted posts.</p>}<div className="cs-account-pager"><button disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button disabled={(page+1)*25>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></section>;
}
