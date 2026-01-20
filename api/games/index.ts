import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { cors, handleError, validate, authenticate, BadRequestError } from '../_lib';
import { db } from '../_lib/supabase';

const createGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  cover_url: z.string().url().optional(),
  genre: z.string().max(50).optional(),
  min_players: z.number().int().min(1).max(100).optional(),
  max_players: z.number().int().min(1).max(100).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  try {
    const { userId } = await authenticate(req);

    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const { genre, min_players, max_players, search } = req.query;

      let query = db()
        .from('games')
        .select('*', { count: 'exact' });

      // Apply filters
      if (genre && typeof genre === 'string') {
        query = query.eq('genre', genre);
      }

      if (min_players) {
        query = query.gte('max_players', parseInt(min_players as string, 10));
      }

      if (max_players) {
        query = query.lte('min_players', parseInt(max_players as string, 10));
      }

      if (search && typeof search === 'string') {
        query = query.ilike('name', `%${search}%`);
      }

      const { data: games, error, count } = await query
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new BadRequestError('Failed to fetch games');
      }

      // Get play counts and average ratings for each game
      const gamesWithStats = await Promise.all(
        (games || []).map(async (game) => {
          // Count times played (selected in lanpas)
          const { count: timesPlayed } = await db()
            .from('lanpas')
            .select('id', { count: 'exact', head: true })
            .eq('selected_game_id', game.id);

          // Get average lanpa rating for lanpas with this game
          const { data: lanpaIds } = await db()
            .from('lanpas')
            .select('id')
            .eq('selected_game_id', game.id);

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

          return {
            ...game,
            times_played: timesPlayed || 0,
            average_rating: averageRating,
          };
        })
      );

      return res.json({
        data: gamesWithStats,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    if (req.method === 'POST') {
      const body = validate(createGameSchema, req.body);

      // Validate player counts
      if (body.min_players && body.max_players && body.min_players > body.max_players) {
        throw new BadRequestError('Minimum players cannot be greater than maximum players');
      }

      const { data: game, error } = await db()
        .from('games')
        .insert({
          name: body.name,
          description: body.description,
          cover_url: body.cover_url,
          genre: body.genre,
          min_players: body.min_players,
          max_players: body.max_players,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestError('Failed to create game');
      }

      return res.status(201).json({
        data: {
          ...game,
          times_played: 0,
          average_rating: null,
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
