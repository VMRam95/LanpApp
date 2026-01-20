import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, BadRequestError } from '../_lib';
import { db } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);

    const { error } = await db()
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw new BadRequestError('Failed to mark notifications as read');
    }

    return res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    return handleError(error, res);
  }
}
