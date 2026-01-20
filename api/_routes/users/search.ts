import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, BadRequestError } from '../_lib';
import { db } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);

    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      throw new BadRequestError('Search query must be at least 2 characters');
    }

    // Search by username, display_name, or email
    const { data: users, error } = await db()
      .from('users')
      .select('id, username, display_name, avatar_url, email')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(20);

    if (error) {
      throw new BadRequestError('Search failed');
    }

    return res.json({ data: users });
  } catch (error) {
    return handleError(error, res);
  }
}
