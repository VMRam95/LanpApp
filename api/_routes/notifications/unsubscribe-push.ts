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

    const { endpoint } = req.body;

    if (!endpoint) {
      throw new BadRequestError('Endpoint is required');
    }

    const { error } = await db()
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      throw new BadRequestError('Failed to unsubscribe');
    }

    return res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    return handleError(error, res);
  }
}
