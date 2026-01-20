import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, handleError, authenticate, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      throw new BadRequestError('User ID is required');
    }

    const { data: userPunishments, error } = await db()
      .from('user_punishments')
      .select(`
        *,
        punishment:punishments(*),
        lanpa:lanpas(id, name)
      `)
      .eq('user_id', userId)
      .order('applied_at', { ascending: false });

    if (error) {
      throw new BadRequestError('Failed to fetch user punishments');
    }

    // Calculate total point impact
    const totalPointImpact = userPunishments?.reduce(
      (sum, up) => sum + (up.punishment?.point_impact || 0),
      0
    ) || 0;

    return res.json({
      data: {
        punishments: userPunishments,
        total_point_impact: totalPointImpact,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
