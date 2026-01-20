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
    await authenticate(req);

    // Total lanpas
    const { count: totalLanpas } = await db()
      .from('lanpas')
      .select('id', { count: 'exact', head: true });

    // Total users
    const { count: totalUsers } = await db()
      .from('users')
      .select('id', { count: 'exact', head: true });

    // Total games played (completed lanpas with selected game)
    const { count: totalGamesPlayed } = await db()
      .from('lanpas')
      .select('id', { count: 'exact', head: true })
      .eq('status', LanpaStatus.COMPLETED)
      .not('selected_game_id', 'is', null);

    // Most frequent admin
    const { data: adminStats } = await db()
      .from('lanpas')
      .select('admin_id')
      .eq('status', LanpaStatus.COMPLETED);

    const adminCounts: Record<string, number> = {};
    adminStats?.forEach(l => {
      adminCounts[l.admin_id] = (adminCounts[l.admin_id] || 0) + 1;
    });

    let mostFrequentAdmin = null;
    const topAdminId = Object.entries(adminCounts).sort(([, a], [, b]) => b - a)[0];
    if (topAdminId) {
      const { data: admin } = await db()
        .from('users')
        .select('id, username, display_name, avatar_url')
        .eq('id', topAdminId[0])
        .single();

      if (admin) {
        mostFrequentAdmin = { user: admin, lanpas_hosted: topAdminId[1] };
      }
    }

    // Most attended member
    const { data: memberStats } = await db()
      .from('lanpa_members')
      .select('user_id, lanpa:lanpas!inner(status)')
      .eq('status', MemberStatus.ATTENDED);

    const memberCounts: Record<string, number> = {};
    memberStats?.forEach(m => {
      if ((m.lanpa as any)?.status === LanpaStatus.COMPLETED) {
        memberCounts[m.user_id] = (memberCounts[m.user_id] || 0) + 1;
      }
    });

    let mostAttendedMember = null;
    const topMemberId = Object.entries(memberCounts).sort(([, a], [, b]) => b - a)[0];
    if (topMemberId) {
      const { data: member } = await db()
        .from('users')
        .select('id, username, display_name, avatar_url')
        .eq('id', topMemberId[0])
        .single();

      if (member) {
        mostAttendedMember = { user: member, lanpas_attended: topMemberId[1] };
      }
    }

    // Best rated admin
    const { data: adminRatings } = await db()
      .from('ratings')
      .select('to_user_id, score')
      .eq('rating_type', 'member_to_admin');

    const adminRatingTotals: Record<string, { sum: number; count: number }> = {};
    adminRatings?.forEach(r => {
      if (!adminRatingTotals[r.to_user_id]) {
        adminRatingTotals[r.to_user_id] = { sum: 0, count: 0 };
      }
      adminRatingTotals[r.to_user_id].sum += r.score;
      adminRatingTotals[r.to_user_id].count++;
    });

    let bestRatedAdmin = null;
    const adminAverages = Object.entries(adminRatingTotals)
      .map(([id, { sum, count }]) => ({ id, avg: sum / count }))
      .filter(a => adminRatingTotals[a.id].count >= 3) // Minimum 3 ratings
      .sort((a, b) => b.avg - a.avg);

    if (adminAverages.length > 0) {
      const { data: admin } = await db()
        .from('users')
        .select('id, username, display_name, avatar_url')
        .eq('id', adminAverages[0].id)
        .single();

      if (admin) {
        bestRatedAdmin = { user: admin, average_rating: adminAverages[0].avg };
      }
    }

    // Most played games
    const { data: gameCounts } = await db()
      .from('lanpas')
      .select('selected_game_id')
      .eq('status', LanpaStatus.COMPLETED)
      .not('selected_game_id', 'is', null);

    const gamePlayCounts: Record<string, number> = {};
    gameCounts?.forEach(l => {
      if (l.selected_game_id) {
        gamePlayCounts[l.selected_game_id] = (gamePlayCounts[l.selected_game_id] || 0) + 1;
      }
    });

    const topGameIds = Object.entries(gamePlayCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    let mostPlayedGames: any[] = [];
    if (topGameIds.length > 0) {
      const { data: games } = await db()
        .from('games')
        .select('*')
        .in('id', topGameIds);

      mostPlayedGames = (games || []).map(g => ({
        ...g,
        times_played: gamePlayCounts[g.id] || 0,
        average_rating: null,
      })).sort((a, b) => b.times_played - a.times_played);
    }

    // Hall of Shame (most punishments)
    const { data: punishmentStats } = await db()
      .from('user_punishments')
      .select(`
        user_id,
        punishment:punishments(point_impact)
      `);

    const userPunishments: Record<string, { count: number; impact: number }> = {};
    punishmentStats?.forEach(p => {
      if (!userPunishments[p.user_id]) {
        userPunishments[p.user_id] = { count: 0, impact: 0 };
      }
      userPunishments[p.user_id].count++;
      userPunishments[p.user_id].impact += (p.punishment as any)?.point_impact || 0;
    });

    const hallOfShameIds = Object.entries(userPunishments)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5);

    let hallOfShame: any[] = [];
    if (hallOfShameIds.length > 0) {
      const { data: users } = await db()
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', hallOfShameIds.map(([id]) => id));

      hallOfShame = (users || []).map(u => ({
        user: u,
        total_punishments: userPunishments[u.id].count,
        total_point_impact: userPunishments[u.id].impact,
      })).sort((a, b) => b.total_punishments - a.total_punishments);
    }

    return res.json({
      data: {
        total_lanpas: totalLanpas || 0,
        total_users: totalUsers || 0,
        total_games_played: totalGamesPlayed || 0,
        most_frequent_admin: mostFrequentAdmin,
        most_attended_member: mostAttendedMember,
        best_rated_admin: bestRatedAdmin,
        most_played_games: mostPlayedGames,
        hall_of_shame: hallOfShame,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
