import webPush from 'web-push';
import { NotificationType, type User, type Notification } from '@lanpapp/shared';
import { db, supabaseAdmin } from './supabase';

// Environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL;
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;
const EMAIL_SERVICE_API_KEY = process.env.EMAIL_SERVICE_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'LanpApp <noreply@lanpapp.com>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize web-push if VAPID keys are configured
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_EMAIL) {
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Email service payload interface
interface EmailServicePayload {
  to: string | string[];
  subject: string;
  from?: string;
  html?: string;
  template?: string;
  data?: Record<string, unknown>;
}

// Send email via email-service API
const sendToEmailService = async (payload: EmailServicePayload): Promise<boolean> => {
  if (!EMAIL_SERVICE_URL || !EMAIL_SERVICE_API_KEY) {
    console.warn('Email service not configured');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${EMAIL_SERVICE_URL}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EMAIL_SERVICE_API_KEY,
      },
      body: JSON.stringify({
        ...payload,
        from: payload.from || EMAIL_FROM,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const result = (await response.json()) as { success?: boolean; messageId?: string; error?: string };

    if (!response.ok) {
      console.error('Email service error:', result);
      return false;
    }

    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error calling email service:', error);
    return false;
  }
};

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Create in-app notification
export const createNotification = async (
  userId: string,
  payload: NotificationPayload
): Promise<Notification | null> => {
  const { data, error } = await db()
    .from('notifications')
    .insert({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      read: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data as Notification;
};

// Send push notification
export const sendPushNotification = async (
  userId: string,
  payload: NotificationPayload
): Promise<boolean> => {
  if (!VAPID_PUBLIC_KEY) {
    return false;
  }

  try {
    // Get user's push subscriptions
    const { data: subscriptions } = await db()
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (!subscriptions || subscriptions.length === 0) {
      return false;
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          pushPayload
        )
      )
    );

    // Remove invalid subscriptions
    const invalidSubscriptions = results
      .map((result, index) => (result.status === 'rejected' ? subscriptions[index].id : null))
      .filter(Boolean);

    if (invalidSubscriptions.length > 0) {
      await db()
        .from('push_subscriptions')
        .delete()
        .in('id', invalidSubscriptions);
    }

    return results.some((r) => r.status === 'fulfilled');
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};

// Send email notification using a template
export const sendTemplateEmail = async (
  userEmail: string,
  templateId: string,
  data: Record<string, unknown>
): Promise<boolean> => {
  return sendToEmailService({
    to: userEmail,
    subject: '', // Subject comes from the template
    template: templateId,
    data,
  });
};

// Get user notification preferences
const getUserNotificationPreferences = async (userId: string) => {
  const { data } = await db()
    .from('users')
    .select('notification_preferences')
    .eq('id', userId)
    .single();

  return data?.notification_preferences || {
    in_app: true,
    push: true,
    email: true,
    lanpa_created: true,
    lanpa_updated: true,
    lanpa_invitation: true,
    game_voting: true,
    punishment_nomination: true,
    lanpa_reminder: true,
  };
};

// Get user email from auth
const getUserEmail = async (userId: string): Promise<string | null> => {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data.user?.email || null;
};

// Map notification type to preference key
const getPreferenceKeyForType = (
  type: NotificationType
): keyof User['notification_preferences'] | null => {
  const mapping: Partial<Record<NotificationType, keyof User['notification_preferences']>> = {
    [NotificationType.LANPA_CREATED]: 'lanpa_created',
    [NotificationType.LANPA_UPDATED]: 'lanpa_updated',
    [NotificationType.LANPA_INVITATION]: 'lanpa_invitation',
    [NotificationType.GAME_VOTING_STARTED]: 'game_voting',
    [NotificationType.GAME_VOTING_ENDED]: 'game_voting',
    [NotificationType.PUNISHMENT_NOMINATION]: 'punishment_nomination',
    [NotificationType.PUNISHMENT_VOTING_ENDED]: 'punishment_nomination',
    [NotificationType.LANPA_REMINDER]: 'lanpa_reminder',
  };
  return mapping[type] || null;
};

// Determine if email should be sent for this notification type
const shouldSendEmail = (type: NotificationType): boolean => {
  const emailTypes: NotificationType[] = [
    NotificationType.LANPA_INVITATION,
    NotificationType.PUNISHMENT_VOTING_ENDED,
    NotificationType.LANPA_REMINDER,
  ];
  return emailTypes.includes(type);
};

// Send notification through all enabled channels
export const notifyUser = async (
  userId: string,
  payload: NotificationPayload
): Promise<void> => {
  const prefs = await getUserNotificationPreferences(userId);
  const typeKey = getPreferenceKeyForType(payload.type);

  // Check if user wants this type of notification
  if (typeKey && !prefs[typeKey]) {
    return;
  }

  // In-app notification (always created)
  if (prefs.in_app) {
    await createNotification(userId, payload);
  }

  // Push notification
  if (prefs.push) {
    await sendPushNotification(userId, payload);
  }

  // Email notification (only for important events)
  if (prefs.email && shouldSendEmail(payload.type)) {
    const email = await getUserEmail(userId);
    if (email) {
      await sendTemplateEmail(email, 'lanpapp/lanpa-notification', {
        title: payload.title,
        body: payload.body,
        actionLink: FRONTEND_URL,
      });
    }
  }
};

// Notify multiple users
export const notifyUsers = async (
  userIds: string[],
  payload: NotificationPayload
): Promise<void> => {
  await Promise.all(userIds.map((userId) => notifyUser(userId, payload)));
};
