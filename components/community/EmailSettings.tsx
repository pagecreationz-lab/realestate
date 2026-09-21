import {useEffect,useState,type FormEvent} from 'react';
import {community} from './client';
const defaults={sender:'',site_url:'',smtp_host:'',smtp_port:587,smtp_security:'starttls',smtp_username:''};
export default function EmailSettings(){
 const [settings,setSettings]=useState(defaults),[password,setPassword]=useState(''),[passwordConfigured,setPasswordConfigured]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{community('email-settings').then(d=>{setSettings({...defaults,...d.settings});setPasswordConfigured(d.passwordConfigured);setReady(true);}).catch(e=>setError(e.message));},[]);
 function field<K extends keyof typeof defaults>(key:K,value:typeof defaults[K]){setSettings(s=>({...s,[key]:value}));setDirty(true);}
 async function save(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{const d=await community('email-settings',{...settings,smtp_password:password});setPassword('');setPasswordConfigured(true);setDirty(false);setMessage(d.message);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function test(){
  setBusy(true);setError('');setMessage('');
  try{const d=await community('email-settings',{action:'test'});setMessage(d.message);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section><h2>Email SMTP settings</h2><p>Configure email delivery for signup OTPs and password resets. Only Super Admin can access these settings.</p>
  {error&&<p role="alert" className="cs-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {ready&&<><form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
   <label>SMTP host<input required maxLength={253} value={settings.smtp_host} onChange={e=>field('smtp_host',e.target.value)} placeholder="smtp.gmail.com" autoComplete="off" aria-describedby="smtp-host-help"/></label>
   <small id="smtp-host-help">Enter your mail server hostname, not your email address. For Gmail: smtp.gmail.com, port 587 with STARTTLS, or port 465 with SSL/TLS.</small>
   <label>SMTP port<input type="number" required min={1} max={65535} value={settings.smtp_port} onChange={e=>field('smtp_port',Number(e.target.value))}/></label>
   <label>Connection security<select aria-label="Connection security" value={settings.smtp_security} onChange={e=>field('smtp_security',e.target.value)}><option value="starttls">STARTTLS (usually port 587)</option><option value="tls">SSL/TLS (usually port 465)</option></select></label>
   <label>SMTP username<input required maxLength={254} value={settings.smtp_username} onChange={e=>field('smtp_username',e.target.value)} autoComplete="off"/></label>
   <label>SMTP password<input type="password" required={!passwordConfigured} maxLength={1024} value={password} onChange={e=>{setPassword(e.target.value);setDirty(true);}} autoComplete="new-password" placeholder={passwordConfigured?'Leave blank to keep the saved password':''}/></label>
   <small>{passwordConfigured?'A password is saved.':'Enter your SMTP password or provider app password.'} For Gmail, use a Google App Password. Re-enter the password when changing the SMTP connection or username.</small>
   <label>Sender email<input type="email" required maxLength={254} value={settings.sender} onChange={e=>field('sender',e.target.value)} placeholder="accounts@yourdomain.com"/></label>
   <small>Use a sender address allowed by your mail provider.</small>
   <label>Website URL<input type="url" required value={settings.site_url} onChange={e=>field('site_url',e.target.value)} placeholder="https://your-website.com"/></label>
   <small>Use your deployed HTTPS address, or http://localhost:3000 for local development.</small>
   <button className="cs-primary" disabled={busy}>Save SMTP settings</button>
  </fieldset></form>
  <button className="cs-primary" disabled={busy||dirty||!passwordConfigured} onClick={()=>void test()}>Send test email</button>
  <p>{dirty?'Save changes before sending a test. ':''}The test is sent only to your signed-in Super Admin email. Saved passwords are encrypted and never displayed.</p>
  </>}
 </section>;
}

