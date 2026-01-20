import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { LanpaStatus, MemberStatus, NotificationType } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, ForbiddenError, BadRequestError, notifyUser } from '../../../_lib';
import { db } from '../../../_lib/supabase';

const rateSchema = z.object({
  ratings: z.array(z.object({
    to_user_id: z.string().uuid().optional(),
    score: z.number().min(1).max(5),
    comment: z.string().max(500).optional(),
  })),
  lanpa_rating: z.object({
    score: z.number().min(1).max(5),
    comment: z.string().max(500).optional(),
  }).optional(),
});

// Helper to check if user is member
const isLanpaMember = async (lanpaId: string, userId: string): Promise<boolean> => {
  const { data: lanpa } = await db()
    .from('lanpas')
    .select('admin_id')
    .eq('id', lanpaId)
    .single();

  if (lanpa?.admin_id === userId) return true;

  const { data: member } = await db()
    .from('lanpa_members')
    .select('id')
    .eq('lanpa_id', lanpaId)
    .eq('user_id', userId)
    .in('status', [MemberStatus.CONFIRMED, MemberStatus.ATTENDED])
    .single();

  return !!member;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Lanpa ID is required');
    }

    // Check if user is member
    if (!(await isLanpaMember(id, userId))) {
      throw new ForbiddenError('Only members can rate');
    }

    const { ratings, lanpa_rating } = validate(rateSchema, req.body);

    // Check lanpa status
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('status, admin_id')
      .eq('id', id)
      .single();

    if (lanpa?.status !== LanpaStatus.COMPLETED) {
      throw new BadRequestError('Ratings are only allowed for completed lanpas');
    }

    const isAdmin = lanpa.admin_id === userId;

    // Create member ratings
    if (ratings && ratings.length > 0) {
      const ratingEntries = ratings.map((r: any) => ({
        lanpa_id: id,
        from_user_id: userId,
        to_user_id: r.to_user_id,
        rating_type: isAdmin
          ? 'admin_to_member'
          : r.to_user_id === lanpa.admin_id
            ? 'member_to_admin'
            : 'member_to_member',
        score: r.score,
        comment: r.comment,
      }));

      await db()
        .from('ratings')
        .upsert(ratingEntries, { onConflict: 'lanpa_id,from_user_id,to_user_id' });

      // Notify rated users
      for (const r of ratings) {
        if (r.to_user_id) {
          await notifyUser(r.to_user_id, {
            type: NotificationType.RATING_RECEIVED,
            title: 'New Rating',
            body: `You received a ${r.score}-star rating!`,
            data: { lanpa_id: id },
          });
        }
      }
    }

    // Create lanpa rating
    if (lanpa_rating) {
      await db()
        .from('lanpa_ratings')
        .upsert({
          lanpa_id: id,
          user_id: userId,
          score: lanpa_rating.score,
          comment: lanpa_rating.comment,
        }, { onConflict: 'lanpa_id,user_id' });
    }

    return res.json({ message: 'Ratings submitted successfully' });
  } catch (error) {
    return handleError(error, res);
  }
}
