import {test,expect} from '@playwright/test';
for(const role of ['guest','user','admin'])test('carousel and bottom logout for '+role,async({page})=>{
 const user={id:'account',name:'Account',email:'account@example.test',roles:[role]};
 if(role!=='guest')await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('**/api/community?*',async route=>{const resource=new URL(route.request().url()).searchParams.get('resource');await route.fulfill({json:resource==='me'?{user}:resource==='hero-slides'||resource==='admin-slides'?{slides:[{id:'1',title:'First highlight',description:'Find a place',image_url:'',link_url:'/',button_text:'Explore',active:true,sort_order:0},{id:'2',title:'Second highlight',description:'Meet creators',image_url:'',link_url:'/',button_text:'Explore',active:true,sort_order:1}]}:{posts:[]}});});
 await page.goto(role==='admin'?'/portal/admin':'/');
 if(role==='admin'){
  await page.getByRole('button',{name:'For you',exact:true}).click();await expect(page.getByRole('region',{name:'Featured highlights'})).toHaveCount(0);
  await page.getByRole('button',{name:'Hero carousel',exact:true}).click();await expect(page.getByRole('heading',{name:'Hero carousel',exact:true})).toBeVisible();
 }else{await expect(page.getByRole('heading',{name:'First highlight'})).toBeVisible();await expect(page.getByRole('button',{name:'Next slide'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Pause slideshow'})).toHaveCount(0);const hero=await page.getByRole('region',{name:'Featured highlights'}).boundingBox();expect(hero!.width).toBe(page.viewportSize()!.width);const content=await page.locator('.cs-shell').boundingBox();expect(content!.y).toBeGreaterThanOrEqual(hero!.y+hero!.height);}
 if(role!=='guest'){await expect(page.locator('.cs-nav nav button').last()).toHaveText('Logout');await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible();}
});
