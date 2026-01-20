import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRandomItem } from '@lanpapp/shared';
import { cors, handleError, authenticate, BadRequestError, NotFoundError } from '../_lib';
import { db } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);

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

    return res.json({ data: randomGame });
  } catch (error) {
    return handleError(error, res);
  }
}
