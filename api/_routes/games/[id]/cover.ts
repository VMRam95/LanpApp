import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, BadRequestError, NotFoundError } from '../../../_lib';
import { db, supabaseAdmin, STORAGE_BUCKETS, getPublicUrl } from '../../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Game ID is required');
    }

    const { image, contentType } = req.body;

    if (!image || !contentType) {
      throw new BadRequestError('Image and contentType are required');
    }

    // Validate content type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(contentType)) {
      throw new BadRequestError('Invalid image type. Allowed: JPEG, PNG, WebP');
    }

    // Check if game exists
    const { data: game } = await db()
      .from('games')
      .select('id, cover_url')
      .eq('id', id)
      .single();

    if (!game) {
      throw new NotFoundError('Game not found');
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(image, 'base64');

    // Check file size (max 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestError('Image size must be less than 5MB');
    }

    // Generate file path
    const extension = contentType.split('/')[1];
    const filePath = `${id}/cover.${extension}`;

    // Delete old cover if exists
    if (game.cover_url) {
      const oldPath = game.cover_url.split('/').slice(-2).join('/');
      await supabaseAdmin.storage.from(STORAGE_BUCKETS.GAME_COVERS).remove([oldPath]);
    }

    // Upload new cover
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.GAME_COVERS)
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new BadRequestError('Failed to upload cover');
    }

    // Get public URL
    const coverUrl = getPublicUrl(STORAGE_BUCKETS.GAME_COVERS, filePath);

    // Update game
    const { data: updatedGame, error: updateError } = await db()
      .from('games')
      .update({
        cover_url: coverUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestError('Failed to update cover URL');
    }

    return res.json({ data: updatedGame });
  } catch (error) {
    return handleError(error, res);
  }
}
