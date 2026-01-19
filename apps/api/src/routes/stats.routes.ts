import { Router } from 'express';
import { LanpaStatus, MemberStatus } from '@lanpapp/shared';
import { db } from '../services/supabase.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { BadRequestError, NotFoundError } from '../middleware/error.middleware.js';

export const statsRouter: Router = Router();

// GET /api/stats/personal
statsRouter.get('/personal', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.id;

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

    res.json({
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
    next(error);
  }
});

// GET /api/stats/global
statsRouter.get('/global', authenticate, async (req, res, next) => {
  try {
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
        average_rating: null, // TODO: Calculate
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

    res.json({
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
    next(error);
  }
});

// GET /api/stats/lanpas/:id
statsRouter.get('/lanpas/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get lanpa
    const { data: lanpa, error } = await db()
      .from('lanpas')
      .select(`
        *,
        selected_game:games(*)
      `)
      .eq('id', id)
      .single();

    if (error || !lanpa) {
      throw new NotFoundError('Lanpa not found');
    }

    // Attendance count
    const { count: attendanceCount } = await db()
      .from('lanpa_members')
      .select('id', { count: 'exact', head: true })
      .eq('lanpa_id', id)
      .eq('status', MemberStatus.ATTENDED);

    // Average admin rating
    const { data: adminRatings } = await db()
      .from('ratings')
      .select('score')
      .eq('lanpa_id', id)
      .eq('rating_type', 'member_to_admin');

    const avgAdminRating = adminRatings && adminRatings.length > 0
      ? adminRatings.reduce((sum, r) => sum + r.score, 0) / adminRatings.length
      : null;

    // Average member rating
    const { data: memberRatings } = await db()
      .from('ratings')
      .select('score')
      .eq('lanpa_id', id)
      .in('rating_type', ['admin_to_member', 'member_to_member']);

    const avgMemberRating = memberRatings && memberRatings.length > 0
      ? memberRatings.reduce((sum, r) => sum + r.score, 0) / memberRatings.length
      : null;

    // Average lanpa rating
    const { data: lanpaRatings } = await db()
      .from('lanpa_ratings')
      .select('score')
      .eq('lanpa_id', id);

    const avgLanpaRating = lanpaRatings && lanpaRatings.length > 0
      ? lanpaRatings.reduce((sum, r) => sum + r.score, 0) / lanpaRatings.length
      : null;

    // Punishments given
    const { count: punishmentsGiven } = await db()
      .from('user_punishments')
      .select('id', { count: 'exact', head: true })
      .eq('lanpa_id', id);

    res.json({
      data: {
        lanpa,
        attendance_count: attendanceCount || 0,
        average_admin_rating: avgAdminRating,
        average_member_rating: avgMemberRating,
        average_lanpa_rating: avgLanpaRating,
        games_played: lanpa.selected_game ? [lanpa.selected_game] : [],
        punishments_given: punishmentsGiven || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/stats/users/:id
statsRouter.get('/users/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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

    res.json({
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
    next(error);
  }
});

// GET /api/stats/rankings
statsRouter.get('/rankings', authenticate, async (req, res, next) => {
  try {
    // Get all users with their stats
    const { data: users } = await db()
      .from('users')
      .select('id, username, display_name, avatar_url');

    if (!users || users.length === 0) {
      return res.json({
        data: {
          clean_ranking: [],
          adjusted_ranking: [],
        },
      });
    }

    // Calculate stats for each user
    const userStats = await Promise.all(
      users.map(async (user) => {
        // Lanpas attended
        const { count: lanpasAttended } = await db()
          .from('lanpa_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', MemberStatus.ATTENDED);

        // Also count as admin
        const { count: lanpasHosted } = await db()
          .from('lanpas')
          .select('id', { count: 'exact', head: true })
          .eq('admin_id', user.id)
          .eq('status', LanpaStatus.COMPLETED);

        // Average rating (all types received)
        const { data: ratings } = await db()
          .from('ratings')
          .select('score')
          .eq('to_user_id', user.id);

        const avgRating = ratings && ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
          : null;

        // Total point impact from punishments
        const { data: punishments } = await db()
          .from('user_punishments')
          .select('punishment:punishments(point_impact)')
          .eq('user_id', user.id);

        const totalPointImpact = punishments?.reduce(
          (sum, p) => sum + ((p.punishment as any)?.point_impact || 0),
          0
        ) || 0;

        // Calculate score: (lanpas_attended * 10) + (avg_rating * 20)
        const totalLanpas = (lanpasAttended || 0) + (lanpasHosted || 0);
        const baseScore = totalLanpas * 10 + (avgRating || 3) * 20;

        return {
          user,
          lanpas_attended: totalLanpas,
          average_rating: avgRating,
          clean_score: baseScore,
          adjusted_score: Math.max(0, baseScore - totalPointImpact),
          point_impact: totalPointImpact,
        };
      })
    );

    // Filter users with activity (at least 1 lanpa attended/hosted)
    const activeUsers = userStats.filter(stats => stats.lanpas_attended > 0);

    // Sort for clean ranking
    const cleanRanking = [...activeUsers]
      .sort((a, b) => b.clean_score - a.clean_score)
      .map((stats, index) => ({
        rank: index + 1,
        user: stats.user,
        score: Math.round(stats.clean_score * 10) / 10,
        lanpas_attended: stats.lanpas_attended,
        average_rating: stats.average_rating ? Math.round(stats.average_rating * 10) / 10 : null,
      }));

    // Sort for adjusted ranking
    const adjustedRanking = [...activeUsers]
      .sort((a, b) => b.adjusted_score - a.adjusted_score)
      .map((stats, index) => ({
        rank: index + 1,
        user: stats.user,
        score: Math.round(stats.adjusted_score * 10) / 10,
        lanpas_attended: stats.lanpas_attended,
        average_rating: stats.average_rating ? Math.round(stats.average_rating * 10) / 10 : null,
      }));

    res.json({
      data: {
        clean_ranking: cleanRanking,
        adjusted_ranking: adjustedRanking,
      },
    });
  } catch (error) {
    next(error);
  }
});
