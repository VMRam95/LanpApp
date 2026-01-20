import type { VercelRequest, VercelResponse } from '@vercel/node';
import { LanpaStatus, MemberStatus } from '@lanpapp/shared';
import { cors, handleError, authenticate, BadRequestError, NotFoundError } from '../../../_lib';
import { db } from '../../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('User ID is required');
    }

    // Get user
    const { data: user, error } = await db()
      .from('users')
      .select('id, username, display_name, avatar_url, created_at')
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new NotFoundError('User not found');
    }

    // Lanpas hosted
    const { count: lanpasHosted } = await db()
      .from('lanpas')
      .select('id', { count: 'exact', head: true })
      .eq('admin_id', id)
      .eq('status', LanpaStatus.COMPLETED);

    // Lanpas attended
    const { count: lanpasAttended } = await db()
      .from('lanpa_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('status', MemberStatus.ATTENDED);

    // Average rating as admin
    const { data: adminRatings } = await db()
      .from('ratings')
      .select('score')
      .eq('to_user_id', id)
      .eq('rating_type', 'member_to_admin');

    const avgRatingAsAdmin = adminRatings && adminRatings.length > 0
      ? adminRatings.reduce((sum, r) => sum + r.score, 0) / adminRatings.length
      : null;

    // Average rating as member
    const { data: memberRatings } = await db()
      .from('ratings')
      .select('score')
      .eq('to_user_id', id)
      .in('rating_type', ['admin_to_member', 'member_to_member']);

    const avgRatingAsMember = memberRatings && memberRatings.length > 0
      ? memberRatings.reduce((sum, r) => sum + r.score, 0) / memberRatings.length
      : null;

    // Favorite games (most played)
    const { data: attendedLanpas } = await db()
      .from('lanpa_members')
      .select('lanpa:lanpas(selected_game_id)')
      .eq('user_id', id)
      .eq('status', MemberStatus.ATTENDED);

    const gameCounts: Record<string, number> = {};
    attendedLanpas?.forEach(l => {
      const gameId = (l.lanpa as any)?.selected_game_id;
      if (gameId) {
        gameCounts[gameId] = (gameCounts[gameId] || 0) + 1;
      }
    });

    const topGameIds = Object.entries(gameCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([gameId]) => gameId);

    let favoriteGames: any[] = [];
    if (topGameIds.length > 0) {
      const { data: games } = await db()
        .from('games')
        .select('*')
        .in('id', topGameIds);

      favoriteGames = (games || []).map(g => ({
        ...g,
        times_played: gameCounts[g.id] || 0,
        average_rating: null,
      })).sort((a, b) => b.times_played - a.times_played);
    }

    // Punishments
    const { data: punishments } = await db()
      .from('user_punishments')
      .select(`
        *,
        punishment:punishments(*),
        lanpa:lanpas(id, name)
      `)
      .eq('user_id', id)
      .order('applied_at', { ascending: false });

    return res.json({
      data: {
        user,
        lanpas_hosted: lanpasHosted || 0,
        lanpas_attended: lanpasAttended || 0,
        average_rating_as_admin: avgRatingAsAdmin,
        average_rating_as_member: avgRatingAsMember,
        favorite_games: favoriteGames,
        punishments: punishments || [],
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
