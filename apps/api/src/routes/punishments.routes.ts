import { Router } from 'express';
import { z } from 'zod';
import { PunishmentSeverity, type CreatePunishmentRequest } from '@lanpapp/shared';
import { db } from '../services/supabase.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { BadRequestError, NotFoundError } from '../middleware/error.middleware.js';

export const punishmentsRouter: Router = Router();

// Validation schemas
const createPunishmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  severity: z.nativeEnum(PunishmentSeverity),
  point_impact: z.number().int().min(0).max(100).default(0),
});

const updatePunishmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  severity: z.nativeEnum(PunishmentSeverity).optional(),
  point_impact: z.number().int().min(0).max(100).optional(),
});

// GET /api/punishments
punishmentsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = '1', limit = '20', severity } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    let query = db()
      .from('punishments')
      .select('*', { count: 'exact' });

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: punishments, error, count } = await query
      .order('severity', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + limitNum - 1);

    if (error) {
      throw new BadRequestError('Failed to fetch punishments');
    }

    res.json({
      data: punishments,
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

// POST /api/punishments
punishmentsRouter.post('/', authenticate, validate(createPunishmentSchema), async (req, res, next) => {
  try {
    const body = req.body as CreatePunishmentRequest;

    const { data: punishment, error } = await db()
      .from('punishments')
      .insert({
        name: body.name,
        description: body.description,
        severity: body.severity,
        point_impact: body.point_impact,
        created_by: req.userId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to create punishment');
    }

    res.status(201).json({ data: punishment });
  } catch (error) {
    next(error);
  }
});

// GET /api/punishments/:id
punishmentsRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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

    res.json({
      data: {
        ...punishment,
        times_applied: timesApplied || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/punishments/:id
punishmentsRouter.patch('/:id', authenticate, validate(updatePunishmentSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if punishment exists
    const { data: existing } = await db()
      .from('punishments')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      throw new NotFoundError('Punishment not found');
    }

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

    res.json({ data: punishment });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/punishments/:id
punishmentsRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

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

    res.json({ message: 'Punishment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:userId/punishments
punishmentsRouter.get('/users/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const { data: userPunishments, error } = await db()
      .from('user_punishments')
      .select(`
        *,
        punishment:punishments(*),
        lanpa:lanpas(id, name)
      `)
      .eq('user_id', userId)
      .order('applied_at', { ascending: false });

    if (error) {
      throw new BadRequestError('Failed to fetch user punishments');
    }

    // Calculate total point impact
    const totalPointImpact = userPunishments?.reduce(
      (sum, up) => sum + (up.punishment?.point_impact || 0),
      0
    ) || 0;

    res.json({
      data: {
        punishments: userPunishments,
        total_point_impact: totalPointImpact,
      },
    });
  } catch (error) {
    next(error);
  }
});
