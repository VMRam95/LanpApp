import { Router } from 'express';
import { z } from 'zod';
import type { UpdateUserRequest } from '@lanpapp/shared';
import { isValidUsername } from '@lanpapp/shared';
import { db, supabaseAdmin, STORAGE_BUCKETS, getPublicUrl } from '../services/supabase.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/error.middleware.js';

export const usersRouter: Router = Router();

// Validation schemas
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

// GET /api/users/me
usersRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json({ data: req.user });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/me
usersRouter.patch('/me', authenticate, validate(updateUserSchema), async (req, res, next) => {
  try {
    const updates = req.body as UpdateUserRequest;

    // Check if username is being changed and if it's already taken
    if (updates.username && updates.username !== req.user!.username) {
      const { data: existingUser } = await db()
        .from('users')
        .select('id')
        .eq('username', updates.username)
        .neq('id', req.userId)
        .single();

      if (existingUser) {
        throw new ConflictError('Username is already taken');
      }
    }

    // Merge notification preferences if provided
    let notificationPreferences = req.user!.notification_preferences;
    if (updates.notification_preferences) {
      notificationPreferences = {
        ...notificationPreferences,
        ...updates.notification_preferences,
      };
    }

    const { data: user, error } = await db()
      .from('users')
      .update({
        ...(updates.username && { username: updates.username }),
        ...(updates.display_name && { display_name: updates.display_name }),
        ...(updates.locale && { locale: updates.locale }),
        ...(updates.notification_preferences && { notification_preferences: notificationPreferences }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to update user');
    }

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/me/avatar
usersRouter.post('/me/avatar', authenticate, async (req, res, next) => {
  try {
    // Expect base64 encoded image in body
    const { image, contentType } = req.body;

    if (!image || !contentType) {
      throw new BadRequestError('Image and contentType are required');
    }

    // Validate content type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(contentType)) {
      throw new BadRequestError('Invalid image type. Allowed: JPEG, PNG, WebP');
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(image, 'base64');

    // Check file size (max 2MB)
    if (buffer.length > 2 * 1024 * 1024) {
      throw new BadRequestError('Image size must be less than 2MB');
    }

    // Generate file path
    const extension = contentType.split('/')[1];
    const filePath = `${req.userId}/avatar.${extension}`;

    // Delete old avatar if exists
    if (req.user!.avatar_url) {
      const oldPath = req.user!.avatar_url.split('/').slice(-2).join('/');
      await supabaseAdmin.storage.from(STORAGE_BUCKETS.AVATARS).remove([oldPath]);
    }

    // Upload new avatar
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new BadRequestError('Failed to upload avatar');
    }

    // Get public URL
    const avatarUrl = getPublicUrl(STORAGE_BUCKETS.AVATARS, filePath);

    // Update user profile
    const { data: user, error: updateError } = await db()
      .from('users')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestError('Failed to update avatar URL');
    }

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/me/avatar
usersRouter.delete('/me/avatar', authenticate, async (req, res, next) => {
  try {
    if (!req.user!.avatar_url) {
      throw new BadRequestError('No avatar to delete');
    }

    // Extract file path from URL
    const urlParts = req.user!.avatar_url.split('/');
    const filePath = urlParts.slice(-2).join('/');

    // Delete from storage
    const { error: deleteError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .remove([filePath]);

    if (deleteError) {
      console.error('Failed to delete avatar from storage:', deleteError);
    }

    // Update user profile
    const { data: user, error: updateError } = await db()
      .from('users')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestError('Failed to remove avatar');
    }

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id
usersRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await db()
      .from('users')
      .select('id, username, display_name, avatar_url, created_at')
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new NotFoundError('User not found');
    }

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/search
usersRouter.get('/search', authenticate, async (req, res, next) => {
  try {
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

    res.json({ data: users });
  } catch (error) {
    next(error);
  }
});
