# EASE HOME

Social property creator portal built with React, Vite 8.2.2, Supabase, and Vercel Functions. Photos and videos are private until reviewed by a super admin. The app includes DMs, social engagement, creator wallets and manual bank-withdrawal processing.

Follow [CREATOR_PLATFORM_SETUP.md](./CREATOR_PLATFORM_SETUP.md) to enable the database, private media and wallet features.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```powershell
cd D:\Realestate\ease-home-portal
npm install
npm run dev
```

Open `http://localhost:3000`. The command starts both the Vite frontend and the local API server. If port 3000 is already occupied, stop the older development server first.

Create `.env.local` with:

```dotenv
SUPABASE_URL=your-project-url
SUPABASE_SECRET_KEY=your-secret-key
JWT_SECRET=use-a-long-random-secret
```

## Checks

```powershell
npm run api:check
npm run lint
npm run build
npm start
```

## Deploy to Vercel

Import this folder as a Vercel project. The included `vercel.json` selects Vite, builds to `dist`, preserves SPA routes, and deploys the TypeScript files in `api` as Vercel Functions.

Add these environment variables to Production, Preview, and Development in Vercel:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `JWT_SECRET`
- `BANK_DETAILS_KEY` (64 hexadecimal characters, required for encrypted withdrawal details)

Then redeploy. Do not expose `SUPABASE_SECRET_KEY` through a `VITE_`-prefixed variable.
