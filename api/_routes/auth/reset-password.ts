import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isValidPassword } from '../../_lib/shared-utils';
import { cors, handleError, validate, BadRequestError } from '../../_lib';
import { supabaseAdmin } from '../../_lib/supabase';

const resetPasswordSchema = z.object({
  access_token: z.string().min(1, 'Access token is required'),
  password: z.string().refine(isValidPassword, {
    message: 'Password must be at least 8 characters with at least one letter and one number',
  }),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { access_token, password } = validate(resetPasswordSchema, req.body);

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

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    return handleError(error, res);
  }
}
