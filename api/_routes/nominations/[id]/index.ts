import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberStatus } from '../../../_lib/shared-types';
import { cors, handleError, authenticate, ForbiddenError, BadRequestError, NotFoundError } from '../../../_lib';
import { db } from '../../../_lib/supabase';

// Helper to check if user is member of lanpa
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Nomination ID is required');
    }

    const { data: nomination, error } = await db()
      .from('punishment_nominations')
      .select(`
        *,
        punishment:punishments(*),
        nominated_user:users!punishment_nominations_nominated_user_id_fkey(id, username, display_name, avatar_url),
        nominated_by_user:users!punishment_nominations_nominated_by_fkey(id, username, display_name),
        votes:punishment_votes(
          id,
          vote,
          user:users(id, username, display_name)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !nomination) {
      throw new NotFoundError('Nomination not found');
    }

    // Check if user has access (is member of lanpa)
    if (!(await isLanpaMember(nomination.lanpa_id, userId))) {
      throw new ForbiddenError('You do not have access to this nomination');
    }

    // Calculate vote counts
    const votes = nomination.votes || [];
    const votesFor = votes.filter((v: any) => v.vote === true).length;
    const votesAgainst = votes.filter((v: any) => v.vote === false).length;

    return res.json({
      data: {
        ...nomination,
        votes_for: votesFor,
        votes_against: votesAgainst,
        total_votes: votes.length,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
