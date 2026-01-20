import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { LanpaStatus } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, ForbiddenError, NotFoundError, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

const selectGameSchema = z.object({
  game_id: z.string().uuid(),
});

// Helper to check if user is admin
const isLanpaAdmin = async (lanpaId: string, userId: string): Promise<boolean> => {
  const { data } = await db()
    .from('lanpas')
    .select('admin_id')
    .eq('id', lanpaId)
    .single();
  return data?.admin_id === userId;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Lanpa ID is required');
    }

    // Check if user is admin
    if (!(await isLanpaAdmin(id, userId))) {
      throw new ForbiddenError('Only the admin can select a game');
    }

    const { game_id } = validate(selectGameSchema, req.body);

    // Check lanpa status - only allow in in_progress
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('status')
      .eq('id', id)
      .single();

    if (!lanpa) {
      throw new NotFoundError('Lanpa not found');
    }

    if (lanpa.status !== LanpaStatus.IN_PROGRESS) {
      throw new BadRequestError('Game selection is only allowed when the lanpa is in progress');
    }

    // Check if game was suggested for this lanpa
    const { data: suggestion } = await db()
      .from('game_suggestions')
      .select('id')
      .eq('lanpa_id', id)
      .eq('game_id', game_id)
      .single();

    if (!suggestion) {
      throw new BadRequestError('This game was not suggested for this lanpa');
    }

    // Update selected game
    const { data: updated, error } = await db()
      .from('lanpas')
      .update({
        selected_game_id: game_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        selected_game:games(*)
      `)
      .single();

    if (error) {
      throw new BadRequestError('Failed to select game');
    }

    return res.json({ data: updated });
  } catch (error) {
    return handleError(error, res);
  }
}
