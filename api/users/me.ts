import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isValidUsername } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, BadRequestError, ConflictError } from '../_lib';
import { db } from '../_lib/supabase';

const updateUserSchema = z.object({
  username: z.string().refine(isValidUsername, {
    message: 'Username must be 3-20 characters, alphanumeric and underscores only',
  }).optional(),
  display_name: z.string().min(1).max(50).optional(),
  locale: z.enum(['en', 'es']).optional(),
  notification_preferences: z.object({
    in_app: z.boolean().optional(),
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    lanpa_created: z.boolean().optional(),
    lanpa_updated: z.boolean().optional(),
    lanpa_invitation: z.boolean().optional(),
    game_voting: z.boolean().optional(),
    punishment_nomination: z.boolean().optional(),
    lanpa_reminder: z.boolean().optional(),
  }).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  try {
    const { user, userId } = await authenticate(req);

    if (req.method === 'GET') {
      return res.json({ data: user });
    }

    if (req.method === 'PATCH') {
      const updates = validate(updateUserSchema, req.body);

      // Check if username is being changed and if it's already taken
      if (updates.username && updates.username !== user.username) {
        const { data: existingUser } = await db()
          .from('users')
          .select('id')
          .eq('username', updates.username)
          .neq('id', userId)
          .single();

        if (existingUser) {
          throw new ConflictError('Username is already taken');
        }
      }

      // Merge notification preferences if provided
      let notificationPreferences = user.notification_preferences;
      if (updates.notification_preferences) {
        notificationPreferences = {
          ...notificationPreferences,
          ...updates.notification_preferences,
        };
      }

      const { data: updatedUser, error } = await db()
        .from('users')
        .update({
          ...(updates.username && { username: updates.username }),
          ...(updates.display_name && { display_name: updates.display_name }),
          ...(updates.locale && { locale: updates.locale }),
          ...(updates.notification_preferences && { notification_preferences: notificationPreferences }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new BadRequestError('Failed to update user');
      }

      return res.json({ data: updatedUser });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
