import { Router } from 'express';
import { z } from 'zod';
import type { RegisterRequest, LoginRequest, AuthResponse } from '@lanpapp/shared';
import { isValidUsername, isValidPassword } from '@lanpapp/shared';
import { supabaseAdmin, db } from '../services/supabase.service.js';
import { validate } from '../middleware/validate.middleware.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../middleware/error.middleware.js';
import { sendTemplateEmail } from '../services/notification.service.js';
import { config } from '../config/index.js';

export const authRouter: Router = Router();

// Validation schemas
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

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  access_token: z.string().min(1, 'Access token is required'),
  password: z.string().refine(isValidPassword, {
    message: 'Password must be at least 8 characters with at least one letter and one number',
  }),
});

// POST /api/auth/register
authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, username, display_name } = req.body as RegisterRequest;

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
      email_confirm: true, // Auto-confirm for development
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

    // Send welcome email (non-blocking)
    sendTemplateEmail(email, 'lanpapp/lanpapp-welcome', {
      username,
      email,
    }).catch((err) => console.error('Error sending welcome email:', err));

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

    res.status(201).json({ data: response });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as LoginRequest;

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

    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await supabaseAdmin.auth.admin.signOut(token);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;

    // Generate reset link via Supabase
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${config.frontendUrl}/reset-password`,
      },
    });

    if (error) {
      console.error('Password reset error:', error);
      // Still return success to prevent email enumeration
      res.json({ message: 'If the email exists, a password reset link has been sent' });
      return;
    }

    // Send email via email-service
    const resetUrl = data.properties?.action_link;
    if (resetUrl) {
      await sendTemplateEmail(email, 'lanpapp/lanpapp-reset-password', {
        resetUrl,
      });
    }

    res.json({ message: 'If the email exists, a password reset link has been sent' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { access_token, password } = req.body;

    // Get user from access token
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(access_token);

    if (userError || !userData.user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Update user password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      { password }
    );

    if (updateError) {
      throw new BadRequestError('Failed to update password');
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new BadRequestError('Refresh token is required');
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    res.json({
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    next(error);
  }
});
