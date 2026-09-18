import {test,expect} from '@playwright/test';
for(const role of ['user','broker','admin'])test(role+' account settings and logout',async({page})=>{
 const user={id:'test-user',name:'Test Person',email:'person@example.test',mobile:'9876543210',roles:[role]};
 await page.addInitScript(({user,role})=>{if(!sessionStorage.getItem('test-seeded')){localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user,role}));sessionStorage.setItem('test-seeded','yes');}},{user,role});
 await page.route('**/api/community?*',async route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  const body=route.request().postDataJSON();
  if(body?.action==='update-profile'){expect(body.name).toBe('Updated Person');return route.fulfill({json:{message:'Profile updated.'}});}
  await route.fulfill({json:resource==='me'||resource==='account'?{user}:{posts:[]}});
 });
 await page.goto('/portal/'+role);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'My profile'})).toBeVisible();
 await page.getByLabel('Name',{exact:true}).fill('Updated Person');
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Profile updated.');
 if(role==='user')await expect(page.getByRole('link',{name:'Reset password by email verification'})).toBeVisible();
 if(role==='admin')await expect(page.getByLabel('Current password',{exact:true})).toBeVisible();
 if(role==='broker')await expect(page.getByText('Reset password by email verification')).toHaveCount(0);
 await page.getByRole('button',{name:'Log out',exact:true}).click();
 await expect(page).toHaveURL(/\/login\/user/);
 expect(await page.evaluate(()=>localStorage.getItem('ease-home-session'))).toBeNull();
});
