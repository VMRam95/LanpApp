import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import {
  LanpaStatus,
  MemberStatus,
  NotificationType,
  type CreateLanpaRequest,
  type GameVoteResult,
} from '@lanpapp/shared';
import { getRandomItem } from '@lanpapp/shared';
import { db } from '../services/supabase.service.js';
import { notifyUser, notifyUsers, sendEmailNotification } from '../services/notification.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../middleware/error.middleware.js';

export const lanpasRouter: Router = Router();

// Validation schemas
// Custom datetime validator that accepts both ISO 8601 with/without Z suffix
const datetimeString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid datetime format' }
);

const createLanpaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  scheduled_date: datetimeString.optional(),
  is_historical: z.boolean().default(false),
});

const updateLanpaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  scheduled_date: datetimeString.nullable().optional(),
  actual_date: datetimeString.nullable().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(LanpaStatus),
});

const inviteUsersSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
});

const inviteLinkSchema = z.object({
  expires_in_hours: z.number().min(1).max(168).default(24), // 1 hour to 1 week
  max_uses: z.number().min(1).max(100).nullable().optional(),
});

const inviteByEmailSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
});

const suggestGameSchema = z.object({
  game_id: z.string().uuid(),
});

const voteGameSchema = z.object({
  game_id: z.string().uuid(),
});

const rateSchema = z.object({
  ratings: z.array(z.object({
    to_user_id: z.string().uuid().optional(),
    score: z.number().min(1).max(5),
    comment: z.string().max(500).optional(),
  })),
  lanpa_rating: z.object({
    score: z.number().min(1).max(5),
    comment: z.string().max(500).optional(),
  }).optional(),
});

// Helper to check if user is admin of lanpa
const isLanpaAdmin = async (lanpaId: string, userId: string): Promise<boolean> => {
  const { data } = await db()
    .from('lanpas')
    .select('admin_id')
    .eq('id', lanpaId)
    .single();
  return data?.admin_id === userId;
};

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

// GET /api/lanpas
lanpasRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // Get lanpas where user is admin or member
    let query = db()
      .from('lanpas')
      .select(`
        *,
        admin:users!lanpas_admin_id_fkey(id, username, display_name, avatar_url),
        members:lanpa_members(count)
      `, { count: 'exact' });

    // Filter by user's lanpas (admin or member)
    const { data: memberLanpaIds } = await db()
      .from('lanpa_members')
      .select('lanpa_id')
      .eq('user_id', req.userId)
      .in('status', [MemberStatus.INVITED, MemberStatus.CONFIRMED, MemberStatus.ATTENDED]);

    const lanpaIds = memberLanpaIds?.map(m => m.lanpa_id) || [];

    // Build OR filter for user's lanpas (admin or member)
    if (lanpaIds.length > 0) {
      query = query.or(`admin_id.eq.${req.userId},id.in.(${lanpaIds.join(',')})`);
    } else {
      query = query.eq('admin_id', req.userId);
    }

    // Handle comma-separated status values
    if (status) {
      const statuses = (status as string).split(',').map(s => s.trim());
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else {
        query = query.in('status', statuses);
      }
    }

    const { data: lanpas, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      throw new BadRequestError('Failed to fetch lanpas');
    }

    res.json({
      data: lanpas,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/lanpas
lanpasRouter.post('/', authenticate, validate(createLanpaSchema), async (req, res, next) => {
  try {
    const body = req.body as CreateLanpaRequest;

    const { data: lanpa, error } = await db()
      .from('lanpas')
      .insert({
        name: body.name,
        description: body.description,
        admin_id: req.userId,
        status: LanpaStatus.DRAFT,
        scheduled_date: body.scheduled_date,
        is_historical: body.is_historical,
      })
      .select(`
        *,
        admin:users!lanpas_admin_id_fkey(id, username, display_name, avatar_url)
      `)
      .single();

    if (error) {
      throw new BadRequestError('Failed to create lanpa');
    }

    // Add creator as confirmed member automatically
    await db()
      .from('lanpa_members')
      .insert({
        lanpa_id: lanpa.id,
        user_id: req.userId,
        status: MemberStatus.CONFIRMED,
      });

    res.status(201).json({ data: lanpa });
  } catch (error) {
    next(error);
  }
});

// GET /api/lanpas/:id
lanpasRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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
    const hasAccess = await isLanpaMember(id, req.userId!);
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

    res.json({ data: lanpa });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/lanpas/:id
lanpasRouter.patch('/:id', authenticate, validate(updateLanpaSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if user is admin
    if (!(await isLanpaAdmin(id, req.userId!))) {
      throw new ForbiddenError('Only the admin can update this lanpa');
    }

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

    res.json({ data: lanpa });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/lanpas/:id
lanpasRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    if (!(await isLanpaAdmin(id, req.userId!))) {
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

    res.json({ message: 'Lanpa deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/lanpas/:id/status
lanpasRouter.patch('/:id/status', authenticate, validate(updateStatusSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check if user is admin
    if (!(await isLanpaAdmin(id, req.userId!))) {
      throw new ForbiddenError('Only the admin can change lanpa status');
    }

    // Get current lanpa
    const { data: currentLanpa } = await db()
      .from('lanpas')
      .select('status, name')
      .eq('id', id)
      .single();

    if (!currentLanpa) {
      throw new NotFoundError('Lanpa not found');
    }

    // Validate status transition
    const validTransitions: Record<LanpaStatus, LanpaStatus[]> = {
      [LanpaStatus.DRAFT]: [LanpaStatus.VOTING_GAMES, LanpaStatus.IN_PROGRESS],
      [LanpaStatus.VOTING_GAMES]: [LanpaStatus.VOTING_ACTIVE, LanpaStatus.DRAFT],
      [LanpaStatus.VOTING_ACTIVE]: [LanpaStatus.IN_PROGRESS, LanpaStatus.VOTING_GAMES],
      [LanpaStatus.IN_PROGRESS]: [LanpaStatus.COMPLETED],
      [LanpaStatus.COMPLETED]: [],
    };

    if (!validTransitions[currentLanpa.status as LanpaStatus].includes(status)) {
      throw new BadRequestError(`Cannot transition from ${currentLanpa.status} to ${status}`);
    }

    // If transitioning to IN_PROGRESS from VOTING_ACTIVE, select winning game
    let selectedGameId = null;
    if (currentLanpa.status === LanpaStatus.VOTING_ACTIVE && status === LanpaStatus.IN_PROGRESS) {
      const results = await getGameVoteResults(id);
      if (results.winner) {
        selectedGameId = results.winner.id;
      }
    }

    const { data: lanpa, error } = await db()
      .from('lanpas')
      .update({
        status,
        ...(selectedGameId && { selected_game_id: selectedGameId }),
        ...(status === LanpaStatus.IN_PROGRESS && { actual_date: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to update status');
    }

    // Notify members based on status change
    const { data: members } = await db()
      .from('lanpa_members')
      .select('user_id')
      .eq('lanpa_id', id)
      .in('status', [MemberStatus.CONFIRMED, MemberStatus.ATTENDED]);

    if (members && members.length > 0) {
      let notificationType: NotificationType;
      let title: string;
      let body: string;

      switch (status) {
        case LanpaStatus.VOTING_GAMES:
          notificationType = NotificationType.GAME_VOTING_STARTED;
          title = 'Game Suggestions Open';
          body = `Suggest games for ${currentLanpa.name}!`;
          break;
        case LanpaStatus.VOTING_ACTIVE:
          notificationType = NotificationType.GAME_VOTING_STARTED;
          title = 'Voting Started';
          body = `Vote for your favorite game in ${currentLanpa.name}!`;
          break;
        case LanpaStatus.IN_PROGRESS:
          notificationType = NotificationType.GAME_VOTING_ENDED;
          title = 'Lanpa Started';
          body = `${currentLanpa.name} is now in progress!`;
          break;
        default:
          notificationType = NotificationType.LANPA_UPDATED;
          title = 'Lanpa Updated';
          body = `${currentLanpa.name} status changed to ${status}`;
      }

      await notifyUsers(
        members.map(m => m.user_id),
        { type: notificationType, title, body, data: { lanpa_id: id } }
      );
    }

    res.json({ data: lanpa });
  } catch (error) {
    next(error);
  }
});

// POST /api/lanpas/:id/invite-link
lanpasRouter.post('/:id/invite-link', authenticate, validate(inviteLinkSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { expires_in_hours, max_uses } = req.body;

    // Check if user is admin
    if (!(await isLanpaAdmin(id, req.userId!))) {
      throw new ForbiddenError('Only the admin can create invite links');
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);

    const { data: invitation, error } = await db()
      .from('lanpa_invitations')
      .insert({
        lanpa_id: id,
        token,
        expires_at: expiresAt.toISOString(),
        max_uses: max_uses || null,
        uses: 0,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to create invitation');
    }

    const link = `${process.env.FRONTEND_URL}/lanpas/join/${token}`;

    res.status(201).json({
      data: {
        invitation,
        link,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/lanpas/:id/invite-users
lanpasRouter.post('/:id/invite-users', authenticate, validate(inviteUsersSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_ids } = req.body;

    // Check if user is admin
    if (!(await isLanpaAdmin(id, req.userId!))) {
      throw new ForbiddenError('Only the admin can invite users');
    }

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

    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

// POST /api/lanpas/:id/invite-by-email
lanpasRouter.post('/:id/invite-by-email', authenticate, validate(inviteByEmailSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { emails } = req.body;

    // Check if user is admin
    if (!(await isLanpaAdmin(id, req.userId!))) {
      throw new ForbiddenError('Only the admin can invite users');
    }

    // Get lanpa details
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('name')
      .eq('id', id)
      .single();

    if (!lanpa) {
      throw new NotFoundError('Lanpa not found');
    }

    // Get current user (admin) for the invitation email
    const { data: admin } = await db()
      .from('users')
      .select('display_name, username')
      .eq('id', req.userId)
      .single();

    const adminName = admin?.display_name || admin?.username || 'Someone';

    // Generate a single invite token for email invitations (valid for 7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db()
      .from('lanpa_invitations')
      .insert({
        lanpa_id: id,
        token,
        expires_at: expiresAt.toISOString(),
        max_uses: null, // Unlimited uses
        uses: 0,
      });

    const inviteLink = `${process.env.FRONTEND_URL}/lanpas/join/${token}`;

    // Process each email
    const results: { email: string; status: 'sent' | 'invited_existing' | 'failed'; error?: string }[] = [];

    for (const email of emails) {
      try {
        // Check if user exists with this email
        const { data: existingUser } = await db()
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (existingUser) {
          // User exists - add them as invited member directly
          await db()
            .from('lanpa_members')
            .upsert({
              lanpa_id: id,
              user_id: existingUser.id,
              status: MemberStatus.INVITED,
            }, { onConflict: 'lanpa_id,user_id', ignoreDuplicates: true });

          // Notify the existing user
          await notifyUser(existingUser.id, {
            type: NotificationType.LANPA_INVITATION,
            title: 'Lanpa Invitation',
            body: `You have been invited to join ${lanpa.name}!`,
            data: { lanpa_id: id },
          });

          results.push({ email, status: 'invited_existing' });
        } else {
          // User doesn't exist - send email invitation
          await sendEmailNotification(
            email,
            `You're invited to join ${lanpa.name}!`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">You're invited to a Lanpa!</h2>
              <p>${adminName} has invited you to join <strong>${lanpa.name}</strong> on LanpApp.</p>
              <p>LanpApp is an app to organize and manage Lan Parties with friends.</p>
              <div style="margin: 30px 0;">
                <a href="${inviteLink}"
                   style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Join the Lanpa
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #4F46E5;">${inviteLink}</a>
              </p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This invitation link expires in 7 days.
              </p>
            </div>`
          );

          results.push({ email, status: 'sent' });
        }
      } catch (emailError) {
        console.error(`Failed to process email ${email}:`, emailError);
        results.push({ email, status: 'failed', error: 'Failed to send invitation' });
      }
    }

    res.status(201).json({ data: results });
  } catch (error) {
    next(error);
  }
});

// POST /api/lanpas/join/:token
lanpasRouter.post('/join/:token', authenticate, async (req, res, next) => {
  try {
    const { token } = req.params;

    // Find invitation
    const { data: invitation, error: inviteError } = await db()
      .from('lanpa_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
      throw new NotFoundError('Invalid invitation link');
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      throw new BadRequestError('Invitation link has expired');
    }

    // Check max uses
    if (invitation.max_uses && invitation.uses >= invitation.max_uses) {
      throw new BadRequestError('Invitation link has reached maximum uses');
    }

    // Check if already a member
    const { data: existingMember } = await db()
      .from('lanpa_members')
      .select('id, status')
      .eq('lanpa_id', invitation.lanpa_id)
      .eq('user_id', req.userId)
      .single();

    if (existingMember) {
      // If already invited, update to confirmed
      if (existingMember.status === MemberStatus.INVITED) {
        await db()
          .from('lanpa_members')
          .update({ status: MemberStatus.CONFIRMED })
          .eq('id', existingMember.id);
      }
    } else {
      // Create new member
      await db()
        .from('lanpa_members')
        .insert({
          lanpa_id: invitation.lanpa_id,
          user_id: req.userId,
          status: MemberStatus.CONFIRMED,
        });
    }

    // Increment uses
    await db()
      .from('lanpa_invitations')
      .update({ uses: invitation.uses + 1 })
      .eq('id', invitation.id);

    // Get lanpa details
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('*')
      .eq('id', invitation.lanpa_id)
      .single();

    res.json({ data: lanpa });
  } catch (error) {
    next(error);
  }
});

// POST /api/lanpas/:id/suggest-game
lanpasRouter.post('/:id/suggest-game', authenticate, validate(suggestGameSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { game_id } = req.body;

    // Check if user is member
    if (!(await isLanpaMember(id, req.userId!))) {
      throw new ForbiddenError('Only members can suggest games');
    }

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
        suggested_by: req.userId,
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

    res.status(201).json({ data: suggestion });
  } catch (error) {
    next(error);
  }
});

// POST /api/lanpas/:id/vote-game
lanpasRouter.post('/:id/vote-game', authenticate, validate(voteGameSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { game_id } = req.body;

    // Check if user is member
    if (!(await isLanpaMember(id, req.userId!))) {
      throw new ForbiddenError('Only members can vote');
    }

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
        user_id: req.userId,
      }, { onConflict: 'lanpa_id,user_id' })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to vote');
    }

    res.json({ data: vote });
  } catch (error) {
    next(error);
  }
});

// Helper to get game vote results
const getGameVoteResults = async (lanpaId: string): Promise<{ results: GameVoteResult[]; winner: any; wasRandomTiebreaker: boolean }> => {
  // Get all suggestions with vote counts
  const { data: suggestions } = await db()
    .from('game_suggestions')
    .select(`
      game_id,
      game:games(*)
    `)
    .eq('lanpa_id', lanpaId);

  if (!suggestions || suggestions.length === 0) {
    return { results: [], winner: null, wasRandomTiebreaker: false };
  }

  // Count votes per game
  const { data: votes } = await db()
    .from('game_votes')
    .select('game_id')
    .eq('lanpa_id', lanpaId);

  const voteCounts: Record<string, number> = {};
  votes?.forEach(v => {
    voteCounts[v.game_id] = (voteCounts[v.game_id] || 0) + 1;
  });

  // Build results
  const results: GameVoteResult[] = suggestions.map(s => ({
    game_id: s.game_id,
    game: Array.isArray(s.game) ? s.game[0] : s.game,
    votes: voteCounts[s.game_id] || 0,
    is_winner: false,
  }));

  // Sort by votes (descending)
  results.sort((a, b) => b.votes - a.votes);

  // Determine winner
  const maxVotes = results[0]?.votes || 0;
  const topGames = results.filter(r => r.votes === maxVotes);

  let winner = null;
  let wasRandomTiebreaker = false;

  if (topGames.length === 1) {
    winner = topGames[0].game;
    topGames[0].is_winner = true;
  } else if (topGames.length > 1) {
    // Random tiebreaker
    const randomWinner = getRandomItem(topGames);
    if (randomWinner) {
      winner = randomWinner.game;
      randomWinner.is_winner = true;
      wasRandomTiebreaker = true;
    }
  }

  return { results, winner, wasRandomTiebreaker };
};

// GET /api/lanpas/:id/game-results
lanpasRouter.get('/:id/game-results', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is member
    if (!(await isLanpaMember(id, req.userId!))) {
      throw new ForbiddenError('Only members can view results');
    }

    const { results, winner, wasRandomTiebreaker } = await getGameVoteResults(id);

    res.json({
      data: {
        results,
        winner,
        was_random_tiebreaker: wasRandomTiebreaker,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/lanpas/:id/rate
lanpasRouter.post('/:id/rate', authenticate, validate(rateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ratings, lanpa_rating } = req.body;

    // Check if user is member
    if (!(await isLanpaMember(id, req.userId!))) {
      throw new ForbiddenError('Only members can rate');
    }

    // Check lanpa status
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('status, admin_id')
      .eq('id', id)
      .single();

    if (lanpa?.status !== LanpaStatus.COMPLETED) {
      throw new BadRequestError('Ratings are only allowed for completed lanpas');
    }

    const isAdmin = lanpa.admin_id === req.userId;

    // Create member ratings
    if (ratings && ratings.length > 0) {
      const ratingEntries = ratings.map((r: any) => ({
        lanpa_id: id,
        from_user_id: req.userId,
        to_user_id: r.to_user_id,
        rating_type: isAdmin
          ? 'admin_to_member'
          : r.to_user_id === lanpa.admin_id
            ? 'member_to_admin'
            : 'member_to_member',
        score: r.score,
        comment: r.comment,
      }));

      await db()
        .from('ratings')
        .upsert(ratingEntries, { onConflict: 'lanpa_id,from_user_id,to_user_id' });

      // Notify rated users
      for (const r of ratings) {
        if (r.to_user_id) {
          await notifyUser(r.to_user_id, {
            type: NotificationType.RATING_RECEIVED,
            title: 'New Rating',
            body: `You received a ${r.score}-star rating!`,
            data: { lanpa_id: id },
          });
        }
      }
    }

    // Create lanpa rating
    if (lanpa_rating) {
      await db()
        .from('lanpa_ratings')
        .upsert({
          lanpa_id: id,
          user_id: req.userId,
          score: lanpa_rating.score,
          comment: lanpa_rating.comment,
        }, { onConflict: 'lanpa_id,user_id' });
    }

    res.json({ message: 'Ratings submitted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/lanpas/:id/games - Get all games suggested/voted for a lanpa
lanpasRouter.get('/:id/games', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is member
    if (!(await isLanpaMember(id, req.userId!))) {
      throw new ForbiddenError('Only members can view lanpa games');
    }

    // Get lanpa with selected game
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('id, selected_game_id')
      .eq('id', id)
      .single();

    if (!lanpa) {
      throw new NotFoundError('Lanpa not found');
    }

    // Get all game suggestions with user info and vote counts
    const { data: suggestions } = await db()
      .from('game_suggestions')
      .select(`
        id,
        created_at,
        game:games(*),
        suggested_by_user:users!game_suggestions_suggested_by_fkey(id, username, display_name, avatar_url)
      `)
      .eq('lanpa_id', id);

    // Get vote counts per game
    const { data: votes } = await db()
      .from('game_votes')
      .select('game_id')
      .eq('lanpa_id', id);

    const voteCounts: Record<string, number> = {};
    votes?.forEach(v => {
      voteCounts[v.game_id] = (voteCounts[v.game_id] || 0) + 1;
    });

    // Build response
    const games = (suggestions || []).map(s => ({
      game: Array.isArray(s.game) ? s.game[0] : s.game,
      suggested_by: s.suggested_by_user,
      suggested_at: s.created_at,
      votes_count: voteCounts[Array.isArray(s.game) ? s.game[0]?.id : s.game?.id] || 0,
      is_winner: lanpa.selected_game_id === (Array.isArray(s.game) ? s.game[0]?.id : s.game?.id),
    }));

    // Sort by votes (descending)
    games.sort((a, b) => b.votes_count - a.votes_count);

    // Get winner game details
    let winner = null;
    if (lanpa.selected_game_id) {
      const { data: winnerGame } = await db()
        .from('games')
        .select('*')
        .eq('id', lanpa.selected_game_id)
        .single();
      winner = winnerGame;
    }

    res.json({
      data: {
        lanpa_id: id,
        games,
        total_games_suggested: games.length,
        winner,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/lanpas/:id/punishments - Get all punishments applied in a lanpa
lanpasRouter.get('/:id/punishments', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is member
    if (!(await isLanpaMember(id, req.userId!))) {
      throw new ForbiddenError('Only members can view lanpa punishments');
    }

    // Get lanpa
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('id')
      .eq('id', id)
      .single();

    if (!lanpa) {
      throw new NotFoundError('Lanpa not found');
    }

    // Get all user punishments for this lanpa with related data
    const { data: userPunishments } = await db()
      .from('user_punishments')
      .select(`
        id,
        reason,
        created_at,
        user:users!user_punishments_user_id_fkey(id, username, display_name, avatar_url),
        punishment:punishments(*),
        nominator:users!user_punishments_nominator_id_fkey(id, username, display_name, avatar_url)
      `)
      .eq('lanpa_id', id)
      .order('created_at', { ascending: false });

    // Build response
    const punishments = (userPunishments || []).map(up => ({
      id: up.id,
      user: up.user,
      punishment: up.punishment,
      reason: up.reason,
      applied_at: up.created_at,
      nominator: up.nominator,
    }));

    // Calculate total point impact
    const totalPointImpact = punishments.reduce((sum, p) => {
      const impact = (p.punishment as any)?.point_impact || 0;
      return sum + impact;
    }, 0);

    res.json({
      data: {
        lanpa_id: id,
        punishments,
        total_punishments: punishments.length,
        total_point_impact: totalPointImpact,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/lanpas/:id/members/:memberId/status
lanpasRouter.patch('/:id/members/:memberId/status', authenticate, async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const { status } = req.body;

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

    // Users can only update their own status (confirm/decline invitation)
    // Admins can update any member status
    const isAdmin = await isLanpaAdmin(id, req.userId!);
    const isOwnStatus = member.user_id === req.userId;

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

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});
