import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import type { LoginRequest, AuthResponse } from '@lanpapp/shared';
import { cors, handleError, validate, UnauthorizedError } from '../_lib';
import { supabaseAdmin, db } from '../_lib/supabase';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = validate(loginSchema, req.body) as LoginRequest;

    const { data: session, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Get user profile
    const { data: user, error: userError } = await db()
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError || !user) {
      throw new UnauthorizedError('User profile not found');
    }

    const response: AuthResponse = {
      user,
      session: {
        access_token: session.session!.access_token,
        refresh_token: session.session!.refresh_token,
        expires_at: session.session!.expires_at!,
      },
    };

    return res.json({ data: response });
  } catch (error) {
    return handleError(error, res);
  }
}
