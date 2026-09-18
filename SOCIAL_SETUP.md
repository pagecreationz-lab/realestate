# Social discovery and hosted property videos

Run `npm install` and `npm run dev` to start the frontend and API together.

Apply `supabase/migrations/202609160001_social_reactions.sql` in the Supabase SQL editor before using likes and saved properties. This table is accessible only through the authenticated backend. Existing listing, enquiry, and user tables are reused.

Set `VIMEO_ACCESS_TOKEN` in `.env.local` and Vercel environment variables to enable uploads. Use a Vimeo application with upload access and the required video creation permissions. Files upload directly from the browser to the upload URL issued by the server; the account token never reaches the browser. The form accepts MP4, MOV, and WebM files up to 500 MB. Vimeo account quota, privacy options, and processing time apply. Existing Vimeo and YouTube links can also be embedded without an upload token.

New owner and broker listings are submitted as pending. Approval uses the existing authenticated admin moderation API. The legacy admin dashboard still contains demonstration metrics and its demonstration moderation queue; it is not yet connected to real pending listings.

Current functionality: public listing feed, Buy/Rent and text filters, video-only feed, property details, authenticated likes/saves, native sharing/copy link, owner/broker posting wizard, own-listing workspace, enquiries and hosted video uploads. Demo properties appear only when the public API cannot load, are marked as samples, and cannot be saved or enquired about.

Remaining rollout work: apply the migration, configure and test Vimeo with the account owner, replace the legacy admin demonstration queue with live moderation, add photo file uploads (currently HTTPS photo URLs), and build dedicated buyer requirements, tenant applications, dealer lead management, and video comments. This is not a complete replication of another property's portal.
