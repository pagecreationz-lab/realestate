# EASE HOME Google Drive media storage

New user, broker, dealer and builder photos/videos are stored in one Google Drive account. Super Admin connects this account once. The app creates a private `EASE HOME Uploads` folder, then `Uploader <account UUID>` folders for each uploader. Existing Supabase media remains readable; this change does not copy or delete existing files. Super Admin carousel media remains on its existing storage.

## Setup

1. Apply `supabase/migrations/202610020001_google_drive.sql` to the same Supabase project as the app. It adds private connection, OAuth state and uploader-folder tables. Existing creator tables and the owner-post migrations must already be present.
2. In a Google Cloud project, enable Google Drive API and configure the OAuth consent screen. Create a Web application OAuth client. Add the exact callback URL: `https://YOUR-SITE/api/drive-callback`, or `http://localhost:3000/api/drive-callback` for local development.
3. Set server environment variables `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REDIRECT_URI`. Do not prefix them with `VITE_`. Keep `JWT_SECRET` stable; it encrypts the saved refresh token. Restart/redeploy.
4. Sign in as Super Admin → Settings → Google Drive media storage → Connect EASE HOME Google Drive. Choose the EASE HOME Google account and grant permission. Return to Settings to see the connected account and folder. If the OAuth application is in Testing, add the EASE HOME account as a test user. Google may expire testing-mode refresh tokens; configure an appropriate production consent status before relying on ongoing uploads.
5. Create a small photo post and video post from each account category, review as Super Admin, and check playback in the feed. Check the corresponding uploader folders in Drive. These live checks require Google consent and are not performed by mocked automated tests.

## Access and upload behavior

- Only Super Admin can start a connection or read connection status. The OAuth flow uses a signed, ten-minute state, a browser-bound HttpOnly cookie, and a single-use database nonce. Callback checks the admin is still active and authorized.
- The narrow `drive.file` scope permits the app to manage its own files. The app never makes folders or files public and never exposes Google access or refresh tokens to uploaders.
- The server gives the uploader a one-file resumable upload URL. The browser sends file bytes directly to Google, keeping 50 MB uploads out of Vercel request bodies. Treat these temporary upload URLs as secrets.
- Server verification checks Drive MIME type, completed size, uploader and media ID before allowing post submission or image replacement. Existing 8-file, 50 MB/file limits and upload rate limits still apply.
- Media playback uses five-minute signed application URLs and streamed Drive downloads, with byte-range support for seeking. The app checks post status, deletion and edit version on each request. Pending media links are issued only to owners or admins. Refresh the feed if a link expires.
- Reconnect the same Google account if authorization is revoked. Switching accounts is rejected to avoid orphaning existing media. Do not move, trash or publicly share the app's folders. Rotating JWT_SECRET requires reconnecting Drive.
- Soft-deleting a post removes it from the app but retains its Drive files for the existing private audit/review workflow. Orphaned/cancelled uploads are not automatically purged.
- Available Drive space and API/download quotas belong to the connected EASE HOME account. Drive is not a video CDN; load-test production traffic and hosting streaming limits before a high-volume rollout. Google Drive credentials alone do not replace database access or migrations.

References: [Google upload sessions](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Drive file scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [OAuth web-server setup](https://developers.google.com/identity/protocols/oauth2/web-server).
