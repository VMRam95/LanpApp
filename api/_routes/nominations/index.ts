import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { NominationStatus, MemberStatus, NotificationType } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, ForbiddenError, BadRequestError, NotFoundError, notifyUser, notifyUsers } from '../../_lib';
import { db } from '../../_lib/supabase';

const createNominationSchema = z.object({
  lanpa_id: z.string().uuid(),
  punishment_id: z.string().uuid(),
  nominated_user_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  voting_hours: z.number().min(1).max(168).default(24), // 1 hour to 1 week
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

    const { lanpa_id, punishment_id, nominated_user_id, reason, voting_hours } = validate(createNominationSchema, req.body);

    // Check if nominator is a member of the lanpa
    if (!(await isLanpaMember(lanpa_id, userId))) {
      throw new ForbiddenError('Only lanpa members can nominate');
    }

    // Check if nominated user is a member of the lanpa
    if (!(await isLanpaMember(lanpa_id, nominated_user_id))) {
      throw new BadRequestError('Nominated user is not a member of this lanpa');
    }

    // Check if punishment exists
    const { data: punishment } = await db()
      .from('punishments')
      .select('name')
      .eq('id', punishment_id)
      .single();

    if (!punishment) {
      throw new NotFoundError('Punishment not found');
    }

    // Check for existing pending nomination for same user and punishment in this lanpa
    const { data: existing } = await db()
      .from('punishment_nominations')
      .select('id')
      .eq('lanpa_id', lanpa_id)
      .eq('punishment_id', punishment_id)
      .eq('nominated_user_id', nominated_user_id)
      .eq('status', NominationStatus.PENDING)
      .single();

    if (existing) {
      throw new BadRequestError('A pending nomination already exists for this user and punishment');
    }

    const votingEndsAt = new Date(Date.now() + voting_hours * 60 * 60 * 1000);

    const { data: nomination, error } = await db()
      .from('punishment_nominations')
      .insert({
        lanpa_id,
        punishment_id,
        nominated_user_id,
        nominated_by: userId,
        reason,
        status: NominationStatus.PENDING,
        voting_ends_at: votingEndsAt.toISOString(),
      })
      .select(`
        *,
        punishment:punishments(*),
        nominated_user:users!punishment_nominations_nominated_user_id_fkey(id, username, display_name, avatar_url),
        nominated_by_user:users!punishment_nominations_nominated_by_fkey(id, username, display_name)
      `)
      .single();

    if (error) {
      throw new BadRequestError('Failed to create nomination');
    }

    // Get lanpa name for notification
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('name, admin_id')
      .eq('id', lanpa_id)
      .single();

    // Notify nominated user
    await notifyUser(nominated_user_id, {
      type: NotificationType.PUNISHMENT_NOMINATION,
      title: 'Punishment Nomination',
      body: `You have been nominated for "${punishment.name}" in ${lanpa?.name}`,
      data: { nomination_id: nomination.id, lanpa_id },
    });

    // Notify all lanpa members
    const { data: members } = await db()
      .from('lanpa_members')
      .select('user_id')
      .eq('lanpa_id', lanpa_id)
      .in('status', [MemberStatus.CONFIRMED, MemberStatus.ATTENDED])
      .neq('user_id', nominated_user_id);

    const memberIds = members?.map(m => m.user_id) || [];
    if (lanpa?.admin_id && lanpa.admin_id !== nominated_user_id && !memberIds.includes(lanpa.admin_id)) {
      memberIds.push(lanpa.admin_id);
    }

    await notifyUsers(memberIds, {
      type: NotificationType.PUNISHMENT_NOMINATION,
      title: 'New Punishment Vote',
      body: `A punishment nomination is open for voting in ${lanpa?.name}`,
      data: { nomination_id: nomination.id, lanpa_id },
    });

    return res.status(201).json({ data: nomination });
  } catch (error) {
    return handleError(error, res);
  }
}
