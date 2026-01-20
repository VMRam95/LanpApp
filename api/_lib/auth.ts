import type { VercelRequest } from '@vercel/node';
import type { User } from '@lanpapp/shared';
import { supabaseAdmin } from './supabase';
import { UnauthorizedError } from './errors';

export interface AuthResult {
  user: User;
  userId: string;
}

/**
 * Authenticates a request using the Bearer token.
 * Throws UnauthorizedError if authentication fails.
 */
export async function authenticate(req: VercelRequest): Promise<AuthResult> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }

  const token = authHeader.substring(7);

  // Verify the token with Supabase
  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authUser) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Get user profile from our users table
  const { data: user, error: userError } = await supabaseAdmin
    .schema('lanpapp')
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (userError || !user) {
    throw new UnauthorizedError('User not found');
  }

  return {
    user: user as User,
    userId: authUser.id,
  };
}

/**
 * Optional authentication - returns null if no token is provided.
 * Doesn't throw an error for missing tokens.
 */
export async function optionalAuth(req: VercelRequest): Promise<AuthResult | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    return await authenticate(req);
  } catch {
    // Silently return null for invalid tokens in optional auth
    return null;
  }
}
