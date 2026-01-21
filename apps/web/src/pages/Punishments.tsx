import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  PlusIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader, Button, Input, Textarea, Modal, ModalFooter, Pagination, LoadingSpinner, PageHeader } from '../components/ui';
import { usePunishments, useCreatePunishment } from '../hooks/usePunishments';
import { api } from '../services/api';
import { getSeverityColor } from '../lib/statusColors';
import type { CreatePunishmentRequest, GlobalStats, Punishment } from '@lanpapp/shared';

export function Punishments() {
  const { t } = useTranslation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState<CreatePunishmentRequest>({
    name: '',
    description: '',
    severity: 'warning',
    point_impact: 0,
  });

  const { data: punishments, isLoading: punishmentsLoading } = usePunishments({ page: currentPage, limit: 10 });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['global-stats'],
    queryFn: async () => {
      const response = await api.get<{ data: GlobalStats }>('/stats/global');
      return response.data.data;
    },
  });

  const createMutation = useCreatePunishment();

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
        setFormData({
          name: '',
          description: '',
          severity: 'warning',
          point_impact: 0,
        });
      },
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'penalty':
        return <ShieldExclamationIcon className="h-5 w-5 text-orange-500" />;
      case 'suspension':
        return <NoSymbolIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const isLoading = punishmentsLoading || statsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('punishments.title')}
        subtitle="Manage punishments and view the hall of shame"
        action={
          <Button
            leftIcon={<PlusIcon className="h-5 w-5" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            {t('punishments.createNew')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Punishments List */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Available Punishments
              </h2>
            </div>
            {isLoading ? (
              <LoadingSpinner size="sm" fullPage />
            ) : punishments?.data && punishments.data.length > 0 ? (
              <>
              <div className="divide-y divide-gray-200">
                {punishments.data.map((punishment: Punishment) => (
                  <div
                    key={punishment.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(punishment.severity)}
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {punishment.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {punishment.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${getSeverityColor(punishment.severity)}`}
                        >
                          {t(`punishments.severities.${punishment.severity}`)}
                        </span>
                        <span className="text-sm font-medium text-gray-500">
                          -{punishment.point_impact} pts
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {punishments?.pagination && (
                <Pagination
                  currentPage={punishments.pagination.page}
                  totalPages={punishments.pagination.totalPages}
                  totalItems={punishments.pagination.total}
                  itemsPerPage={punishments.pagination.limit}
                  onPageChange={(page) => setCurrentPage(page)}
                />
              )}
              </>
            ) : (
              <div className="p-6 text-center text-gray-500">
                {t('punishments.noPunishments')}
              </div>
            )}
          </Card>
        </div>

        {/* Hall of Shame */}
        <div>
          <Card>
            <CardHeader title={t('punishments.hallOfShame')} />
            {stats?.hall_of_shame && stats.hall_of_shame.length > 0 ? (
              <div className="space-y-4">
                {stats.hall_of_shame.slice(0, 5).map((entry, index) => (
                  <div
                    key={entry.user.id}
                    className="flex items-center gap-3"
                  >
                    <span
                      className={`
                        flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                        ${
                          index === 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : index === 1
                              ? 'bg-gray-100 text-gray-700'
                              : index === 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-50 text-gray-500'
                        }
                      `}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {entry.user.display_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {entry.total_punishments} punishments
                      </p>
                    </div>
                    <span className="text-sm font-medium text-red-600">
                      -{entry.total_point_impact} pts
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No punishments recorded yet
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('punishments.createNew')}
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label={t('punishments.name')}
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Late arrival"
            required
          />

          <Textarea
            label={t('punishments.description')}
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Arriving more than 30 minutes late to the lanpa"
            rows={3}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('punishments.severity')}
            </label>
            <div className="flex gap-2">
              {(['warning', 'penalty', 'suspension'] as const).map((severity) => (
                <button
                  key={severity}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, severity }))
                  }
                  className={`
                    flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors
                    ${
                      formData.severity === severity
                        ? getSeverityColor(severity) + ' border-transparent'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {t(`punishments.severities.${severity}`)}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={t('punishments.pointImpact')}
            type="number"
            min={0}
            value={formData.point_impact || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                point_impact: parseInt(e.target.value) || 0,
              }))
            }
            placeholder="10"
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
