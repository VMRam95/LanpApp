import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { NominationStatus, MemberStatus } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, ForbiddenError, BadRequestError, NotFoundError } from '../../../_lib';
import { db } from '../../../_lib/supabase';

const voteSchema = z.object({
  vote: z.boolean(), // true = guilty, false = innocent
});

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Nomination ID is required');
    }

    const { vote } = validate(voteSchema, req.body);

    // Get nomination
    const { data: nomination } = await db()
      .from('punishment_nominations')
      .select('lanpa_id, nominated_user_id, status, voting_ends_at')
      .eq('id', id)
      .single();

    if (!nomination) {
      throw new NotFoundError('Nomination not found');
    }

    // Check if user is member
    if (!(await isLanpaMember(nomination.lanpa_id, userId))) {
      throw new ForbiddenError('Only lanpa members can vote');
    }

    // User cannot vote on their own nomination
    if (nomination.nominated_user_id === userId) {
      throw new ForbiddenError('You cannot vote on your own nomination');
    }

    // Check if voting is still open
    if (nomination.status !== NominationStatus.PENDING) {
      throw new BadRequestError('Voting for this nomination has ended');
    }

    if (new Date(nomination.voting_ends_at) < new Date()) {
      throw new BadRequestError('Voting period has expired');
    }

    // Upsert vote
    const { data: voteRecord, error } = await db()
      .from('punishment_votes')
      .upsert({
        nomination_id: id,
        user_id: userId,
        vote,
      }, { onConflict: 'nomination_id,user_id' })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to submit vote');
    }

    return res.json({ data: voteRecord });
  } catch (error) {
    return handleError(error, res);
  }
}
