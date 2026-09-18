import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from './config/supabase.js';

const accounts = [
  { name: 'Arun Prakash', email: 'buyer@easehome.in', password: 'User@123', roles: ['user'], accountType: 'individual' },
  { name: 'Ravi Kumar', email: 'broker@easehome.in', password: 'Broker@123', roles: ['broker'], accountType: 'business', verification: { mobile: true, identity: true, business: true, broker: true } },
  { name: 'Anita S.', email: 'admin@easehome.in', password: 'Admin@123', roles: ['admin'], accountType: 'business', verification: { mobile: true, identity: true, business: true } },
];

async function seed() {
  const supabase = getSupabaseAdmin();
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    const { error } = await supabase.from('users').upsert(
      {
        name: account.name,
        email: account.email,
        password_hash: passwordHash,
        roles: account.roles,
        account_type: account.accountType,
        verification: account.verification ?? {},
        status: 'active',
      },
      { onConflict: 'email' },
    );

    if (error) throw error;
  }
  console.log('Supabase demo users seeded');
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
