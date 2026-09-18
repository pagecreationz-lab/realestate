# Deploy EASE HOME to Vercel with Supabase

## 1. Create the Supabase database

Create a project at <https://supabase.com/dashboard>. From this project folder,
apply the included versioned migration:

```powershell
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The schema is stored in
`supabase/migrations/202609060001_initial_schema.sql`. It creates the users,
properties, enquiries, and site-visits tables, enables Row Level Security, and
allows data access only through the trusted server API.

## 2. Configure Vercel environment variables

In the Vercel project, open **Settings → Environment Variables** and add these
values for Production, Preview, and Development as appropriate:

```text
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_<your-server-secret>
JWT_SECRET=<a-long-random-secret>
```

Find the project URL and secret key under **Supabase → Project Settings → API**.
Use the new `sb_secret_...` key when available. The legacy service-role key is
also accepted as `SUPABASE_SERVICE_ROLE_KEY`. Never prefix either secret with
`NEXT_PUBLIC_` or expose it in browser code.

## 3. Seed the demo accounts once

Copy `.env.example` to `.env.local`, add the Supabase values and `JWT_SECRET`,
then seed the three demo portal accounts:

```powershell
npm run api:seed
```

## 4. Deploy

Push the project to GitHub and import the repository at <https://vercel.com/new>.
Vercel detects the included Vite 8.2.2 and `vercel.json` configuration. Deploy from
the dashboard, or use the CLI:

```powershell
npx vercel
npx vercel --prod
```

The Vite website and Vercel Functions share one origin. The API is available
under `/api/*`, including `/api/health`, `/api/auth/login`, and `/api/properties`.
The Supabase secret is read only by these server-side functions.
