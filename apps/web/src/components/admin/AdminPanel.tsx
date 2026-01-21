import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cog6ToothIcon,
  UserGroupIcon,
  PuzzlePieceIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../ui';
import { StatusProgressBar } from './StatusProgressBar';
import { StatusActions } from './StatusActions';
import { MemberManagement } from './MemberManagement';
import { GameManagement } from './GameManagement';
import { LanpaSettings } from './LanpaSettings';
import type { LanpaWithRelations, LanpaStatus } from '@lanpapp/shared';

type AdminTab = 'status' | 'members' | 'games' | 'settings';

interface AdminPanelProps {
  lanpa: LanpaWithRelations;
  currentUserId: string;
  onStatusChange: (status: LanpaStatus) => void;
  onUpdateMemberStatus: (memberId: string, status: string) => void;
  onRemoveMember: (memberId: string) => void;
  onSelectGame: (gameId: string) => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onCopyInviteLink: () => Promise<void>;
  isStatusLoading: boolean;
  isMemberUpdating: boolean;
  isMemberRemoving: boolean;
  isGameSelecting: boolean;
}

const TABS: { id: AdminTab; icon: typeof ClockIcon }[] = [
  { id: 'status', icon: ClockIcon },
  { id: 'members', icon: UserGroupIcon },
  { id: 'games', icon: PuzzlePieceIcon },
  { id: 'settings', icon: Cog6ToothIcon },
];

export function AdminPanel({
  lanpa,
  currentUserId,
  onStatusChange,
  onUpdateMemberStatus,
  onRemoveMember,
  onSelectGame,
  onEditClick,
  onDeleteClick,
  onCopyInviteLink,
  isStatusLoading,
  isMemberUpdating,
  isMemberRemoving,
  isGameSelecting,
}: AdminPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('status');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'status':
        return (
          <StatusActions
            currentStatus={lanpa.status as LanpaStatus}
            onStatusChange={onStatusChange}
            isLoading={isStatusLoading}
          />
        );

      case 'members':
        return (
          <MemberManagement
            members={lanpa.members || []}
            currentUserId={currentUserId}
            onUpdateStatus={onUpdateMemberStatus}
            onRemoveMember={onRemoveMember}
            isUpdating={isMemberUpdating}
            isRemoving={isMemberRemoving}
          />
        );

      case 'games':
        return (
          <GameManagement
            lanpa={lanpa}
            onSelectGame={onSelectGame}
            isSelecting={isGameSelecting}
          />
        );

      case 'settings':
        return (
          <LanpaSettings
            lanpa={lanpa}
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick}
            onCopyInviteLink={onCopyInviteLink}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Card padding="none">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <CardHeader
          title={t('lanpas.adminPanel.title')}
          subtitle={t('lanpas.adminPanel.subtitle')}
        />

        {/* Status Progress Bar */}
        <StatusProgressBar currentStatus={lanpa.status as LanpaStatus} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex px-6" aria-label="Tabs">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px
                transition-colors duration-200
                ${
                  activeTab === id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{t(`lanpas.tabs.${id}`)}</span>
              {id === 'members' && lanpa.members && (
                <span
                  className={`
                    ml-1 px-2 py-0.5 text-xs rounded-full
                    ${activeTab === id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'}
                  `}
                >
                  {lanpa.members.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">{renderTabContent()}</div>
    </Card>
  );
}
