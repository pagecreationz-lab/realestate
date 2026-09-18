import {test,expect} from '@playwright/test';
const user={id:'11111111-1111-4111-8111-111111111111',name:'Arun Creator',email:'test@example.com',roles:['user']};
const post={id:'22222222-2222-4222-8222-222222222222',author_id:'33333333-3333-4333-8333-333333333333',author:'Meena Homes',caption:'Sunlit balcony mornings in this beautiful property for sale.',location:'Adyar, Chennai',intent:'Sell',price:8500000,status:'approved',created_at:'2026-09-17T08:00:00Z',hasPhone:true,liked:false,saved:false,counts:{view:104,like:18,share:7,save:4},media:[{id:'photo',mime:'image/png',url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="650"><rect width="800" height="650" fill="#bbdbea"/><path d="M130 440V240L400 90L670 240V440Z" fill="#eff7fb"/><rect x="350" y="280" width="100" height="160" fill="#619dbc"/></svg>')} ]};
test.beforeEach(async({page})=>{
 await page.addInitScript(u=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test-only',user:u,role:'user'})),user);
 await page.route('**/api/community?**',async route=>{const url=new URL(route.request().url());const resource=url.searchParams.get('resource');const body=route.request().method()==='POST'?route.request().postDataJSON():null;let data:unknown={ok:true};if(resource==='me')data={user};else if(['feed','saved','mine'].includes(resource??''))data={posts:[post]};else if(resource==='threads')data={threads:[{id:'thread-1',name:'Meena Homes'}]};else if(resource==='messages')data={messages:[{id:'message-1',sender_id:post.author_id,body:'Hello! The home is still available.',created_at:post.created_at}]};else if(resource==='wallet')data={balance:125000,ledger:[],withdrawals:[],wallets:[]};if(body?.action==='thread')data={id:'thread-1'};if(body?.action==='contact')data={phone:'+919876543210'};await route.fulfill({json:data});});
});
test('feed, reactions, messaging and wallet',async({page})=>{
 await page.goto('/');await expect(page.getByText(post.caption,{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Like post',exact:true}).click();await expect(page.getByRole('button',{name:'Like post',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Save post',exact:true}).click();await expect(page.getByRole('button',{name:'Save post',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Call creator',exact:true}).click();await expect(page.getByRole('link',{name:'+919876543210'})).toHaveAttribute('href','tel:+919876543210');
 await page.getByRole('button',{name:'Message creator',exact:true}).last().click();await expect(page.getByText('Hello! The home is still available.')).toBeVisible();
 await page.getByRole('button',{name:'Wallet',exact:true}).click();await expect(page.getByText('₹1,250.00',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create post',exact:true}).click();await expect(page.getByRole('dialog',{name:'Create a property post'})).toBeVisible();await expect(page.getByText("Reviewed before it's shared.",{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Close composer'}).click();
});
test('super admin reviews individual posts and credits a creator',async({page})=>{
 const actions:Record<string,unknown>[]=[];
 await page.route('**/api/community?**',async route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(route.request().method()==='POST'){actions.push(route.request().postDataJSON());await route.fulfill({json:{ok:true}});return;}
  if(resource==='me'){await route.fulfill({json:{user:{...user,roles:['admin']}}});return;}
  if(resource==='review'){await route.fulfill({json:{posts:[post]}});return;}
  await route.fallback();
 });
 await page.goto('/portal/admin');
 await page.getByRole('checkbox',{name:'I have reviewed every photo and the entire video.'}).check();
 await page.getByRole('checkbox',{name:'No adult content; this is a property-related post.'}).check();
 await page.getByPlaceholder('Review findings / reason').fill('All media reviewed and safe for publication.');
 await page.getByRole('button',{name:'Record decision',exact:true}).click();await expect.poll(()=>actions.some(a=>a.action==='moderate'&&a.safe===true&&a.reviewedAll===true)).toBe(true);
 await page.getByLabel('Credit amount (₹)').fill('125');await page.getByLabel('Reward reason').fill('Verified creator engagement reward');
 await page.getByRole('button',{name:'Credit wallet',exact:true}).click();await expect.poll(()=>actions.some(a=>a.action==='credit'&&a.amount===12500&&typeof a.key==='string')).toBe(true);
 await page.screenshot({path:'test-results/creator-admin.png',fullPage:true});
});
test('desktop and mobile social layout',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');await expect(page.getByText(post.caption,{exact:false})).toBeVisible();await page.screenshot({path:'test-results/creator-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Like post',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:'test-results/creator-mobile.png',fullPage:true});
});
test('media upload submits a private pending post',async({page})=>{
 const actions:Record<string,unknown>[]=[];
 await page.route('https://uploads.example.test/media',route=>route.fulfill({status:200,body:'{}'}));
 await page.route('**/api/community?**',async route=>{
  if(route.request().method()!=='POST'){await route.fallback();return;}
  const body=route.request().postDataJSON();actions.push(body);
  if(body.action==='upload'){await route.fulfill({json:{id:'44444444-4444-4444-8444-444444444444',url:'https://uploads.example.test/media'}});return;}
  if(body.action==='post'){await route.fulfill({json:{id:post.id,status:'pending'},status:201});return;}
  await route.fallback();
 });
 await page.goto('/');await expect(page.getByRole('button',{name:'Open my posts'})).toBeVisible();
 await page.getByRole('button',{name:'Create post',exact:true}).click();
 await page.getByLabel('Select photos or videos').setInputFiles({name:'property.jpg',mimeType:'image/jpeg',buffer:Buffer.from('isolated-upload-test')});
 await page.getByLabel('Tell the story').fill('A bright family property available for sale.');
 await page.getByLabel('Asking price (₹)').fill('5000000');await page.getByLabel('Neighbourhood / city').fill('Chennai');
 await page.getByRole('checkbox',{name:'I own or have permission'}).check();
 await page.getByRole('button',{name:'Send for approval'}).click();
 await expect(page.getByText('Your post is private and awaiting super admin approval.')).toBeVisible();
 expect(actions.find(a=>a.action==='post')).toMatchObject({consent:true,media:['44444444-4444-4444-8444-444444444444']});
 expect(actions.find(a=>a.action==='post')).not.toHaveProperty('status');
});
