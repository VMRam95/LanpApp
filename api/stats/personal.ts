import type { VercelRequest, VercelResponse } from '@vercel/node';
import { LanpaStatus, MemberStatus } from '@lanpapp/shared';
import { cors, handleError, authenticate } from '../_lib';
import { db } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);

    // Lanpas created (as admin)
    const { count: lanpasCreated } = await db()
      .from('lanpas')
      .select('id', { count: 'exact', head: true })
      .eq('admin_id', userId);

    // Lanpas attended (as member)
    const { count: lanpasAttended } = await db()
      .from('lanpa_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', MemberStatus.ATTENDED);

    // Games played (unique games from attended lanpas)
    const { data: attendedLanpas } = await db()
      .from('lanpa_members')
      .select('lanpa:lanpas(selected_game_id)')
      .eq('user_id', userId)
      .eq('status', MemberStatus.ATTENDED);

    const { data: hostedLanpas } = await db()
      .from('lanpas')
      .select('selected_game_id')
      .eq('admin_id', userId)
      .eq('status', LanpaStatus.COMPLETED);

    const uniqueGames = new Set<string>();
    attendedLanpas?.forEach(l => {
      const gameId = (l.lanpa as any)?.selected_game_id;
      if (gameId) uniqueGames.add(gameId);
    });
    hostedLanpas?.forEach(l => {
      if (l.selected_game_id) uniqueGames.add(l.selected_game_id);
    });

    // Average rating (all types received)
    const { data: ratings } = await db()
      .from('ratings')
      .select('score')
      .eq('to_user_id', userId);

    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : null;

    // Total punishments
    const { count: totalPunishments } = await db()
      .from('user_punishments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const hasActivity = (lanpasCreated || 0) > 0 || (lanpasAttended || 0) > 0;

    return res.json({
      data: {
        lanpas_created: lanpasCreated || 0,
        lanpas_attended: lanpasAttended || 0,
        games_played: uniqueGames.size,
        average_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        total_punishments: totalPunishments || 0,
        has_activity: hasActivity,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
