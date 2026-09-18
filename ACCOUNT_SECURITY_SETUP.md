# Account settings setup

Run `supabase/migrations/202609200001_account_security.sql` in the Supabase SQL editor. It requires the original users table, but not the missing creator-platform migration. It preserves existing accounts and passwords.

Set these server-only environment variables in `.env.local` and Vercel:

```dotenv
RESEND_API_KEY=your-resend-api-key
RESET_EMAIL_FROM=EASE HOME <security@your-verified-domain.com>
PASSWORD_RESET_SITE_URL=http://localhost:3000
```

For production, use the public HTTPS site URL. Never prefix the API key with VITE_. Configure a verified sending domain in Resend: https://resend.com/docs/api-reference/emails/send-email

Restart `npm run dev` after changing environment variables. Existing sessions must sign in again after this update; password changes invalidate previously issued tokens across all API handlers.

- Every portal: Settings and top avatar open name/mobile editing and logout. Changing mobile clears its verification flag. Login email remains managed by the super admin.
- Customer-only accounts: Forgot password on user login or Settings sends a single-use link to the registered email. Expires in 20 minutes; resend cooldown 5 minutes. Dealer/broker/builder and admin accounts cannot use this endpoint, even if they also carry a user role.
- Super admin: Settings allows changing password after verifying the current password. Forgotten-admin-password recovery is not exposed publicly.
- Professional accounts: Profile update and logout only.

Email delivery requires working Resend credentials; no real reset emails were sent during implementation. Optional deployment-level rate limiting should also protect the public reset endpoint.
