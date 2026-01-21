import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { LanpaStatus, MemberStatus, type CreateLanpaRequest } from '../../_lib/shared-types';
import { cors, handleError, validate, authenticate, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

// Custom datetime validator
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  try {
    const { user, userId } = await authenticate(req);

    if (req.method === 'GET') {
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
        .eq('user_id', userId)
        .in('status', [MemberStatus.INVITED, MemberStatus.CONFIRMED, MemberStatus.ATTENDED]);

      const lanpaIds = memberLanpaIds?.map(m => m.lanpa_id) || [];

      // Build OR filter for user's lanpas (admin or member)
      if (lanpaIds.length > 0) {
        query = query.or(`admin_id.eq.${userId},id.in.(${lanpaIds.join(',')})`);
      } else {
        query = query.eq('admin_id', userId);
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

      return res.json({
        data: lanpas,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum),
        },
      });
    }

    if (req.method === 'POST') {
      const body = validate(createLanpaSchema, req.body) as CreateLanpaRequest;

      const { data: lanpa, error } = await db()
        .from('lanpas')
        .insert({
          name: body.name,
          description: body.description,
          admin_id: userId,
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
          user_id: userId,
          status: MemberStatus.CONFIRMED,
        });

      return res.status(201).json({ data: lanpa });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
