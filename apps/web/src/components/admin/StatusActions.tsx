import { useTranslation } from 'react-i18next';
import {
  PlayIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../ui';
import { LanpaStatus } from '@lanpapp/shared';

interface StatusActionsProps {
  currentStatus: LanpaStatus;
  onStatusChange: (status: LanpaStatus) => void;
  isLoading: boolean;
}

export function StatusActions({ currentStatus, onStatusChange, isLoading }: StatusActionsProps) {
  const { t } = useTranslation();

  const renderStatusContent = () => {
    switch (currentStatus) {
      case LanpaStatus.DRAFT:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{t('lanpas.statusDescriptions.draft')}</p>
            </div>
            <Button
              leftIcon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
              onClick={() => onStatusChange(LanpaStatus.VOTING_GAMES)}
              isLoading={isLoading}
              fullWidth
            >
              {t('lanpas.statusActions.openSuggestions')}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              {t('lanpas.statusActions.openSuggestionsDesc')}
            </p>
          </div>
        );

      case LanpaStatus.VOTING_GAMES:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-700">{t('lanpas.statusDescriptions.voting_games')}</p>
            </div>
            <Button
              leftIcon={<ChartBarIcon className="h-5 w-5" />}
              onClick={() => onStatusChange(LanpaStatus.VOTING_ACTIVE)}
              isLoading={isLoading}
              fullWidth
            >
              {t('lanpas.statusActions.startVoting')}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              {t('lanpas.statusActions.startVotingDesc')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowUturnLeftIcon className="h-4 w-4" />}
              onClick={() => onStatusChange(LanpaStatus.DRAFT)}
              isLoading={isLoading}
              fullWidth
            >
              {t('lanpas.statusActions.backToSetup')}
            </Button>
          </div>
        );

      case LanpaStatus.VOTING_ACTIVE:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">{t('lanpas.statusDescriptions.voting_active')}</p>
            </div>
            <Button
              leftIcon={<PlayIcon className="h-5 w-5" />}
              onClick={() => onStatusChange(LanpaStatus.IN_PROGRESS)}
              isLoading={isLoading}
              fullWidth
            >
              {t('lanpas.statusActions.startEvent')}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              {t('lanpas.statusActions.startEventDesc')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowUturnLeftIcon className="h-4 w-4" />}
              onClick={() => onStatusChange(LanpaStatus.VOTING_GAMES)}
              isLoading={isLoading}
              fullWidth
            >
              {t('lanpas.statusActions.backToSuggestions')}
            </Button>
          </div>
        );

      case LanpaStatus.IN_PROGRESS:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700">{t('lanpas.statusDescriptions.in_progress')}</p>
            </div>
            <Button
              leftIcon={<CheckCircleIcon className="h-5 w-5" />}
              onClick={() => onStatusChange(LanpaStatus.COMPLETED)}
              isLoading={isLoading}
              fullWidth
            >
              {t('lanpas.statusActions.completeEvent')}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              {t('lanpas.statusActions.completeEventDesc')}
            </p>
          </div>
        );

      case LanpaStatus.COMPLETED:
        return (
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700">{t('lanpas.statusDescriptions.completed')}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return <div className="py-2">{renderStatusContent()}</div>;
}
