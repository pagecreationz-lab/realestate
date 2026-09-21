import {useEffect,useState} from 'react';
import {community} from './client';
type Status={connected:boolean;accountEmail:string;folderUrl:string;oauthConfigured:boolean};
export default function DriveSettings(){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{community('drive-settings').then(setStatus).catch(e=>setError(e.message));},[]);
 async function connect(){setBusy(true);setError('');try{const d=await community('drive-settings',{action:'connect'});window.location.assign(d.url);}catch(e){setError((e as Error).message);setBusy(false);}}
 return <section><h2>Google Drive media storage</h2><p>One EASE HOME Google account stores new photos and videos for all users, brokers, dealers and builders. Each uploader gets a separate folder.</p>
  {error&&<p className="cs-error" role="alert">{error}</p>}
  {status&&<><p>{status.connected?'Connected account: '+status.accountEmail:'Google Drive is not connected. New media uploads are unavailable until you connect it.'}</p>
   {status.folderUrl&&<p><a href={status.folderUrl} target="_blank" rel="noreferrer">Open EASE HOME Uploads in Google Drive</a></p>}
   {!status.oauthConfigured&&<p>Configure GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REDIRECT_URI on the server, then restart or redeploy.</p>}
   <button className="cs-primary" disabled={busy||!status.oauthConfigured} onClick={()=>void connect()}>{busy?'Opening Google…':status.connected?'Reconnect EASE HOME Google Drive':'Connect EASE HOME Google Drive'}</button>
   <p>Choose the EASE HOME account on Google’s consent screen. Files remain private in Drive. Existing uploads remain accessible from their original storage. Reconnect the same account to preserve media access.</p>
  </>}
 </section>;
}
