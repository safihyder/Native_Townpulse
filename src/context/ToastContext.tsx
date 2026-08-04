import React, { createContext, useCallback, useContext, useState } from 'react';
import { ToastContainer, type ToastData, type ToastType } from '../components/Toast';

type ShowToastOpts = {
  type: ToastType;
  title: string;
  body?: string;
  autoDismissMs?: number | null;
};

type ToastContextValue = {
  showToast: (opts: ShowToastOpts) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

let _idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((opts: ShowToastOpts) => {
    const id = `toast_${++_idCounter}_${Date.now()}`;
    const newToast: ToastData = {
      id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      autoDismissMs: opts.autoDismissMs,
    };
    setToasts(prev => [newToast, ...prev].slice(0, 5));
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={handleDismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
