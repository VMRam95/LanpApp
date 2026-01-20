import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import crypto from 'crypto';
import { cors, handleError, validate, authenticate, ForbiddenError, BadRequestError } from '../../_lib';
import { db } from '../../_lib/supabase';

const inviteLinkSchema = z.object({
  expires_in_hours: z.number().min(1).max(168).default(24), // 1 hour to 1 week
  max_uses: z.number().min(1).max(100).nullable().optional(),
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new BadRequestError('Lanpa ID is required');
    }

    // Check if user is admin
    if (!(await isLanpaAdmin(id, userId))) {
      throw new ForbiddenError('Only the admin can create invite links');
    }

    const { expires_in_hours, max_uses } = validate(inviteLinkSchema, req.body);

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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/lanpas/join/${token}`;

    return res.status(201).json({
      data: {
        invitation,
        link,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}
