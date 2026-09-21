# Account settings setup

Run `supabase/migrations/202609200001_account_security.sql` in the Supabase SQL editor. It requires the original users table, but not the missing creator-platform migration. It preserves existing accounts and passwords.

Configure email delivery in Super Admin → Settings → Email SMTP settings. Signup OTPs and password resets share the SMTP host, port, security, credentials, sender and website URL. Apply the SMTP migration and follow [Email setup](EMAIL_VERIFICATION_SETUP.md).

Password changes invalidate previously issued sessions across all API handlers.

- Every portal: Settings and top avatar open name/mobile editing and logout. Changing mobile clears its verification flag. Login email remains managed by the super admin.
- Customer-only accounts: Forgot password on user login or Settings sends a single-use link to the registered email. Expires in 20 minutes; resend cooldown 5 minutes. Dealer/broker/builder and admin accounts cannot use this endpoint, even if they also carry a user role.
- Super admin: Settings allows changing password after verifying the current password. Forgotten-admin-password recovery is not exposed publicly.
- Professional accounts: Profile update and logout only.

Email delivery requires working SMTP credentials; no real reset emails were sent during implementation. Optional deployment-level rate limiting should also protect the public reset endpoint.


