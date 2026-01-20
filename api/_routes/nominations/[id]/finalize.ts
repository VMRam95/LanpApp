import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NominationStatus, NotificationType } from '@lanpapp/shared';
import { cors, handleError, authenticate, BadRequestError, NotFoundError, notifyUser } from '../../../_lib';
import { db } from '../../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Nomination ID is required');
    }

    // Get nomination with votes
    const { data: nomination } = await db()
      .from('punishment_nominations')
      .select(`
        *,
        punishment:punishments(*),
        nominated_user:users!punishment_nominations_nominated_user_id_fkey(id, username, display_name),
        votes:punishment_votes(vote)
      `)
      .eq('id', id)
      .single();

    if (!nomination) {
      throw new NotFoundError('Nomination not found');
    }

    if (nomination.status !== NominationStatus.PENDING) {
      throw new BadRequestError('Nomination has already been finalized');
    }

    // Check if voting period has ended
    if (new Date(nomination.voting_ends_at) > new Date()) {
      throw new BadRequestError('Voting period has not ended yet');
    }

    // Count votes
    const votes = nomination.votes || [];
    const votesFor = votes.filter((v: any) => v.vote === true).length;
    const votesAgainst = votes.filter((v: any) => v.vote === false).length;

    // Determine outcome (majority wins)
    const isGuilty = votesFor > votesAgainst;
    const newStatus = isGuilty ? NominationStatus.APPROVED : NominationStatus.REJECTED;

    // Update nomination status
    await db()
      .from('punishment_nominations')
      .update({ status: newStatus })
      .eq('id', id);

    // If guilty, apply punishment
    if (isGuilty) {
      await db()
        .from('user_punishments')
        .insert({
          user_id: nomination.nominated_user_id,
          punishment_id: nomination.punishment_id,
          lanpa_id: nomination.lanpa_id,
          nomination_id: id,
          notes: `Voted guilty by ${votesFor} to ${votesAgainst}`,
        });
    }

    // Notify nominated user of outcome
    await notifyUser(nomination.nominated_user_id, {
      type: NotificationType.PUNISHMENT_VOTING_ENDED,
      title: isGuilty ? 'Punishment Applied' : 'Punishment Rejected',
      body: isGuilty
        ? `The community voted: you received the "${nomination.punishment.name}" punishment`
        : `The community voted: you were found innocent`,
      data: { nomination_id: id, lanpa_id: nomination.lanpa_id },
    });

    return res.json({
      data: {
        nomination_id: id,
        status: newStatus,
        votes_for: votesFor,
        votes_against: votesAgainst,
        punishment_applied: isGuilty,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
