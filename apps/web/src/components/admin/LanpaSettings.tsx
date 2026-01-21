import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LinkIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Button, ConfirmDeleteModal } from '../ui';
import type { LanpaWithRelations } from '@lanpapp/shared';

interface LanpaSettingsProps {
  lanpa: LanpaWithRelations;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onCopyInviteLink: () => Promise<void>;
}

export function LanpaSettings({
  lanpa,
  onEditClick,
  onDeleteClick,
  onCopyInviteLink,
}: LanpaSettingsProps) {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = lanpa.status !== 'in_progress';

  const handleCopyLink = async () => {
    await onCopyInviteLink();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDelete = () => {
    setIsDeleting(true);
    onDeleteClick();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="secondary"
            leftIcon={<PencilIcon className="h-4 w-4" />}
            onClick={onEditClick}
            fullWidth
          >
            {t('lanpas.lanpaSettings.editDetails')}
          </Button>

          <Button
            variant="secondary"
            leftIcon={isCopied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
            onClick={handleCopyLink}
            fullWidth
          >
            {isCopied ? t('common.copied') : t('lanpas.lanpaSettings.copyInviteLink')}
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-red-600 mb-3">
            {t('lanpas.lanpaSettings.dangerZone')}
          </h4>
          <Button
            variant="danger"
            leftIcon={<TrashIcon className="h-4 w-4" />}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!canDelete}
            fullWidth
          >
            {t('lanpas.lanpaSettings.deleteLanpa')}
          </Button>
          {!canDelete && (
            <p className="mt-2 text-xs text-gray-500 text-center">
              {t('lanpas.lanpaSettings.cannotDeleteInProgress')}
            </p>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t('lanpas.lanpaSettings.deleteLanpa')}
        message={t('lanpas.lanpaSettings.deleteConfirm')}
        isLoading={isDeleting}
      />
    </>
  );
}
