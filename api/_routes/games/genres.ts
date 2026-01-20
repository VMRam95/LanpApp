import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, BadRequestError } from '../_lib';
import { db } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);

    const { data, error } = await db()
      .from('games')
      .select('genre')
      .not('genre', 'is', null);

    if (error) {
      throw new BadRequestError('Failed to fetch genres');
    }

    // Get unique genres
    const genres = [...new Set(data?.map(g => g.genre).filter(Boolean))].sort();

    return res.json({ data: genres });
  } catch (error) {
    return handleError(error, res);
  }
}
