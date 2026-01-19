import webPush from 'web-push';
import { Resend } from 'resend';
import { NotificationType, type User, type Notification } from '@lanpapp/shared';
import { config } from '../config/index.js';
import { db, supabaseAdmin } from './supabase.service.js';

// Initialize web-push if VAPID keys are configured
if (config.webPush.publicKey && config.webPush.privateKey && config.webPush.email) {
  webPush.setVapidDetails(
    config.webPush.email,
    config.webPush.publicKey,
    config.webPush.privateKey
  );
}

// Initialize Resend if API key is configured
const resend = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;

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
  if (!config.webPush.publicKey) {
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

// Send email notification
export const sendEmailNotification = async (
  userEmail: string,
  subject: string,
  htmlContent: string
): Promise<boolean> => {
  if (!resend) {
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: config.email.from,
      to: userEmail,
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Error sending email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
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
      const htmlContent = generateEmailHtml(payload);
      await sendEmailNotification(email, payload.title, htmlContent);
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

// Generate email HTML content
const generateEmailHtml = (payload: NotificationPayload): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${payload.title}</h1>
        </div>
        <div class="content">
          <p>${payload.body}</p>
          <a href="${config.frontendUrl}" class="button">Open LanpApp</a>
        </div>
      </div>
    </body>
    </html>
  `;
};
