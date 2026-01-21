import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { LanpaStatus, MemberStatus, NotificationType } from '../../../_lib/shared-types';
import { cors, handleError, validate, authenticate, NotFoundError, ForbiddenError, BadRequestError, notifyUsers } from '../../../_lib';
import { db } from '../../../_lib/supabase';

// Custom datetime validator
const datetimeString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid datetime format' }
);

const updateLanpaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  scheduled_date: datetimeString.nullable().optional(),
  actual_date: datetimeString.nullable().optional(),
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

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new NotFoundError('Lanpa ID is required');
    }

    if (req.method === 'GET') {
      const { data: lanpa, error } = await db()
        .from('lanpas')
        .select(`
          *,
          admin:users!lanpas_admin_id_fkey(id, username, display_name, avatar_url),
          members:lanpa_members(
            id,
            status,
            joined_at,
            user:users(id, username, display_name, avatar_url)
          ),
          selected_game:games(*)
        `)
        .eq('id', id)
        .single();

      if (error || !lanpa) {
        throw new NotFoundError('Lanpa not found');
      }

      // Check if user has access
      const hasAccess = await isLanpaMember(id, userId);
      if (!hasAccess) {
        throw new ForbiddenError('You do not have access to this lanpa');
      }

      // Get game suggestions if in voting phase
      if (lanpa.status === LanpaStatus.VOTING_GAMES || lanpa.status === LanpaStatus.VOTING_ACTIVE) {
        const { data: suggestions } = await db()
          .from('game_suggestions')
          .select(`
            *,
            game:games(*),
            suggested_by_user:users!game_suggestions_suggested_by_fkey(id, username, display_name)
          `)
          .eq('lanpa_id', id);

        (lanpa as any).game_suggestions = suggestions;
      }

      // Get votes if in active voting phase
      if (lanpa.status === LanpaStatus.VOTING_ACTIVE) {
        const { data: votes } = await db()
          .from('game_votes')
          .select('game_id, user_id')
          .eq('lanpa_id', id);

        (lanpa as any).game_votes = votes;
      }

      return res.json({ data: lanpa });
    }

    if (req.method === 'PATCH') {
      // Check if user is admin
      if (!(await isLanpaAdmin(id, userId))) {
        throw new ForbiddenError('Only the admin can update this lanpa');
      }

      const updates = validate(updateLanpaSchema, req.body);

      const { data: lanpas, error } = await db()
        .from('lanpas')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(`
          *,
          admin:users!lanpas_admin_id_fkey(id, username, display_name, avatar_url)
        `);

      if (error) {
        throw new BadRequestError('Failed to update lanpa');
      }

      if (!lanpas || lanpas.length === 0) {
        throw new NotFoundError('Lanpa not found or could not be updated');
      }

      const lanpa = lanpas[0];

      // Notify members about update
      const { data: members } = await db()
        .from('lanpa_members')
        .select('user_id')
        .eq('lanpa_id', id)
        .in('status', [MemberStatus.CONFIRMED, MemberStatus.ATTENDED]);

      if (members && members.length > 0) {
        await notifyUsers(
          members.map(m => m.user_id),
          {
            type: NotificationType.LANPA_UPDATED,
            title: 'Lanpa Updated',
            body: `${lanpa.name} has been updated`,
            data: { lanpa_id: id },
          }
        );
      }

      return res.json({ data: lanpa });
    }

    if (req.method === 'DELETE') {
      // Check if user is admin
      if (!(await isLanpaAdmin(id, userId))) {
        throw new ForbiddenError('Only the admin can delete this lanpa');
      }

      const { data: deletedLanpas, error } = await db()
        .from('lanpas')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        throw new BadRequestError('Failed to delete lanpa');
      }

      if (!deletedLanpas || deletedLanpas.length === 0) {
        throw new NotFoundError('Lanpa not found or could not be deleted');
      }

      return res.json({ message: 'Lanpa deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
