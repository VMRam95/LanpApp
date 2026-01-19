import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlusIcon, CalendarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Card, Button, Input, Textarea, Modal, ModalFooter } from '../components/ui';
import { useLanpas, useCreateLanpa } from '../hooks/useLanpas';
import type { CreateLanpaRequest, Lanpa } from '@lanpapp/shared';

export function Lanpas() {
  const { t } = useTranslation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [formData, setFormData] = useState<CreateLanpaRequest>({
    name: '',
    description: '',
    scheduled_date: '',
  });

  // Map filter to status parameter
  const getStatusFilter = () => {
    if (filter === 'upcoming') {
      return 'draft,voting_games,voting_active,in_progress';
    } else if (filter === 'past') {
      return 'completed';
    }
    return undefined;
  };

  const { data, isLoading } = useLanpas({ status: getStatusFilter() });
  const createMutation = useCreateLanpa();

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Keep local time - just add seconds for API validation
    // Don't convert to UTC to avoid timezone shift
    const scheduledDate = formData.scheduled_date
      ? `${formData.scheduled_date}:00`
      : undefined;
    createMutation.mutate(
      {
        ...formData,
        scheduled_date: scheduledDate,
      },
      {
        onSuccess: () => {
          setIsCreateModalOpen(false);
          setFormData({ name: '', description: '', scheduled_date: '' });
        },
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'voting_games':
        return 'bg-yellow-100 text-yellow-700';
      case 'voting_active':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-purple-100 text-purple-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('lanpas.title')}</h1>
          <p className="text-gray-500 mt-1">Organize and join LAN parties</p>
        </div>
        <Button
          leftIcon={<PlusIcon className="h-5 w-5" />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          {t('lanpas.createNew')}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['all', 'upcoming', 'past'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                filter === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            {t(`lanpas.${tab}`)}
          </button>
        ))}
      </div>

      {/* Lanpas Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.data.map((lanpa: Lanpa) => (
            <Link key={lanpa.id} to={`/lanpas/${lanpa.id}`}>
              <Card hoverable className="h-full">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {lanpa.name}
                  </h3>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ml-2 ${getStatusColor(lanpa.status)}`}
                  >
                    {t(`lanpas.statuses.${lanpa.status}`)}
                  </span>
                </div>

                {lanpa.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                    {lanpa.description}
                  </p>
                )}

                <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {lanpa.scheduled_date
                        ? new Date(lanpa.scheduled_date).toLocaleDateString()
                        : 'TBD'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <UserGroupIcon className="h-4 w-4" />
                    <span>Members</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {t('lanpas.noLanpas')}
          </h3>
          <p className="mt-2 text-gray-500">
            Create your first LAN party to get started
          </p>
          <Button
            className="mt-4"
            leftIcon={<PlusIcon className="h-5 w-5" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            {t('lanpas.createNew')}
          </Button>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('lanpas.createNew')}
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label={t('lanpas.name')}
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Epic LAN Party"
            required
          />

          <Textarea
            label={t('lanpas.description')}
            value={formData.description || ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Describe your LAN party..."
            rows={3}
          />

          <Input
            label={t('lanpas.scheduledDate')}
            type="datetime-local"
            value={formData.scheduled_date || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                scheduled_date: e.target.value,
              }))
            }
          />

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('common.create')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
