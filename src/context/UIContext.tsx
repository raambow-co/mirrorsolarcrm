import React, { createContext, useContext, useState, type ReactNode } from 'react';
import './UIContext.css';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  isExiting?: boolean;
}

interface ConfirmModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface UIContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  showConfirmModal: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { onCancel?: () => void; confirmText?: string; cancelText?: string }
  ) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, isExiting: false }]);

    setTimeout(() => {
      // Trigger exit animation
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t)));
      
      // Remove from DOM after animation completes
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 400); // 400ms matches CSS exit duration
    }, 3000);
  };

  const showConfirmModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { onCancel?: () => void; confirmText?: string; cancelText?: string }
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        if (options?.onCancel) options.onCancel();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
    });
  };

  return (
    <UIContext.Provider value={{ showToast, showConfirmModal }}>
      {children}

      {/* Global Toast Container */}
      <div className="global-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`global-toast toast-${toast.type} ${toast.isExiting ? 'toast-exit' : ''}`}>
            {toast.type === 'success' && (
              <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Global Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="global-modal-overlay">
          <div className="global-modal-content">
            <h3 className="global-modal-title">{confirmModal.title}</h3>
            <p className="global-modal-message">{confirmModal.message}</p>
            <div className="global-modal-actions">
              <button
                className="global-btn-secondary"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              >
                {confirmModal.cancelText}
              </button>
              <button
                className={`global-btn-primary ${confirmModal.title.toLowerCase().includes('delete') || confirmModal.title.toLowerCase().includes('remove') || confirmModal.title.toLowerCase().includes('deactivate') ? 'btn-danger' : ''}`}
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
