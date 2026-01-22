import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { cors, handleError, validate, authenticate, BadRequestError, NotFoundError } from '../../../_lib';
import { db, supabaseAdmin, STORAGE_BUCKETS } from '../../../_lib/supabase';

const updateGameSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  cover_url: z.string().url().nullable().optional(),
  genre: z.string().max(50).nullable().optional(),
  min_players: z.number().int().min(1).max(100).nullable().optional(),
  max_players: z.number().int().min(1).max(100).nullable().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  try {
    await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Game ID is required');
    }

    if (req.method === 'GET') {
      const { data: game, error } = await db()
        .from('games')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !game) {
        throw new NotFoundError('Game not found');
      }

      // Get play count
      const { count: timesPlayed } = await db()
        .from('lanpas')
        .select('id', { count: 'exact', head: true })
        .eq('selected_game_id', id);

      // Get average rating
      const { data: lanpaIds } = await db()
        .from('lanpas')
        .select('id')
        .eq('selected_game_id', id);

      let averageRating = null;
      if (lanpaIds && lanpaIds.length > 0) {
        const { data: ratings } = await db()
          .from('lanpa_ratings')
          .select('score')
          .in('lanpa_id', lanpaIds.map(l => l.id));

        if (ratings && ratings.length > 0) {
          averageRating = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
        }
      }

      // Get lanpas where this game was played
      const { data: lanpas } = await db()
        .from('lanpas')
        .select(`
          id,
          name,
          actual_date,
          admin:users!lanpas_admin_id_fkey(id, username, display_name)
        `)
        .eq('selected_game_id', id)
        .order('actual_date', { ascending: false })
        .limit(10);

      return res.json({
        data: {
          ...game,
          times_played: timesPlayed || 0,
          average_rating: averageRating,
          recent_lanpas: lanpas,
        },
      });
    }

    if (req.method === 'PATCH') {
      // Check if game exists
      const { data: existingGame } = await db()
        .from('games')
        .select('created_by')
        .eq('id', id)
        .single();

      if (!existingGame) {
        throw new NotFoundError('Game not found');
      }

      const updates = validate(updateGameSchema, req.body);

      // Validate player counts
      if (updates.min_players && updates.max_players && updates.min_players > updates.max_players) {
        throw new BadRequestError('Minimum players cannot be greater than maximum players');
      }

      const { data: games, error } = await db()
        .from('games')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();

      if (error) {
        throw new BadRequestError(`Failed to update game: ${error.message}`);
      }

      if (!games || games.length === 0) {
        throw new NotFoundError('Game not found or could not be updated');
      }

      return res.json({ data: games[0] });
    }

    if (req.method === 'DELETE') {
      // Check if game exists
      const { data: existingGame } = await db()
        .from('games')
        .select('id, cover_url')
        .eq('id', id)
        .single();

      if (!existingGame) {
        throw new NotFoundError('Game not found');
      }

      // Check if game is used in any lanpa
      const { count } = await db()
        .from('lanpas')
        .select('id', { count: 'exact', head: true })
        .eq('selected_game_id', id);

      if (count && count > 0) {
        throw new BadRequestError('Cannot delete a game that has been played in lanpas');
      }

      // Delete cover image if exists
      if (existingGame.cover_url) {
        const urlParts = existingGame.cover_url.split('/');
        const filePath = urlParts.slice(-2).join('/');
        await supabaseAdmin.storage.from(STORAGE_BUCKETS.GAME_COVERS).remove([filePath]);
      }

      const { data: deletedGames, error } = await db()
        .from('games')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        throw new BadRequestError('Failed to delete game');
      }

      if (!deletedGames || deletedGames.length === 0) {
        throw new BadRequestError('Game could not be deleted');
      }

      return res.json({ message: 'Game deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
