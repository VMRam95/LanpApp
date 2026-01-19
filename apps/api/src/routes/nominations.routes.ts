import { Router } from 'express';
import { z } from 'zod';
import { NominationStatus, MemberStatus, NotificationType } from '@lanpapp/shared';
import { db } from '../services/supabase.service.js';
import { notifyUser, notifyUsers } from '../services/notification.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../middleware/error.middleware.js';

export const nominationsRouter: Router = Router();

// Validation schemas
const createNominationSchema = z.object({
  lanpa_id: z.string().uuid(),
  punishment_id: z.string().uuid(),
  nominated_user_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  voting_hours: z.number().min(1).max(168).default(24), // 1 hour to 1 week
});

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

// POST /api/nominations
nominationsRouter.post('/', authenticate, validate(createNominationSchema), async (req, res, next) => {
  try {
    const { lanpa_id, punishment_id, nominated_user_id, reason, voting_hours } = req.body;

    // Check if nominator is a member of the lanpa
    if (!(await isLanpaMember(lanpa_id, req.userId!))) {
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
        nominated_by: req.userId,
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

    res.status(201).json({ data: nomination });
  } catch (error) {
    next(error);
  }
});

// GET /api/nominations/:id
nominationsRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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
    if (!(await isLanpaMember(nomination.lanpa_id, req.userId!))) {
      throw new ForbiddenError('You do not have access to this nomination');
    }

    // Calculate vote counts
    const votes = nomination.votes || [];
    const votesFor = votes.filter((v: any) => v.vote === true).length;
    const votesAgainst = votes.filter((v: any) => v.vote === false).length;

    res.json({
      data: {
        ...nomination,
        votes_for: votesFor,
        votes_against: votesAgainst,
        total_votes: votes.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/nominations/:id/vote
nominationsRouter.post('/:id/vote', authenticate, validate(voteSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;

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
    if (!(await isLanpaMember(nomination.lanpa_id, req.userId!))) {
      throw new ForbiddenError('Only lanpa members can vote');
    }

    // User cannot vote on their own nomination
    if (nomination.nominated_user_id === req.userId) {
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
        user_id: req.userId,
        vote,
      }, { onConflict: 'nomination_id,user_id' })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to submit vote');
    }

    res.json({ data: voteRecord });
  } catch (error) {
    next(error);
  }
});

// POST /api/nominations/:id/finalize - Manual finalization (or could be a cron job)
nominationsRouter.post('/:id/finalize', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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

    res.json({
      data: {
        nomination_id: id,
        status: newStatus,
        votes_for: votesFor,
        votes_against: votesAgainst,
        punishment_applied: isGuilty,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/lanpas/:lanpaId/nominations
nominationsRouter.get('/lanpa/:lanpaId', authenticate, async (req, res, next) => {
  try {
    const { lanpaId } = req.params;
    const { status } = req.query;

    // Check if user is member
    if (!(await isLanpaMember(lanpaId, req.userId!))) {
      throw new ForbiddenError('Only lanpa members can view nominations');
    }

    let query = db()
      .from('punishment_nominations')
      .select(`
        *,
        punishment:punishments(id, name, severity),
        nominated_user:users!punishment_nominations_nominated_user_id_fkey(id, username, display_name, avatar_url),
        nominated_by_user:users!punishment_nominations_nominated_by_fkey(id, username, display_name)
      `)
      .eq('lanpa_id', lanpaId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: nominations, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestError('Failed to fetch nominations');
    }

    res.json({ data: nominations });
  } catch (error) {
    next(error);
  }
});
