import {test,expect} from '@playwright/test';
test('public business network filters and displays service posts',async({page})=>{
 const queries:URL[]=[];
 await page.route('**/api/community?*',async route=>{
  queries.push(new URL(route.request().url()));
  await route.fulfill({json:{posts:[{id:'service',author_id:'provider',author:'Local Painter',post_type:'service',service_category:'Painting',caption:'Home painting services',location:'Chennai',intent:'Sell',price:0,status:'approved',created_at:new Date().toISOString(),hasPhone:true,liked:false,saved:false,counts:{view:0,like:0,share:0,save:0},media:[]}]}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Business network',exact:true}).click();
 await page.getByLabel('Service category',{exact:true}).selectOption('Painting');
 await expect.poll(()=>queries.some(u=>u.searchParams.get('postType')==='service'&&u.searchParams.get('serviceCategory')==='Painting')).toBe(true);
 await expect(page.getByText('Painting SERVICES',{exact:true})).toBeVisible();
 await expect(page.getByText('Request a quote',{exact:true})).toBeVisible();
 await expect(page.getByText('SPACE FOR SALE',{exact:true})).toHaveCount(0);
});
test('signed-in creator can compose a business service',async({page})=>{
 const user={id:'provider',name:'Local Painter',email:'painter@example.test',roles:['user']};
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('**/api/community?*',async route=>route.fulfill({json:new URL(route.request().url()).searchParams.get('resource')==='me'?{user}:{posts:[]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'Open account settings'})).toBeVisible();
 await page.getByRole('button',{name:'Create post',exact:true}).click();
 await page.getByLabel('Post type',{exact:true}).selectOption('service');
 await page.getByLabel('Service category',{exact:true}).selectOption('Plumbing');
 await expect(page.getByLabel('Starting price (₹, enter 0 for quote)',{exact:true})).toBeVisible();
 await expect(page.getByLabel("I'm posting to",{exact:true})).toHaveCount(0);
});
