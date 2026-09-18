import {test,expect} from '@playwright/test';
for(const category of ['broker','dealer','admin'])test('package access for '+category,async({page})=>{
 const user={id:'account',name:'Account',email:'account@example.test',roles:[category==='admin'?'admin':'broker'],account_category:category};
 const plans=[1,2,3].map(id=>({id,name:'Plan '+id,description:'For professionals',price_paise:null,duration_days:30,features:['Property promotion']}));let saved=false;
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('**/api/community?*',async route=>{
  const body=route.request().postDataJSON();if(body?.action==='save-package'){saved=true;return route.fulfill({json:{ok:true}});}
  const r=new URL(route.request().url()).searchParams.get('resource');await route.fulfill({json:r==='me'?{user}:r==='packages'?{packages:plans}:r==='hero-slides'?{slides:[]}:{posts:[]}});
 });
 await page.goto('/portal/'+(category==='admin'?'admin':'broker'));await expect(page.getByRole('button',{name:'Open account settings'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Featured highlights'})).toHaveCount(0);
 if(category!=='admin'){const names=await page.locator('.cs-nav nav button').allTextContents();expect(names.indexOf('Packages')+1).toBe(names.indexOf('Wallet'));}
 await page.getByRole('button',{name:'Packages',exact:true}).click();await expect(page.locator('.cs-package-grid article')).toHaveCount(3);
 if(category==='admin'){await page.getByRole('button',{name:'Edit Plan 1',exact:true}).click();await page.getByLabel('Plan name',{exact:true}).fill('Starter');await page.getByRole('button',{name:'Save package',exact:true}).click();await expect.poll(()=>saved).toBe(true);}
 else await expect(page.getByRole('button',{name:'Edit Plan 1',exact:true})).toHaveCount(0);
});
