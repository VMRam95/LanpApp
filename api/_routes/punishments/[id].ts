import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { PunishmentSeverity } from '@lanpapp/shared';
import { cors, handleError, validate, authenticate, BadRequestError, NotFoundError } from '../../_lib';
import { db } from '../../_lib/supabase';

const updatePunishmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  severity: z.nativeEnum(PunishmentSeverity).optional(),
  point_impact: z.number().int().min(0).max(100).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  try {
    await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Punishment ID is required');
    }

    if (req.method === 'GET') {
      const { data: punishment, error } = await db()
        .from('punishments')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !punishment) {
        throw new NotFoundError('Punishment not found');
      }

      // Get usage stats
      const { count: timesApplied } = await db()
        .from('user_punishments')
        .select('id', { count: 'exact', head: true })
        .eq('punishment_id', id);

      return res.json({
        data: {
          ...punishment,
          times_applied: timesApplied || 0,
        },
      });
    }

    if (req.method === 'PATCH') {
      // Check if punishment exists
      const { data: existing } = await db()
        .from('punishments')
        .select('id')
        .eq('id', id)
        .single();

      if (!existing) {
        throw new NotFoundError('Punishment not found');
      }

      const updates = validate(updatePunishmentSchema, req.body);

      const { data: punishment, error } = await db()
        .from('punishments')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new BadRequestError('Failed to update punishment');
      }

      return res.json({ data: punishment });
    }

    if (req.method === 'DELETE') {
      // Check if punishment is in use
      const { count } = await db()
        .from('user_punishments')
        .select('id', { count: 'exact', head: true })
        .eq('punishment_id', id);

      if (count && count > 0) {
        throw new BadRequestError('Cannot delete a punishment that has been applied to users');
      }

      const { error } = await db()
        .from('punishments')
        .delete()
        .eq('id', id);

      if (error) {
        throw new BadRequestError('Failed to delete punishment');
      }

      return res.json({ message: 'Punishment deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return handleError(error, res);
  }
}
