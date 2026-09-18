import {test,expect} from '@playwright/test';
test('owner edits and confirms deletion; settings is last',async({page})=>{
 const user={id:'owner',name:'Owner',email:'owner@example.test',roles:['user']};let deleted=false;const actions:Record<string,unknown>[]=[];
 const post={id:'post',author_id:'owner',author:'Owner',caption:'Original property description',location:'Chennai',intent:'Sell',price:100,status:'approved',created_at:new Date().toISOString(),hasPhone:true,phone:'9876543210',edit_version:0,liked:false,saved:false,counts:{view:0,like:0,share:0,save:0},media:[]};
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('https://upload.example.test/**',route=>route.fulfill({status:200,body:''}));
 await page.route('**/api/community?*',async route=>{
  const body=route.request().postDataJSON();if(body?.action==='upload')return route.fulfill({json:{id:'replacement-photo',url:'https://upload.example.test/photo'}});if(body){actions.push(body);if(body.operation==='delete')deleted=true;return route.fulfill({json:{ok:true}});}
  await route.fulfill({json:new URL(route.request().url()).searchParams.get('resource')==='me'?{user}:{posts:deleted?[]:[post]}});
 });
 await page.goto('/portal/user');await expect(page.getByRole('button',{name:'Open account settings'})).toBeVisible();
 await expect(page.locator('.cs-nav nav button:not(.cs-menu-logout)').last()).toHaveText('Settings');
 await page.getByRole('button',{name:'My posts',exact:true}).click();await page.getByRole('button',{name:'Edit post',exact:true}).click();
 await page.getByLabel('Description',{exact:true}).fill('Updated property description');
 await page.getByLabel('Replace post images').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from('mock image')});
 await page.getByRole('button',{name:'Save and request approval',exact:true}).click();
 await expect.poll(()=>actions.length).toBe(1);expect(actions[0].operation).toBe('edit');
 expect(actions[0].media).toEqual(['replacement-photo']);
 await page.getByRole('button',{name:'Delete post',exact:true}).click();await page.getByLabel('Reason for deleting').fill('No longer available');
 await page.getByRole('button',{name:'Confirm deletion',exact:true}).click();
 await expect(page.getByRole('button',{name:'Delete post',exact:true})).toHaveCount(0);expect(actions[1].operation).toBe('delete');
});
