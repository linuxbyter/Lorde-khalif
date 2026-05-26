'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface ToastMessage {
  id: string;
  message: string;
  type: 'trade' | 'error' | 'info';
  pnl?: number;
}

let addToastFn: ((msg: Omit<ToastMessage, 'id'>) => void) | null = null;

export const notify = (msg: Omit<ToastMessage, 'id'>) => {
  if (addToastFn) addToastFn(msg);
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-4), { ...msg, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto px-4 py-3 rounded-lg shadow-2xl border font-mono text-xs animate-slideUp ${
            toast.type === 'trade'
              ? 'bg-[#0A1929] border-status-success/30 text-white'
              : toast.type === 'error'
              ? 'bg-[#0A1929] border-status-danger/30 text-status-danger'
              : 'bg-[#0A1929] border-gold/30 text-gold'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              toast.type === 'trade' ? 'bg-status-success animate-pulse' :
              toast.type === 'error' ? 'bg-status-danger' : 'bg-gold'
            }`} />
            <span className="flex-1">{toast.message}</span>
            {toast.pnl !== undefined && (
              <span className={`font-bold ${toast.pnl >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                {toast.pnl >= 0 ? '+' : ''}${toast.pnl.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
