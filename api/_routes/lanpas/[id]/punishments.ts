import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberStatus } from '@lanpapp/shared';
import { cors, handleError, authenticate, NotFoundError, ForbiddenError } from '../../_lib';
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

    return res.json({
      data: {
        lanpa_id: id,
        punishments,
        total_punishments: punishments.length,
        total_point_impact: totalPointImpact,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
