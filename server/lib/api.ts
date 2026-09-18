import jwt from 'jsonwebtoken';
import {createHmac} from 'node:crypto';
import {getSupabaseAdmin} from '../config/supabase';
import { ZodError } from 'zod';
import { env } from '../config/env';

export type UserRole = 'user' | 'broker' | 'admin';

export type SessionUser = {
  id: string;
  email: string;
  roles: UserRole[];
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const credentialVersion=(hash:string)=>createHmac('sha256',env.jwtSecret).update(hash).digest('hex');
export async function authenticateRequest(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!env.jwtSecret || env.jwtSecret === 'change-this-secret-before-production') {
    throw new ApiError(503, 'Sign-in is not configured. Contact the administrator.');
  }

  let claims:SessionUser & {credentialVersion?:string};
  try {
    claims=jwt.verify(token, env.jwtSecret) as typeof claims;
  } catch {
    throw new ApiError(401, 'Invalid or expired session');
  }
  const {data:user,error}=await getSupabaseAdmin().from('users').select('id,email,roles,status,password_hash').eq('id',claims.id).maybeSingle();
  if(error)throw error;
  if(!user||user.status!=='active'||!claims.credentialVersion||claims.credentialVersion!==credentialVersion(user.password_hash))throw new ApiError(401,'Session expired. Please sign in again.');
  return {id:user.id,email:user.email,roles:user.roles} as SessionUser;
}

export function authorizeRequest(user: SessionUser, ...allowed: UserRole[]) {
  if (!user.roles.some((role) => allowed.includes(role))) {
    throw new ApiError(403, 'You do not have access to this action');
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ message: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return Response.json(
      { message: 'Validation failed', issues: error.issues },
      { status: 400 },
    );
  }

  // Supabase wraps network failures in plain objects, not always Error instances.
  if (error && typeof error === 'object') {
    const failure = error as { message?: unknown; details?: unknown; code?: unknown; name?: unknown };
    const detail = [failure.message, failure.details, failure.code, failure.name]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
    if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|TimeoutError|AbortError/i.test(detail)) {
      console.error('Database connection unavailable. Check Supabase project URL, project status and network connectivity.');
      return Response.json(
        { message: 'Cannot connect to the database. Ask the administrator to check the Supabase project URL and project status.' },
        { status: 503 },
      );
    }
  }

  console.error(error);
  return Response.json({ message: 'Unexpected server error' }, { status: 500 });
}
