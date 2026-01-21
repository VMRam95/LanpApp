import toast from 'react-hot-toast';

export const showToast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  loading: (message: string) => toast.loading(message),
  dismiss: (toastId?: string) => toast.dismiss(toastId),
};

export const toastMessages = {
  created: (entity: string) => `${entity} created successfully`,
  updated: (entity: string) => `${entity} updated successfully`,
  deleted: (entity: string) => `${entity} deleted successfully`,
  error: (action: string) => `Failed to ${action}. Please try again.`,
};
