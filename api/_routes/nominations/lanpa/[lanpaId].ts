import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberStatus } from '@lanpapp/shared';
import { cors, handleError, authenticate, ForbiddenError, BadRequestError } from '../../../_lib';
import { db } from '../../../_lib/supabase';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { lanpaId, status } = req.query;

    if (!lanpaId || typeof lanpaId !== 'string') {
      throw new BadRequestError('Lanpa ID is required');
    }

    // Check if user is member
    if (!(await isLanpaMember(lanpaId, userId))) {
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

    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const { data: nominations, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestError('Failed to fetch nominations');
    }

    return res.json({ data: nominations });
  } catch (error) {
    return handleError(error, res);
  }
}
