import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib';

/**
 * GET /api/auth/verify-reset?token=xxx
 *
 * Proxy endpoint to hide Supabase URL in password reset emails.
 * Redirects to Supabase verify endpoint with the token.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?error=invalid_token`);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!supabaseUrl) {
    console.error('SUPABASE_URL not configured');
    return res.redirect(`${frontendUrl}/login?error=configuration_error`);
  }

  // Build Supabase verify URL
  const redirectTo = encodeURIComponent(`${frontendUrl}/reset-password`);
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=recovery&redirect_to=${redirectTo}`;

  return res.redirect(verifyUrl);
}
