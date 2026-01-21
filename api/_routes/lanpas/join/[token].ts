import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberStatus } from '../../../_lib/shared-types';
import { cors, handleError, authenticate, NotFoundError, BadRequestError } from '../../../_lib';
import { db } from '../../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = await authenticate(req);
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw new NotFoundError('Invalid invitation link');
    }

    // Find invitation
    const { data: invitation, error: inviteError } = await db()
      .from('lanpa_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
      throw new NotFoundError('Invalid invitation link');
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      throw new BadRequestError('Invitation link has expired');
    }

    // Check max uses
    if (invitation.max_uses && invitation.uses >= invitation.max_uses) {
      throw new BadRequestError('Invitation link has reached maximum uses');
    }

    // Check if already a member
    const { data: existingMember } = await db()
      .from('lanpa_members')
      .select('id, status')
      .eq('lanpa_id', invitation.lanpa_id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      // If already invited, update to confirmed
      if (existingMember.status === MemberStatus.INVITED) {
        await db()
          .from('lanpa_members')
          .update({ status: MemberStatus.CONFIRMED })
          .eq('id', existingMember.id);
      }
    } else {
      // Create new member
      await db()
        .from('lanpa_members')
        .insert({
          lanpa_id: invitation.lanpa_id,
          user_id: userId,
          status: MemberStatus.CONFIRMED,
        });
    }

    // Increment uses
    await db()
      .from('lanpa_invitations')
      .update({ uses: invitation.uses + 1 })
      .eq('id', invitation.id);

    // Get lanpa details
    const { data: lanpa } = await db()
      .from('lanpas')
      .select('*')
      .eq('id', invitation.lanpa_id)
      .single();

    return res.json({ data: lanpa });
  } catch (error) {
    return handleError(error, res);
  }
}
