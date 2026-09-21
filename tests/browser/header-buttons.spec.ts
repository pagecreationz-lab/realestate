import {test,expect} from '@playwright/test';
for(const width of [320,390,1440])test(`header actions align at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/community?*',route=>route.fulfill({json:{posts:[],slides:[]}}));
 await page.goto('/');
 const create=page.locator('.cs-top-actions').getByRole('button',{name:'Create post'});
 const login=page.locator('.cs-top-actions .cs-auth-entry');
 await expect(create).toBeVisible();await expect(login).toBeVisible();
 const a=(await create.boundingBox())!,b=(await login.boundingBox())!;
 expect(a.height).toBe(44);expect(b.height).toBe(44);expect(a.y).toBe(b.y);
 expect(b.x+b.width).toBeLessThanOrEqual(width);
 expect(await create.evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');
});
