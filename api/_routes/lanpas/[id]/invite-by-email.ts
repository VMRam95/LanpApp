import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import crypto from 'crypto';
import { MemberStatus, NotificationType } from '../../../_lib/shared-types';
import { cors, handleError, validate, authenticate, ForbiddenError, NotFoundError, BadRequestError, notifyUser, sendTemplateEmail } from '../../../_lib';
import { db } from '../../../_lib/supabase';

const inviteByEmailSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
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
      throw new ForbiddenError('Only the admin can invite users');
    }

    const { emails } = validate(inviteByEmailSchema, req.body);

    // Get lanpa details
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('name')
      .eq('id', id)
      .single();

    if (!lanpa) {
      throw new NotFoundError('Lanpa not found');
    }

    // Get current user (admin) for the invitation email
    const { data: admin } = await db()
      .from('users')
      .select('display_name, username')
      .eq('id', userId)
      .single();

    const adminName = admin?.display_name || admin?.username || 'Someone';

    // Generate a single invite token for email invitations (valid for 7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db()
      .from('lanpa_invitations')
      .insert({
        lanpa_id: id,
        token,
        expires_at: expiresAt.toISOString(),
        max_uses: null, // Unlimited uses
        uses: 0,
      });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/lanpas/join/${token}`;

    // Process each email
    const results: { email: string; status: 'sent' | 'invited_existing' | 'failed'; error?: string }[] = [];

    for (const email of emails) {
      try {
        // Check if user exists with this email
        const { data: existingUser } = await db()
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (existingUser) {
          // User exists - add them as invited member directly
          await db()
            .from('lanpa_members')
            .upsert({
              lanpa_id: id,
              user_id: existingUser.id,
              status: MemberStatus.INVITED,
            }, { onConflict: 'lanpa_id,user_id', ignoreDuplicates: true });

          // Notify the existing user
          await notifyUser(existingUser.id, {
            type: NotificationType.LANPA_INVITATION,
            title: 'Lanpa Invitation',
            body: `You have been invited to join ${lanpa.name}!`,
            data: { lanpa_id: id },
          });

          results.push({ email, status: 'invited_existing' });
        } else {
          // User doesn't exist - send email invitation using template
          await sendTemplateEmail(email, 'lanpapp/lanpa-invitation', {
            adminName,
            lanpaName: lanpa.name,
            inviteLink,
          });

          results.push({ email, status: 'sent' });
        }
      } catch (emailError) {
        console.error(`Failed to process email ${email}:`, emailError);
        results.push({ email, status: 'failed', error: 'Failed to send invitation' });
      }
    }

    return res.status(201).json({ data: results });
  } catch (error) {
    return handleError(error, res);
  }
}
