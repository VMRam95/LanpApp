import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Notification ID is required');
    }

    const { error } = await db()
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestError('Failed to delete notification');
    }

    return res.json({ message: 'Notification deleted' });
  } catch (error) {
    return handleError(error, res);
  }
}
