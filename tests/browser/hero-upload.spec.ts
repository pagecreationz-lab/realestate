import {test,expect} from '@playwright/test';
for(const kind of ['image','video'])test('admin uploads hero '+kind+' and saves media type',async({page})=>{
 const user={id:'admin',name:'Admin',email:'admin@example.test',roles:['admin']};let saved:Record<string,unknown>|undefined;
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('https://media.example.test/**',route=>route.fulfill({status:200,body:''}));
 await page.route('**/api/community?*',async route=>{
  const body=route.request().postDataJSON();
  if(body?.operation==='upload')return route.fulfill({json:{uploadUrl:'https://media.example.test/upload',publicUrl:'https://media.example.test/banner',mediaType:kind}});
  if(body?.action==='hero-slide'){saved=body;return route.fulfill({json:{ok:true}});}
  const resource=new URL(route.request().url()).searchParams.get('resource');
  await route.fulfill({json:resource==='me'?{user}:resource==='admin-slides'?{slides:[]}:{posts:[]}});
 });
 await page.goto('/portal/admin');await expect(page.getByRole('button',{name:'Open account settings'})).toBeVisible();
 await page.getByRole('button',{name:'Hero carousel',exact:true}).click();
 await page.getByLabel('Upload hero image or video').setInputFiles({name:kind==='video'?'hero.mp4':'hero.png',mimeType:kind==='video'?'video/mp4':'image/png',buffer:Buffer.from('mock-media')});
 await expect(page.getByRole('status')).toHaveText('Media uploaded. Save the slide to publish it.');
 await page.getByLabel('Title',{exact:true}).fill('Featured homes');
 await page.getByRole('button',{name:'Save slide',exact:true}).click();
 await expect.poll(()=>saved?.media_type).toBe(kind);expect(saved?.image_url).toBe('https://media.example.test/banner');
});
