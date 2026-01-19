import type { Request, Response, NextFunction } from 'express';
import type { User } from '@lanpapp/shared';
import { supabaseAdmin } from '../services/supabase.service.js';
import { UnauthorizedError } from './error.middleware.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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

    req.user = user as User;
    req.userId = authUser.id;
    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    const {
      data: { user: authUser },
    } = await supabaseAdmin.auth.getUser(token);

    if (authUser) {
      const { data: user } = await supabaseAdmin
        .schema('lanpapp')
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (user) {
        req.user = user as User;
        req.userId = authUser.id;
      }
    }

    next();
  } catch {
    // Silently continue without auth
    next();
  }
};
