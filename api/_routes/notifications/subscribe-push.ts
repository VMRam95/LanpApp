import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { cors, handleError, validate, authenticate, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

const subscribePushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);

    const { endpoint, keys } = validate(subscribePushSchema, req.body);

    // Check if subscription already exists
    const { data: existing } = await db()
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .single();

    if (existing) {
      // Update existing subscription
      const { data: subscription, error } = await db()
        .from('push_subscriptions')
        .update({ keys })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new BadRequestError('Failed to update subscription');
      }

      return res.json({ data: subscription });
    }

    // Create new subscription
    const { data: subscription, error } = await db()
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint,
        keys,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to create subscription');
    }

    return res.status(201).json({ data: subscription });
  } catch (error) {
    return handleError(error, res);
  }
}
