# Email delivery with SMTP

1. Apply the existing email-verification and OTP migrations, followed by `supabase/migrations/202610010001_smtp_settings.sql` in the app's Supabase project.
2. Keep `JWT_SECRET` configured on the server. It protects SMTP passwords at rest as well as sessions. After rotating it, re-enter the SMTP password in settings.
3. Sign in as Super Admin and open Settings → Email SMTP settings. Enter your provider's SMTP host, port, connection security, username, password (or app password), sender email, and website URL. Use STARTTLS for providers using port 587, or SSL/TLS for providers using port 465. Follow your provider's connection details. Both modes validate server certificates; unencrypted delivery is not supported.
4. Save SMTP settings, then click Send test email. The test goes only to the signed-in Super Admin's email. Use a sender address your SMTP account is allowed to send from. Save any changes before testing.
5. Sign up as User, Broker, Dealer or Builder. Enter the emailed six-digit OTP at Verify email / resend OTP, then sign in. Admin signup is unavailable.

Signup OTPs and user password-reset links share this SMTP configuration. No Resend key or separate reset-email environment variables are used. Remove obsolete RESEND_API_KEY, RESET_EMAIL_FROM and PASSWORD_RESET_SITE_URL variables from deployments when convenient.

The SMTP password is encrypted in the private settings table and is never returned to the browser. A blank password field preserves the saved password; changing the SMTP connection or username requires entering the password again. Only Super Admin (the existing `admin` role) can read or change settings or send a test. Ordinary users cannot access this endpoint.

OTPs expire after 10 minutes, permit five incorrect attempts, and can be consumed only once. Resend has a five-minute per-account cooldown. Pending users cannot log in or use authenticated APIs. Identity/business verification and post approval are separate. Password-reset links expire after 20 minutes.

Restart/redeploy after installing the SMTP dependency and deploying the code. The database migration and provider credentials must be configured before sending. Automated tests mock SMTP delivery; they do not prove live inbox delivery. Check your provider's sending limits and delivery logs if a saved test fails.

Transport reference: https://nodemailer.com/smtp
