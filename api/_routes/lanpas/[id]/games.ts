import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberStatus } from '@lanpapp/shared';
import { cors, handleError, authenticate, NotFoundError, ForbiddenError } from '../../../_lib';
import { db } from '../../../_lib/supabase';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new NotFoundError('Lanpa ID is required');
    }

    // Check if user is member
    if (!(await isLanpaMember(id, userId))) {
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
    const games = (suggestions || []).map(s => {
      const game = Array.isArray(s.game) ? s.game[0] : s.game;
      const gameId = (game as { id?: string } | null)?.id;
      return {
        game,
        suggested_by: s.suggested_by_user,
        suggested_at: s.created_at,
        votes_count: gameId ? (voteCounts[gameId] || 0) : 0,
        is_winner: lanpa.selected_game_id === gameId,
      };
    });

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

    return res.json({
      data: {
        lanpa_id: id,
        games,
        total_games_suggested: games.length,
        winner,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
