import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberStatus } from '@lanpapp/shared';
import { cors, handleError, authenticate, ForbiddenError, NotFoundError, BadRequestError } from '../../../_lib';
import { db } from '../../../_lib/supabase';

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

  try {
    const { userId } = await authenticate(req);
    const { id, memberId } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Lanpa ID is required');
    }

    if (!memberId || typeof memberId !== 'string') {
      throw new BadRequestError('Member ID is required');
    }

    // Get member info
    const { data: member } = await db()
      .from('lanpa_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('lanpa_id', id)
      .single();

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    if (req.method === 'PATCH') {
      const { status } = req.body;

      // Users can only update their own status (confirm/decline invitation)
      // Admins can update any member status
      const isAdmin = await isLanpaAdmin(id, userId);
      const isOwnStatus = member.user_id === userId;

      if (!isAdmin && !isOwnStatus) {
        throw new ForbiddenError('You cannot update this member status');
      }

      // Validate status
      const validStatuses = [MemberStatus.CONFIRMED, MemberStatus.DECLINED, MemberStatus.ATTENDED];
      if (!validStatuses.includes(status)) {
        throw new BadRequestError('Invalid status');
      }

      const { data: updated, error } = await db()
        .from('lanpa_members')
        .update({ status })
        .eq('id', memberId)
        .select()
        .single();

      if (error) {
        throw new BadRequestError('Failed to update member status');
      }

      return res.json({ data: updated });
    }

    if (req.method === 'DELETE') {
      // Check if user is admin
      if (!(await isLanpaAdmin(id, userId))) {
        throw new ForbiddenError('Only the admin can remove members');
      }

      // Admin cannot remove themselves
      if (member.user_id === userId) {
        throw new BadRequestError('You cannot remove yourself from the lanpa');
      }

      // Delete the member
      const { error } = await db()
        .from('lanpa_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        throw new BadRequestError('Failed to remove member');
      }

      return res.json({ message: 'Member removed successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
