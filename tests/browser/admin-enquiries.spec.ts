import {test,expect} from '@playwright/test';
test('admin messages displays contact enquiries separately from chats',async({page})=>{
 const user={id:'admin',name:'Admin',email:'admin@example.test',roles:['admin']};
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('**/api/community?*',async route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  await route.fulfill({json:resource==='me'?{user}:resource==='contact-enquiries'?{total:1,enquiries:[{id:'enquiry',post_id:'property',name:'Test Buyer',mobile:'9876543210',role:'buyer',home_loan:true,site_visit:true,created_at:new Date().toISOString(),property:{caption:'City apartment',location:'Chennai',status:'approved'}}]}:resource==='threads'?{threads:[]}:{posts:[]}});
 });
 await page.goto('/portal/admin');await page.getByRole('button',{name:'Message Notifications',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Test Buyer · buyer'})).toBeVisible();
 await expect(page.getByRole('link',{name:'9876543210'})).toHaveAttribute('href','tel:9876543210');
 await expect(page.getByText('Home loan: Requested · Site visit: Requested')).toBeVisible();
 await page.getByRole('button',{name:'Private chats',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your conversations'})).toBeVisible();
});
