import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { cors, handleError, validate } from '../../_lib';
import { supabaseAdmin } from '../../_lib/supabase';
import { sendTemplateEmail } from '../../_lib/notifications';

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

    // Generate reset link via Supabase Admin API
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

    const resetUrl = data.properties?.action_link;

    if (isDevelopment) {
      // In development, return the link directly for testing
      return res.json({
        message: 'Development mode: Reset link generated',
        resetUrl,
      });
    }

    // In production, send email via email-service
    if (resetUrl) {
      await sendTemplateEmail(email, 'lanpapp/lanpapp-reset-password', {
        resetUrl,
      });
    }

    return res.json({ message: 'If the email exists, a password reset link has been sent' });
  } catch (error) {
    return handleError(error, res);
  }
}
