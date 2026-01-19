import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCircleIcon, BellIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { Card, CardHeader, Button, Input } from '../components/ui';
import { useAuthStore } from '../store/auth.store';
import { api } from '../services/api';
import type { User, UpdateUserRequest } from '@lanpapp/shared';

export function Profile() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    display_name: user?.display_name || '',
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateUserRequest) => {
      const response = await api.patch<{ data: User }>('/users/me', data);
      return response.data.data;
    },
    onSuccess: (data) => {
      updateUser(data);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      username: formData.username,
      display_name: formData.display_name,
    });
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    if (!user) return;

    updateMutation.mutate({
      notification_preferences: {
        ...user.notification_preferences,
        [key]: value,
      },
    });
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
    if (user) {
      updateMutation.mutate({ locale: lng });
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">{t('profile.title')}</h1>

      {/* Profile Info */}
      <Card>
        <CardHeader
          title={t('profile.editProfile')}
          action={
            !isEditing && (
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                {t('common.edit')}
              </Button>
            )
          }
        />

        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="h-20 w-20 rounded-full"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center">
                <UserCircleIcon className="h-12 w-12 text-primary-600" />
              </div>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="flex-1 space-y-4">
              <Input
                label={t('auth.username')}
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, username: e.target.value }))
                }
                required
              />
              <Input
                label={t('auth.displayName')}
                value={formData.display_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
              />
              <div className="flex gap-3">
                <Button
                  type="submit"
                  isLoading={updateMutation.isPending}
                >
                  {t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      username: user.username,
                      display_name: user.display_name,
                    });
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {user.display_name}
              </h3>
              <p className="text-gray-500">@{user.username}</p>
              <p className="text-sm text-gray-400 mt-2">
                Member since{' '}
                {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader
          title={t('profile.notifications')}
          subtitle="Manage how you receive notifications"
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <BellIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">
                  {t('profile.notificationSettings.inApp')}
                </p>
                <p className="text-sm text-gray-500">
                  Receive notifications in the app
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                handleNotificationChange(
                  'in_app',
                  !user.notification_preferences.in_app
                )
              }
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${user.notification_preferences.in_app ? 'bg-primary-600' : 'bg-gray-200'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${user.notification_preferences.in_app ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <BellIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">
                  {t('profile.notificationSettings.push')}
                </p>
                <p className="text-sm text-gray-500">
                  Receive push notifications
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                handleNotificationChange(
                  'push',
                  !user.notification_preferences.push
                )
              }
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${user.notification_preferences.push ? 'bg-primary-600' : 'bg-gray-200'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${user.notification_preferences.push ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <BellIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">
                  {t('profile.notificationSettings.email')}
                </p>
                <p className="text-sm text-gray-500">
                  Receive email notifications
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                handleNotificationChange(
                  'email',
                  !user.notification_preferences.email
                )
              }
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${user.notification_preferences.email ? 'bg-primary-600' : 'bg-gray-200'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${user.notification_preferences.email ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>
      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader
          title={t('profile.language')}
          subtitle="Choose your preferred language"
        />

        <div className="flex items-center gap-3">
          <GlobeAltIcon className="h-5 w-5 text-gray-400" />
          <div className="flex gap-2">
            <Button
              variant={i18n.language === 'en' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => changeLanguage('en')}
            >
              English
            </Button>
            <Button
              variant={i18n.language === 'es' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => changeLanguage('es')}
            >
              Espanol
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
