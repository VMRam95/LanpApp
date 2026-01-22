import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, NotFoundError } from '../../_lib';
import { db } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new NotFoundError('User ID is required');
    }

    const { data: user, error } = await db()
      .from('users')
      .select('id, username, display_name, avatar_url, created_at')
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new NotFoundError('User not found');
    }

    return res.json({ data: user });
  } catch (error) {
    return handleError(error, res);
  }
}
