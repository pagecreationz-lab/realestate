import {test,expect} from '@playwright/test';
for(const category of ['customer','broker','dealer','builder'])test('sign up as '+category,async({page})=>{
 let submitted:Record<string,unknown>|undefined;
 await page.route('**/api/community?resource=signup',async route=>{submitted=route.request().postDataJSON();await route.fulfill({status:201,json:{message:'Account created. Sign in to continue.',portal:category==='customer'?'user':'broker'}});});
 await page.goto('/signup');await page.getByLabel('Account type',{exact:true}).selectOption(category);
 await expect(page.getByRole('option',{name:'Super admin'})).toHaveCount(0);
 await page.getByLabel('Full name',{exact:true}).fill('New Person');await page.getByLabel('Email address',{exact:true}).fill('new@example.test');await page.getByLabel('Mobile number',{exact:true}).fill('9876543210');
 if(category!=='customer')await page.getByLabel('Business name',{exact:true}).fill('New Business');
 await page.getByLabel('Password',{exact:true}).fill('long-enough-password');await page.getByLabel('Confirm password',{exact:true}).fill('different-password');await page.getByRole('button',{name:'Sign up',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');expect(submitted).toBeUndefined();
 await page.getByLabel('Confirm password',{exact:true}).fill('long-enough-password');await page.getByRole('button',{name:'Sign up',exact:true}).click();await expect(page.getByRole('status')).toContainText('Account created');expect(submitted?.category).toBe(category);
 await page.getByRole('link',{name:'Verify email / resend OTP'}).click();
 await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('new@example.test');
 await page.route('**/api/community?resource=email-verification',async route=>{expect(route.request().postDataJSON()).toEqual({action:'verify',email:'new@example.test',otp:'012345'});await route.fulfill({json:{message:'Email verified. You can now sign in.'}});});
 await page.getByLabel('Email OTP',{exact:true}).fill('012345');await page.getByRole('button',{name:'Verify email',exact:true}).click();
 await page.getByRole('link',{name:'Continue to sign in'}).click();await expect(page).toHaveURL('/signin/'+(category==='customer'?'user':'broker'));await expect(page.getByRole('heading',{name:'Sign in to EASE HOME'})).toBeVisible();
});

