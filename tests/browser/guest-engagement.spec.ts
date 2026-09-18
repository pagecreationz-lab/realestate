import {test,expect} from '@playwright/test';
const post='d13ab394-a253-4d73-8353-09e04f9e8c81';
for(const name of ['Like post','Comment on post','Share post','Save post','Message creator','View number'])test('guest must sign in for '+name,async({page})=>{
 let writes=0;
 await page.route('**/api/community?*',async route=>{
  if(route.request().method()==='POST')writes++;
  await route.fulfill({json:{posts:[{id:post,author_id:'other',author:'Property Creator',caption:'Approved property',location:'Chennai',intent:'Sell',price:100,status:'approved',created_at:new Date().toISOString(),hasPhone:true,liked:false,saved:false,counts:{view:0,like:0,share:0,save:0},media:[]}]}});
 });
 await page.goto('/');
 await expect(page.getByText('Approved property',{exact:false}).first()).toBeVisible();
 await page.getByRole('button',{name,exact:true}).first().click();
 await expect(page).toHaveURL('/login/user?next='+encodeURIComponent('/?post='+post));
 expect(writes).toBe(0);
});
