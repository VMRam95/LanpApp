import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { LanpaStatus, MemberStatus } from '../../../_lib/shared-types';
import { cors, handleError, validate, authenticate, ForbiddenError, NotFoundError, ConflictError, BadRequestError } from '../../../_lib';
import { db } from '../../../_lib/supabase';

const suggestGameSchema = z.object({
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
      throw new ForbiddenError('Only members can suggest games');
    }

    const { game_id } = validate(suggestGameSchema, req.body);

    // Check lanpa status
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('status')
      .eq('id', id)
      .single();

    if (lanpa?.status !== LanpaStatus.VOTING_GAMES) {
      throw new BadRequestError('Game suggestions are not open for this lanpa');
    }

    // Check if game exists
    const { data: game } = await db()
      .from('games')
      .select('id')
      .eq('id', game_id)
      .single();

    if (!game) {
      throw new NotFoundError('Game not found');
    }

    // Check if already suggested
    const { data: existing } = await db()
      .from('game_suggestions')
      .select('id')
      .eq('lanpa_id', id)
      .eq('game_id', game_id)
      .single();

    if (existing) {
      throw new ConflictError('This game has already been suggested');
    }

    const { data: suggestion, error } = await db()
      .from('game_suggestions')
      .insert({
        lanpa_id: id,
        game_id,
        suggested_by: userId,
      })
      .select(`
        *,
        game:games(*),
        suggested_by_user:users!game_suggestions_suggested_by_fkey(id, username, display_name)
      `)
      .single();

    if (error) {
      throw new BadRequestError('Failed to suggest game');
    }

    return res.status(201).json({ data: suggestion });
  } catch (error) {
    return handleError(error, res);
  }
}
