import { Router } from 'express';
import { z } from 'zod';
import type { CreateGameRequest, UpdateGameRequest } from '@lanpapp/shared';
import { getRandomItem } from '@lanpapp/shared';
import { db, supabaseAdmin, STORAGE_BUCKETS, getPublicUrl } from '../services/supabase.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../middleware/error.middleware.js';

export const gamesRouter: Router = Router();

// Validation schemas
const createGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  cover_url: z.string().url().optional(),
  genre: z.string().max(50).optional(),
  min_players: z.number().int().min(1).max(100).optional(),
  max_players: z.number().int().min(1).max(100).optional(),
});

const updateGameSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  cover_url: z.string().url().nullable().optional(),
  genre: z.string().max(50).nullable().optional(),
  min_players: z.number().int().min(1).max(100).nullable().optional(),
  max_players: z.number().int().min(1).max(100).nullable().optional(),
});

const querySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  genre: z.string().optional(),
  min_players: z.string().transform(Number).optional(),
  max_players: z.string().transform(Number).optional(),
  search: z.string().optional(),
});

// GET /api/games
gamesRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const { page, limit, genre, min_players, max_players, search } = querySchema.parse(req.query);
    const pageNum = page;
    const limitNum = Math.min(limit, 100);
    const offset = (pageNum - 1) * limitNum;

    let query = db()
      .from('games')
      .select('*', { count: 'exact' });

    // Apply filters
    if (genre) {
      query = query.eq('genre', genre);
    }

    if (min_players) {
      query = query.gte('max_players', min_players);
    }

    if (max_players) {
      query = query.lte('min_players', max_players);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: games, error, count } = await query
      .order('name', { ascending: true })
      .range(offset, offset + limitNum - 1);

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

    res.json({
      data: gamesWithStats,
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

// GET /api/games/random
gamesRouter.get('/random', authenticate, async (req, res, next) => {
  try {
    const { genre, min_players, max_players } = req.query;

    let query = db().from('games').select('*');

    if (genre && typeof genre === 'string') {
      query = query.eq('genre', genre);
    }

    if (min_players) {
      query = query.gte('max_players', parseInt(min_players as string, 10));
    }

    if (max_players) {
      query = query.lte('min_players', parseInt(max_players as string, 10));
    }

    const { data: games, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch games');
    }

    if (!games || games.length === 0) {
      throw new NotFoundError('No games found matching the criteria');
    }

    const randomGame = getRandomItem(games);

    res.json({ data: randomGame });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/genres
gamesRouter.get('/genres', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await db()
      .from('games')
      .select('genre')
      .not('genre', 'is', null);

    if (error) {
      throw new BadRequestError('Failed to fetch genres');
    }

    // Get unique genres
    const genres = [...new Set(data?.map(g => g.genre).filter(Boolean))].sort();

    res.json({ data: genres });
  } catch (error) {
    next(error);
  }
});

// POST /api/games
gamesRouter.post('/', authenticate, validate(createGameSchema), async (req, res, next) => {
  try {
    const body = req.body as CreateGameRequest;

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
        created_by: req.userId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to create game');
    }

    res.status(201).json({
      data: {
        ...game,
        times_played: 0,
        average_rating: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/:id
gamesRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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

    res.json({
      data: {
        ...game,
        times_played: timesPlayed || 0,
        average_rating: averageRating,
        recent_lanpas: lanpas,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/games/:id
gamesRouter.patch('/:id', authenticate, validate(updateGameSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateGameRequest;

    // Check if game exists and user is creator
    const { data: existingGame } = await db()
      .from('games')
      .select('created_by')
      .eq('id', id)
      .single();

    if (!existingGame) {
      throw new NotFoundError('Game not found');
    }

    // Anyone can edit games (per MVP spec: "Any user can add/edit/delete games")
    // But we'll keep track of who created it

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
      console.error('Supabase update error:', error);
      throw new BadRequestError(`Failed to update game: ${error.message}`);
    }

    // Verify that exactly one row was updated
    if (!games || games.length === 0) {
      throw new NotFoundError('Game not found or could not be updated');
    }

    res.json({ data: games[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/games/:id
gamesRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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

    // Verify that at least one row was actually deleted
    if (!deletedGames || deletedGames.length === 0) {
      throw new BadRequestError('Game could not be deleted');
    }

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/games/:id/cover
gamesRouter.post('/:id/cover', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
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

    res.json({ data: updatedGame });
  } catch (error) {
    next(error);
  }
});
