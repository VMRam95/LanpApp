import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { MemberStatus, NotificationType } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, ForbiddenError, BadRequestError, notifyUsers } from '../../_lib';
import { db } from '../../_lib/supabase';

const inviteUsersSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
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

  if (req.method !== 'POST') {
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
      throw new ForbiddenError('Only the admin can invite users');
    }

    const { user_ids } = validate(inviteUsersSchema, req.body);

    const { data: lanpa } = await db()
      .from('lanpas')
      .select('name')
      .eq('id', id)
      .single();

    // Create member entries
    const members = user_ids.map((userId: string) => ({
      lanpa_id: id,
      user_id: userId,
      status: MemberStatus.INVITED,
    }));

    const { data: created, error } = await db()
      .from('lanpa_members')
      .upsert(members, { onConflict: 'lanpa_id,user_id', ignoreDuplicates: true })
      .select();

    if (error) {
      throw new BadRequestError('Failed to invite users');
    }

    // Notify invited users
    await notifyUsers(user_ids, {
      type: NotificationType.LANPA_INVITATION,
      title: 'Lanpa Invitation',
      body: `You have been invited to join ${lanpa?.name}!`,
      data: { lanpa_id: id },
    });

    return res.status(201).json({ data: created });
  } catch (error) {
    return handleError(error, res);
  }
}
