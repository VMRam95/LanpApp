import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberStatus, type GameVoteResult } from '@lanpapp/shared';
import { getRandomItem } from '@lanpapp/shared';
import { cors, handleError, authenticate, ForbiddenError, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

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

  if (req.method !== 'GET') {
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
      throw new ForbiddenError('Only members can view results');
    }

    const { results, winner, wasRandomTiebreaker } = await getGameVoteResults(id);

    return res.json({
      data: {
        results,
        winner,
        was_random_tiebreaker: wasRandomTiebreaker,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
