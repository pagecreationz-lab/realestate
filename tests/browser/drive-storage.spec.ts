import {test,expect} from '@playwright/test';

for(const role of ['user','broker','admin'])test(role+' Drive settings visibility',async({page})=>{
 const user={id:'person',name:'Test Person',email:'person@example.test',roles:[role]};
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('**/api/community?*',route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  return route.fulfill({json:resource==='me'||resource==='account'?{user}:resource==='drive-settings'?{connected:true,accountEmail:'easehome@example.test',folderUrl:'https://drive.google.com/drive/folders/root',oauthConfigured:true}:resource==='email-settings'?{settings:{},passwordConfigured:false}:{posts:[]}});
 });
 await page.goto('/portal/'+role);await page.getByRole('button',{name:'Settings',exact:true}).click();
 if(role==='admin'){
  await expect(page.getByRole('heading',{name:'Google Drive media storage'})).toBeVisible();
  await expect(page.getByText('Connected account: easehome@example.test')).toBeVisible();
  await expect(page.getByRole('button',{name:'Reconnect EASE HOME Google Drive'})).toBeEnabled();
 }else await expect(page.getByRole('heading',{name:'Google Drive media storage'})).toHaveCount(0);
});

test('post uploads use the Drive ticket headers and submit only after upload',async({page})=>{
 const user={id:'person',name:'Test Person',roles:['user']};let uploaded=false,submitted=false;
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('https://www.googleapis.com/upload/**',async route=>{
  expect(route.request().method()).toBe('PUT');expect(route.request().headers()['x-upsert']).toBeUndefined();expect(route.request().headers().authorization).toBeUndefined();uploaded=true;await route.fulfill({status:200,json:{id:'drive-file'}});
 });
 await page.route('**/api/community?*',async route=>{
  const body=route.request().postDataJSON();
  if(body?.action==='upload')return route.fulfill({json:{id:'media-id',url:'https://www.googleapis.com/upload/drive/v3/files?upload_id=session',headers:{'Content-Type':'image/png'}}});
  if(body?.action==='post'){expect(uploaded).toBe(true);expect(body.media).toEqual(['media-id']);submitted=true;return route.fulfill({json:{id:'post',status:'pending'}});}
  return route.fulfill({json:new URL(route.request().url()).searchParams.get('resource')==='me'?{user}:{posts:[]}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Open account settings'}).waitFor();
 await page.getByRole('button',{name:'Create post',exact:true}).click();
 await page.getByLabel('Select photos or videos').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('test image')});
 await page.getByLabel('Tell the story',{exact:true}).fill('A property photo for review');
 await page.getByLabel('Location / service area',{exact:true}).fill('Chennai');
 await page.getByLabel('Asking price (₹)',{exact:true}).fill('100');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Send for approval'}).click();
 await expect(page.getByRole('dialog',{name:'Create a property post'})).toHaveCount(0);expect(submitted).toBe(true);
});

