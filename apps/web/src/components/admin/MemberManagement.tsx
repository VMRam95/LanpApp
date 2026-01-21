import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckIcon,
  UserMinusIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { ConfirmDeleteModal } from '../ui';
import { UserAvatar } from '../UserAvatar';
import { getMemberStatusColor } from '../../lib/statusColors';
import type { LanpaMember } from '@lanpapp/shared';

interface MemberManagementProps {
  members: LanpaMember[];
  currentUserId: string;
  onUpdateStatus: (memberId: string, status: string) => void;
  onRemoveMember: (memberId: string) => void;
  isUpdating: boolean;
  isRemoving: boolean;
}

export function MemberManagement({
  members,
  currentUserId,
  onUpdateStatus,
  onRemoveMember,
  isUpdating,
  isRemoving,
}: MemberManagementProps) {
  const { t } = useTranslation();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const handleRemoveClick = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (member?.user_id === currentUserId) {
      return;
    }
    setSelectedMemberId(memberId);
    setShowRemoveConfirm(true);
    setOpenDropdownId(null);
  };

  const handleConfirmRemove = () => {
    if (selectedMemberId) {
      onRemoveMember(selectedMemberId);
      setShowRemoveConfirm(false);
      setSelectedMemberId(null);
    }
  };

  const handleStatusChange = (memberId: string, status: string) => {
    onUpdateStatus(memberId, status);
    setOpenDropdownId(null);
  };

  if (!members || members.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        {t('lanpas.memberManagement.noMembers')}
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-gray-200">
        {members.map((member) => {
          const isCurrentUser = member.user_id === currentUserId;
          const isDropdownOpen = openDropdownId === member.id;

          return (
            <div key={member.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {member.user && (
                  <UserAvatar user={member.user} size="md" showName namePosition="right" />
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getMemberStatusColor(member.status)}`}>
                  {member.status}
                </span>

                {/* Actions dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdownId(isDropdownOpen ? null : member.id)}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                      {member.status !== 'confirmed' && (
                        <button
                          onClick={() => handleStatusChange(member.id, 'confirmed')}
                          disabled={isUpdating}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <CheckIcon className="h-4 w-4 text-green-500" />
                          {t('lanpas.memberManagement.confirmMember')}
                        </button>
                      )}
                      {member.status !== 'attended' && (
                        <button
                          onClick={() => handleStatusChange(member.id, 'attended')}
                          disabled={isUpdating}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <CheckIcon className="h-4 w-4 text-blue-500" />
                          {t('lanpas.memberManagement.markAttended')}
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveClick(member.id)}
                        disabled={isCurrentUser}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                          isCurrentUser
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <UserMinusIcon className="h-4 w-4" />
                        {t('lanpas.memberManagement.removeMember')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Remove confirmation modal */}
      <ConfirmDeleteModal
        isOpen={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false);
          setSelectedMemberId(null);
        }}
        onConfirm={handleConfirmRemove}
        title={t('lanpas.memberManagement.removeMember')}
        message={t('lanpas.memberManagement.removeConfirm')}
        isLoading={isRemoving}
        confirmText={t('lanpas.memberManagement.removeMember')}
      />
    </>
  );
}
