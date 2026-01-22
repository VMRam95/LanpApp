import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError } from '../../_lib';
import { supabaseAdmin } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await supabaseAdmin.auth.admin.signOut(token);
    }
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return handleError(error, res);
  }
}
