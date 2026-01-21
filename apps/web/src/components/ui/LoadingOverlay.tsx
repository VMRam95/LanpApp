import { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingOverlayContextType {
  isLoading: boolean;
  message: string;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

const LoadingOverlayContext = createContext<LoadingOverlayContextType | null>(null);

export function LoadingOverlayProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Processing...');

  const showLoading = (msg = 'Processing...') => {
    setMessage(msg);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  return (
    <LoadingOverlayContext.Provider value={{ isLoading, message, showLoading, hideLoading }}>
      {children}
      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            <span className="text-gray-700 font-medium">{message}</span>
          </div>
        </div>
      )}
    </LoadingOverlayContext.Provider>
  );
}

export function useLoadingOverlay() {
  const context = useContext(LoadingOverlayContext);
  if (!context) {
    throw new Error('useLoadingOverlay must be used within LoadingOverlayProvider');
  }
  return context;
}
