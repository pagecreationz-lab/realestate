import {test,expect} from '@playwright/test';
test('admin removes slide media without deleting slide',async({page})=>{
 const user={id:'admin',name:'Admin',roles:['admin'],email:'admin@example.test'};
 const slide={id:'slide',title:'Featured home',description:'A place to belong',image_url:'https://media.example.test/photo.png',media_type:'image',link_url:'/',button_text:'Explore',sort_order:0,active:true};
 let saved:Record<string,unknown>|undefined;
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user})),user);
 await page.route('https://media.example.test/**',r=>r.fulfill({body:''}));
 await page.route('**/api/community?*',async route=>{const body=route.request().postDataJSON();if(body){saved=body;return route.fulfill({json:{ok:true}});}const resource=new URL(route.request().url()).searchParams.get('resource');await route.fulfill({json:resource==='me'?{user}:resource==='admin-slides'?{slides:[slide]}:{posts:[]}});});
 await page.goto('/portal/admin');await expect(page.getByRole('button',{name:'Open account settings'})).toBeVisible();
 await page.getByRole('button',{name:'Hero carousel',exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByRole('button',{name:'Remove image/video',exact:true}).click();
 await expect(page.getByAltText('Slide preview')).toHaveCount(0);expect(saved).toBeUndefined();
 await page.getByRole('button',{name:'Save slide',exact:true}).click();
 await expect.poll(()=>saved?.image_url).toBe('');expect(saved?.id).toBe('slide');expect(saved?.title).toBe('Featured home');expect(saved?.operation).not.toBe('delete');
});
