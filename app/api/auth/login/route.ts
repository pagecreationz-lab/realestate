import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '@/server/config/env';
import { getSupabaseAdmin } from '@/server/config/supabase';
import { apiErrorResponse, type UserRole } from '@/server/lib/api';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  portal: z.enum(['user', 'broker', 'admin']),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const { data: user, error } = await getSupabaseAdmin()
      .from('users')
      .select('id, name, email, password_hash, roles, status')
      .eq('email', input.email.toLowerCase())
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return Response.json({ message: 'Email or password is incorrect' }, { status: 401 });
    }

    const roles = user.roles as UserRole[];
    if (!roles.includes(input.portal)) {
      return Response.json(
        { message: 'This account cannot access the selected portal' },
        { status: 403 },
      );
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, roles },
      env.jwtSecret,
      { expiresIn: '12h' },
    );

    return Response.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, roles },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
