# Activate the social creator portal

## Database

Apply `supabase/migrations/202609170001_creator_platform.sql` in the SQL editor of your existing Supabase project. It adds the creator posts, private media, engagement, conversations, messages, reviews, wallets, ledger and withdrawals tables. Existing users and the older property data are preserved; older listings are not silently republished as reviewed creator posts.

The migration also creates the private `creator-media` storage bucket (50 MB/file). All new uploads go directly to this bucket using single-object signed upload URLs. They are not publicly addressable. Only approved feed posts, the creator's own posts, or the admin review queue receive five-minute signed playback URLs. Already issued playback links can remain usable until that five-minute expiry even if a post is subsequently rejected. Upload URLs do not permit replacing an existing file. Approved content cannot be edited or silently swapped.

## Environment

Keep `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and a strong `JWT_SECRET` configured. Add `BANK_DETAILS_KEY` to `.env.local` and Vercel as a 64-character hexadecimal string generated from 32 cryptographically random bytes. Keep the same key across deployments and back it up securely: changing or losing it prevents decryption of existing bank requests. Never expose any of these secrets in `VITE_` variables.

New posts use Supabase private storage for photos and browser-playable MP4/WebM video; no Vimeo account is required for this workflow. Videos are served as uploaded, without transcoding. Upload MP4 with broadly supported H.264/AAC encoding for best browser compatibility. Storage quota and bandwidth follow your Supabase plan.

## Local commands

```powershell
cd D:\Realestate\ease-home-portal
npm install
npm run community:check
npm run dev
```

Open `http://localhost:3000`. Sign in with an existing creator or admin account. The login screen no longer advertises demo account passwords.

## What is implemented

- Social feed and Reels, multi-photo/video posts, saved posts, sharing, calls and creator workspaces.
- Every submission starts pending. Creator and admin can inspect pending media; public requests filter to approved posts. Admin must confirm they watched all media and checked for adult content before approval. This is **manual moderation**, not an AI classifier. Adult content is rejected, and approved posts can be removed through the same review workflow.
- Post details and moderation history in the super admin workspace.
- Unique signed-in viewer, like, save and share counters. Photo cards request a view after five seconds of visibility; videos require five seconds of playback. Counts represent distinct accounts, not total playback impressions; anonymous views and creator self-views/self-shares do not count. Sharing records native-share completion or copying a link, not a confirmed downstream share. These metrics are indicative and are not fraud-proof billing measurements.
- Private text DMs, scoped to the two participants, with polling every five seconds while the page is visible. Up to the newest 100 messages are shown; attachment messaging, push notifications, blocking and full-history pagination are not included.
- Admin awards a chosen amount based on reviewed engagement, with a reason and idempotency key. There are no automatic earnings promises or automatic per-view charges.
- Creator wallet ledger and encrypted bank withdrawal requests. A request atomically reserves/debits the available balance. Rejection refunds it once. Admin reveals the bank details with an audit entry, makes the transfer externally, then records its reference. Marking a request paid **does not send money**. No bank/payment provider is connected.

## Verification

```powershell
npm run api:check
npm run lint
npm run build
npm run test:community
npm run test:browser
```

The database tests run PostgreSQL locally in PGlite and verify moderation, SQL permissions, credit idempotency, insufficient funds, concurrent withdrawal requests, one-time refunds and bank encryption. The browser tests use isolated fixture responses and Microsoft Edge to verify responsive layout and user/admin interactions. They do not publish test posts, message real users, or move funds. Live storage and database checks require the migration on the configured Supabase project.

## Vercel

Deploy the existing Vite project with `npm run build`, output directory `dist`, and the included `api/community.ts` Vercel Function. Add the four server environment variables above and redeploy. No production deployment is performed by this change.
