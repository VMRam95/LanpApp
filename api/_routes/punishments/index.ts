import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { PunishmentSeverity } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

const createPunishmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  severity: z.nativeEnum(PunishmentSeverity),
  point_impact: z.number().int().min(0).max(100).default(0),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  try {
    const { userId } = await authenticate(req);

    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const { severity } = req.query;

      let query = db()
        .from('punishments')
        .select('*', { count: 'exact' });

      if (severity && typeof severity === 'string') {
        query = query.eq('severity', severity);
      }

      const { data: punishments, error, count } = await query
        .order('severity', { ascending: true })
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new BadRequestError('Failed to fetch punishments');
      }

      return res.json({
        data: punishments,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    if (req.method === 'POST') {
      const body = validate(createPunishmentSchema, req.body);

      const { data: punishment, error } = await db()
        .from('punishments')
        .insert({
          name: body.name,
          description: body.description,
          severity: body.severity,
          point_impact: body.point_impact,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestError('Failed to create punishment');
      }

      return res.status(201).json({ data: punishment });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
