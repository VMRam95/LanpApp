import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, BadRequestError, NotFoundError } from '../../_lib';
import { db } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Notification ID is required');
    }

    const { data: notification, error } = await db()
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !notification) {
      throw new NotFoundError('Notification not found');
    }

    return res.json({ data: notification });
  } catch (error) {
    return handleError(error, res);
  }
}
