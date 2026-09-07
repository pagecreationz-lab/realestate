import jwt from 'jsonwebtoken';
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

export function authenticateRequest(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  try {
    return jwt.verify(token, env.jwtSecret) as SessionUser;
  } catch {
    throw new ApiError(401, 'Invalid or expired session');
  }
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

  console.error(error);
  return Response.json({ message: 'Unexpected server error' }, { status: 500 });
}
