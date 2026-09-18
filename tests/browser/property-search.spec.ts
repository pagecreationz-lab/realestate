import {test,expect} from '@playwright/test';
test('property search sends category and purpose filters to server',async({page})=>{
 const seen:URL[]=[];
 await page.route('**/api/community?*',async route=>{seen.push(new URL(route.request().url()));await route.fulfill({json:{posts:[]}});});
 await page.goto('/');
 await page.getByLabel('Search property details',{exact:true}).fill('Chennai apartment');
 await page.getByLabel('Posted by',{exact:true}).selectOption('broker');
 await page.getByLabel('Property purpose',{exact:true}).selectOption('Sell');
 await expect.poll(()=>seen.some(u=>u.searchParams.get('search')==='Chennai apartment'&&u.searchParams.get('authorType')==='broker'&&u.searchParams.get('intent')==='Sell')).toBe(true);
 await expect(page.getByRole('heading',{name:'No properties match these filters.'})).toBeVisible();
 for(const role of ['dealer','builder','admin','user']){await page.getByLabel('Posted by',{exact:true}).selectOption(role);await expect.poll(()=>seen.at(-1)?.searchParams.get('authorType')).toBe(role);}
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect.poll(()=>seen.at(-1)?.searchParams.get('search')).toBe('');
 await expect(page.getByLabel('Posted by',{exact:true})).toHaveValue('');
});
