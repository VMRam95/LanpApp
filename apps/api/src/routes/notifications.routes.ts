import { Router } from 'express';
import { z } from 'zod';
import { db } from '../services/supabase.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { BadRequestError, NotFoundError } from '../middleware/error.middleware.js';

export const notificationsRouter: Router = Router();

// Validation schemas
const subscribePushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// GET /api/notifications
notificationsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = '1', limit = '20', unread_only } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    let query = db()
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.userId);

    if (unread_only === 'true') {
      query = query.eq('read', false);
    }

    const { data: notifications, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      throw new BadRequestError('Failed to fetch notifications');
    }

    // Get unread count
    const { count: unreadCount } = await db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .eq('read', false);

    res.json({
      data: {
        notifications: notifications || [],
        unread_count: unreadCount || 0,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: notification, error } = await db()
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error || !notification) {
      throw new NotFoundError('Notification not found');
    }

    res.json({ data: notification });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/read-all
notificationsRouter.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    const { error } = await db()
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.userId)
      .eq('read', false);

    if (error) {
      throw new BadRequestError('Failed to mark notifications as read');
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/:id
notificationsRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await db()
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) {
      throw new BadRequestError('Failed to delete notification');
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/subscribe-push
notificationsRouter.post('/subscribe-push', authenticate, validate(subscribePushSchema), async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;

    // Check if subscription already exists
    const { data: existing } = await db()
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', req.userId)
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
        user_id: req.userId,
        endpoint,
        keys,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to create subscription');
    }

    res.status(201).json({ data: subscription });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/unsubscribe-push
notificationsRouter.delete('/unsubscribe-push', authenticate, async (req, res, next) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      throw new BadRequestError('Endpoint is required');
    }

    const { error } = await db()
      .from('push_subscriptions')
      .delete()
      .eq('user_id', req.userId)
      .eq('endpoint', endpoint);

    if (error) {
      throw new BadRequestError('Failed to unsubscribe');
    }

    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    next(error);
  }
});
