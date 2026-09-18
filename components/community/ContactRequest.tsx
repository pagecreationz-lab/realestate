import {useEffect,useRef,useState,type FormEvent} from 'react';
import {X} from 'lucide-react';
import {community,type User} from './client';
import './contact-request.css';

export default function ContactRequest({post,user,done,close}:{post:string;user:User;done:(phone:string)=>void;close:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const element=dialog.current;const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;
  element?.showModal();document.body.style.overflow='hidden';
  return()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError('');try{const result=await community('',{action:'contact',post,role:form.get('role'),name:form.get('name'),mobile:form.get('mobile'),homeLoan:form.has('homeLoan'),siteVisit:form.has('siteVisit')});done(result.phone);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <dialog ref={dialog} className="cs-review-panel cs-contact cs-contact-dialog" aria-label="View property contact number" onCancel={event=>{event.preventDefault();if(!busy)close();}}><header className="cs-contact-heading"><h3><b>View number</b></h3><button autoFocus type="button" aria-label="Close view number" disabled={busy} onClick={close}><X size={22}/></button></header><form onSubmit={submit}><fieldset><legend>I am </legend>{['Dealer','Broker','Buyer'].map(role=><label className="cs-check" key={role}><input type="radio" name="role" value={role.toLowerCase()} required/>{role}</label>)}</fieldset><label>Name<input name="name" autoComplete="name" defaultValue={user.name} required minLength={2} maxLength={120}/></label><label>Mobile number<input name="mobile" type="tel" autoComplete="tel" placeholder="e.g. +919876543210" required minLength={7} maxLength={22}/></label><fieldset><legend>Also interested in (optional)</legend><label className="cs-check"><input type="checkbox" name="homeLoan"/>Looking for a home loan</label><label className="cs-check"><input type="checkbox" name="siteVisit"/>Request a site visit</label></fieldset><p>Your name, mobile number and interests will be saved with this property enquiry. A site-visit request is not a confirmed booking.</p>{error&&<p role="alert" className="cs-error">{error}</p>}<button className="cs-primary" disabled={busy}>{busy?'Submitting…':'Submit and view number'}</button><button type="button" disabled={busy} onClick={close}>Cancel</button></form></dialog>;
}
