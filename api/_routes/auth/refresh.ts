import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { cors, handleError, validate, BadRequestError, UnauthorizedError } from '../../_lib';
import { supabaseAdmin } from '../../_lib/supabase';

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refresh_token } = validate(refreshSchema, req.body);

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    return res.json({
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
