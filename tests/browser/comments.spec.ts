import {test,expect} from '@playwright/test';
test('comment count updates after posting and persists when reopened and refreshed',async({page})=>{
 const user={id:'owner',name:'Owner',email:'owner@example.test',roles:['user']};
 const comments=[{id:'first',name:'Neighbour',body:'Is this available?',created_at:new Date().toISOString()}];
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('**/api/community?*',async route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  const body=route.request().postDataJSON();
  if(body?.action==='comment'){comments.unshift({id:'second',name:'Owner',body:body.body,created_at:new Date().toISOString()});return route.fulfill({json:{ok:true}});}
  if(resource==='me')return route.fulfill({json:{user}});
  if(resource==='comments')return route.fulfill({json:{comments,total:comments.length}});
  await route.fulfill({json:{posts:[{id:'post',author_id:'owner',author:'Owner',caption:'Property description',location:'Chennai',intent:'Sell',price:100,status:'approved',created_at:new Date().toISOString(),hasPhone:false,liked:false,saved:false,counts:{view:0,like:0,share:0,save:0,comment:comments.length},media:[]}]}});
 });
 await page.goto('/portal/user');
 const button=page.getByRole('button',{name:'Comment on post',exact:true});
 await expect(button).toHaveText('1 Comment');
 await expect(page.getByText('Is this available?',{exact:true})).toHaveCount(0);
 await button.click();
 await expect(page.getByText('Is this available?',{exact:true})).toBeVisible();
 await page.getByLabel('Add a comment').fill('Yes, it is available.');
 await page.getByRole('button',{name:'Post comment',exact:true}).click();
 await expect(button).toHaveText('2 Comments');
 await expect(page.getByText('Yes, it is available.',{exact:true})).toBeVisible();
 await button.click();
 await expect(page.getByText('Yes, it is available.',{exact:true})).toHaveCount(0);
 await button.click();
 await expect(page.getByText('Yes, it is available.',{exact:true})).toBeVisible();
 await page.reload();
 await expect(button).toHaveText('2 Comments');
 await button.click();
 await expect(page.getByText('Yes, it is available.',{exact:true})).toBeVisible();
});
