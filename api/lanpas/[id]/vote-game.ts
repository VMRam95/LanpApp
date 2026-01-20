import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { LanpaStatus, MemberStatus } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, ForbiddenError, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

const voteGameSchema = z.object({
  game_id: z.string().uuid(),
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
      throw new ForbiddenError('Only members can vote');
    }

    const { game_id } = validate(voteGameSchema, req.body);

    // Check lanpa status
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('status')
      .eq('id', id)
      .single();

    if (lanpa?.status !== LanpaStatus.VOTING_ACTIVE) {
      throw new BadRequestError('Voting is not open for this lanpa');
    }

    // Check if game is in suggestions
    const { data: suggestion } = await db()
      .from('game_suggestions')
      .select('id')
      .eq('lanpa_id', id)
      .eq('game_id', game_id)
      .single();

    if (!suggestion) {
      throw new BadRequestError('This game was not suggested for this lanpa');
    }

    // Upsert vote (one vote per user)
    const { data: vote, error } = await db()
      .from('game_votes')
      .upsert({
        lanpa_id: id,
        game_id,
        user_id: userId,
      }, { onConflict: 'lanpa_id,user_id' })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to vote');
    }

    return res.json({ data: vote });
  } catch (error) {
    return handleError(error, res);
  }
}
