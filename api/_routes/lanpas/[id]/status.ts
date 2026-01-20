import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { LanpaStatus, MemberStatus, NotificationType, type GameVoteResult } from '@lanpapp/shared';
import { getRandomItem } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, NotFoundError, ForbiddenError, BadRequestError, notifyUsers } from '../../../_lib';
import { db } from '../../../_lib/supabase';

const updateStatusSchema = z.object({
  status: z.nativeEnum(LanpaStatus),
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new NotFoundError('Lanpa ID is required');
    }

    // Check if user is admin
    if (!(await isLanpaAdmin(id, userId))) {
      throw new ForbiddenError('Only the admin can change lanpa status');
    }

    const { status } = validate(updateStatusSchema, req.body);

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

    return res.json({ data: lanpa });
  } catch (error) {
    return handleError(error, res);
  }
}
