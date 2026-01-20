import type { VercelRequest, VercelResponse } from '@vercel/node';
import { LanpaStatus, MemberStatus } from '@lanpapp/shared';
import { cors, handleError, authenticate } from '../../_lib';
import { db } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);

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

    return res.json({
      data: {
        clean_ranking: cleanRanking,
        adjusted_ranking: adjustedRanking,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
