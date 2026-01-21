import { useTranslation } from 'react-i18next';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  isLoading?: boolean;
  confirmText?: string;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isLoading = false,
  confirmText,
}: ConfirmDeleteModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || t('common.confirmDelete')} size="sm">
      <div className="space-y-4">
        <p className="text-gray-600">{message}</p>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>
            {confirmText || t('common.delete')}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
