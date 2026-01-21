import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberStatus } from '../../../_lib/shared-types';
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
      throw new BadRequestError('Lanpa ID is required');
    }

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

    return res.json({
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
    return handleError(error, res);
  }
}
