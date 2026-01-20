import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { cors, handleError, validate } from '../../_lib';
import { supabaseAdmin } from '../../_lib/supabase';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = validate(forgotPasswordSchema, req.body);
    const isDevelopment = process.env.NODE_ENV === 'development';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (isDevelopment) {
      // In development, generate the link directly without sending email
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${frontendUrl}/reset-password`,
        },
      });

      if (error) {
        console.error('Password reset error:', error);
        // Still return success to prevent email enumeration
        return res.json({ message: 'If the email exists, a password reset link has been sent' });
      }

      // Return the link for development testing
      const resetUrl = data.properties?.action_link;
      return res.json({
        message: 'Development mode: Reset link generated',
        resetUrl,
      });
    } else {
      // In production, send email via Supabase
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${frontendUrl}/reset-password`,
      });

      if (error) {
        console.error('Password reset error:', error);
      }

      return res.json({ message: 'If the email exists, a password reset link has been sent' });
    }
  } catch (error) {
    return handleError(error, res);
  }
}
