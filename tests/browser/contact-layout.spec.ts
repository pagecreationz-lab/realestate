import {test,expect} from '@playwright/test';
for(const width of [390,1440])test('contact form layout and submission at '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const user={id:'viewer',name:'Test Viewer',email:'test@example.test',roles:['user']};
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('**/api/community?*',async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();expect(body.role).toBe('buyer');expect(body.mobile).toBe('9876543210');expect(body.siteVisit).toBe(true);
   return route.fulfill({json:{phone:'+919999999999'}});
  }
  const resource=new URL(route.request().url()).searchParams.get('resource');
  await route.fulfill({json:resource==='me'?{user}:{posts:[{id:'post',author_id:'owner',author:'Owner',caption:'Property',location:'Chennai',intent:'Sell',price:100,status:'approved',created_at:new Date().toISOString(),hasPhone:true,liked:false,saved:false,counts:{view:0,like:0,share:0,save:0},media:[]}]}});
 });
 await page.goto('/');await page.getByRole('button',{name:'View number',exact:true}).click();
 const section=page.getByRole('dialog',{name:'View property contact number'});
 await expect(section).toBeVisible();
 await page.getByRole('button',{name:'Close view number',exact:true}).click();
 await expect(section).toHaveCount(0);
 await page.getByRole('button',{name:'View number',exact:true}).click();
 await page.keyboard.press('Escape');await expect(section).toHaveCount(0);
 await page.getByRole('button',{name:'View number',exact:true}).click();
 const radio=page.getByRole('radio',{name:'Buyer',exact:true});await radio.check();
 const box=await radio.boundingBox();expect(box!.width).toBeLessThanOrEqual(20);
 const label=await radio.locator('..').boundingBox();expect(box!.x-label!.x).toBeLessThan(3);
 expect(await section.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.getByLabel('Mobile number',{exact:true}).fill('9876543210');
 await page.getByRole('checkbox',{name:'Request a site visit'}).check();
 await section.screenshot({path:`test-results/contact-form-${width}.png`});
 await page.getByRole('button',{name:'Submit and view number'}).click();
 await expect(page.getByRole('link',{name:'+919999999999'})).toBeVisible();
});
