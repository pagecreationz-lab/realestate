import {useState,type FormEvent} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {community} from './client';
import './creator.css';
import './signup.css';
export default function EmailVerification(){
 const location=useLocation();
 const [email,setEmail]=useState<string>(location.state?.email||'');
 const [otp,setOtp]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const portal=location.state?.portal==='broker'?'broker':'user';
 const next=location.state?.next;
 const returnQuery=typeof next==='string'&&/^\/\?post=[a-f0-9-]{36}$/i.test(next)?'?next='+encodeURIComponent(next):'';
 async function submit(e:FormEvent<HTMLFormElement>,verify:boolean){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{const d=await community('email-verification',verify?{action:'verify',email,otp}:{action:'resend',email});setMessage(d.message);if(verify)setDone(true);else setOtp('');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <main className="cs-app cs-signup-page"><section className="cs-signup-card">
  <h1>Verify your email</h1><p>Enter the six-digit OTP sent to your email before signing in.</p>
  {error&&<p role="alert" className="cs-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {!done&&<><form onSubmit={e=>submit(e,true)}>
   <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Email OTP<input name="otp" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value)}/></label>
   <button className="cs-primary" disabled={busy}>Verify email</button>
  </form><form onSubmit={e=>submit(e,false)}>
   <button className="cs-primary" disabled={busy||!email.trim()}>Resend OTP</button>
   <small>Codes expire after 10 minutes and allow five incorrect attempts. Allow five minutes between requests.</small>
  </form></>}
  {done?<Link className="cs-primary" to={'/signin/'+portal+returnQuery}>Continue to sign in</Link>:<><Link to="/signin/user">Sign in as user</Link><Link to="/signin/broker">Sign in as professional</Link></>}
 </section></main>;
}
