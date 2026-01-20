import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import type { RegisterRequest, AuthResponse } from '@lanpapp/shared';
import { isValidUsername, isValidPassword } from '@lanpapp/shared';
import { cors, handleError, validate, BadRequestError, ConflictError } from '../../_lib';
import { supabaseAdmin, db } from '../../_lib/supabase';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().refine(isValidPassword, {
    message: 'Password must be at least 8 characters with at least one letter and one number',
  }),
  username: z.string().refine(isValidUsername, {
    message: 'Username must be 3-20 characters, alphanumeric and underscores only',
  }),
  display_name: z.string().min(1).max(50).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, username, display_name } = validate(registerSchema, req.body) as RegisterRequest;

    // Check if username is already taken
    const { data: existingUser } = await db()
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      throw new ConflictError('Username is already taken');
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new ConflictError('Email is already registered');
      }
      throw new BadRequestError(authError.message);
    }

    // Create user profile
    const { data: user, error: userError } = await db()
      .from('users')
      .insert({
        id: authData.user.id,
        username,
        display_name: display_name || username,
        locale: 'es',
        notification_preferences: {
          in_app: true,
          push: true,
          email: true,
          lanpa_created: true,
          lanpa_updated: true,
          lanpa_invitation: true,
          game_voting: true,
          punishment_nomination: true,
          lanpa_reminder: true,
        },
      })
      .select()
      .single();

    if (userError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new BadRequestError('Failed to create user profile');
    }

    // Sign in to get session
    const { data: session, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      throw new BadRequestError('Account created but failed to sign in');
    }

    const response: AuthResponse = {
      user,
      session: {
        access_token: session.session!.access_token,
        refresh_token: session.session!.refresh_token,
        expires_at: session.session!.expires_at!,
      },
    };

    return res.status(201).json({ data: response });
  } catch (error) {
    return handleError(error, res);
  }
}
