import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, BadRequestError } from '../../_lib';
import { db, supabaseAdmin, STORAGE_BUCKETS, getPublicUrl } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  try {
    const { user, userId } = await authenticate(req);

    if (req.method === 'POST') {
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
      const filePath = `${userId}/avatar.${extension}`;

      // Delete old avatar if exists
      if (user.avatar_url) {
        const oldPath = user.avatar_url.split('/').slice(-2).join('/');
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
      const { data: updatedUser, error: updateError } = await db()
        .from('users')
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        throw new BadRequestError('Failed to update avatar URL');
      }

      return res.json({ data: updatedUser });
    }

    if (req.method === 'DELETE') {
      if (!user.avatar_url) {
        throw new BadRequestError('No avatar to delete');
      }

      // Extract file path from URL
      const urlParts = user.avatar_url.split('/');
      const filePath = urlParts.slice(-2).join('/');

      // Delete from storage
      const { error: deleteError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .remove([filePath]);

      if (deleteError) {
        console.error('Failed to delete avatar from storage:', deleteError);
      }

      // Update user profile
      const { data: updatedUser, error: updateError } = await db()
        .from('users')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        throw new BadRequestError('Failed to remove avatar');
      }

      return res.json({ data: updatedUser });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
