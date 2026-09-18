import {useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {community} from './client';
import './creator.css';
import './admin-accounts.css';
export default function ResetPassword(){
 const [params]=useState(()=>new URLSearchParams(location.hash.slice(1))),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[complete,setComplete]=useState(false);
 const token=params.get('token');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);if(token&&form.get('password')!==form.get('confirm')){setError('Passwords do not match.');return;}setBusy(true);setError('');try{const d=await community('account',token?{action:'complete-reset',user:params.get('user'),token,password:form.get('password')}:{action:'request-reset',email:form.get('email')});setMessage(d.message);if(token){localStorage.removeItem('ease-home-session');history.replaceState(null,'','/reset-password');setComplete(true);}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className="cs-app" style={{minHeight:'100vh',padding:'40px 16px'}}><section className="cs-accounts" style={{maxWidth:520,margin:'auto'}}><h1>Reset customer password</h1><p>Verify access to your registered email to choose a new password.</p>{error&&<p className="cs-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{!complete&&<form onSubmit={submit}>{token?<><label>New password (12–72 characters)<input type="password" name="password" required minLength={12} maxLength={72} autoComplete="new-password"/></label><label>Confirm password<input type="password" name="confirm" required minLength={12} maxLength={72} autoComplete="new-password"/></label></>:<label>Registered email<input type="email" name="email" required autoComplete="email"/></label>}<button className="cs-primary" disabled={busy}>{busy?'Please wait…':token?'Set new password':'Send verification link'}</button></form>}<p><Link to="/login/user">Back to sign in</Link></p></section></main>;
}
