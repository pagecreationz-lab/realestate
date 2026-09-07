import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });

export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseSecretKey:
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'change-this-secret-before-production',
};
