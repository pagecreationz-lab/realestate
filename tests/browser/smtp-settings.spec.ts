import {test,expect} from '@playwright/test';

test('Super Admin configures SMTP and tests only saved settings',async({page})=>{
 const user={id:'admin-test',name:'Admin',email:'admin@example.test',mobile:'',roles:['admin']};
 await page.addInitScript(user=>localStorage.setItem('ease-home-session',JSON.stringify({token:'test',user,role:'admin'})),user);
 let saved:Record<string,unknown>|undefined,tested=false;
 await page.route('**/api/community?*',async route=>{
  const resource=new URL(route.request().url()).searchParams.get('resource');
  if(resource==='me'||resource==='account')return route.fulfill({json:{user}});
  if(resource==='email-settings'){
   if(route.request().method()==='GET')return route.fulfill({json:{settings:{sender:'',site_url:'',smtp_host:'',smtp_port:587,smtp_security:'starttls',smtp_username:''},passwordConfigured:false}});
   const body=route.request().postDataJSON();
   if(body.action==='test'){tested=true;return route.fulfill({json:{message:'Test email sent to your admin email address.'}});}
   saved=body;return route.fulfill({json:{message:'SMTP configuration saved.'}});
  }
  return route.fulfill({json:{posts:[]}});
 });
 await page.goto('/portal/admin');await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Email SMTP settings'})).toBeVisible();
 const testButton=page.getByRole('button',{name:'Send test email',exact:true});await expect(testButton).toBeDisabled();
 await page.getByLabel('SMTP host',{exact:true}).fill('smtp.example.test');
 await page.getByLabel('SMTP port',{exact:true}).fill('465');
 await page.getByLabel('Connection security',{exact:true}).selectOption('tls');
 await page.getByLabel('SMTP username',{exact:true}).fill('mail@example.test');
 await page.getByLabel('SMTP password',{exact:true}).fill('app-password');
 await page.getByLabel('Sender email',{exact:true}).fill('mail@example.test');
 await page.getByLabel('Website URL',{exact:true}).fill('https://example.test');
 await page.getByRole('button',{name:'Save SMTP settings',exact:true}).click();
 await expect(page.getByText('SMTP configuration saved.',{exact:true})).toBeVisible();
 expect(saved).toEqual({sender:'mail@example.test',site_url:'https://example.test',smtp_host:'smtp.example.test',smtp_port:465,smtp_security:'tls',smtp_username:'mail@example.test',smtp_password:'app-password'});
 await expect(page.getByLabel('SMTP password',{exact:true})).toHaveValue('');
 await testButton.click();await expect(page.getByText('Test email sent to your admin email address.',{exact:true})).toBeVisible();expect(tested).toBe(true);
 await page.getByLabel('SMTP host',{exact:true}).fill('other.example.test');await expect(testButton).toBeDisabled();
});
