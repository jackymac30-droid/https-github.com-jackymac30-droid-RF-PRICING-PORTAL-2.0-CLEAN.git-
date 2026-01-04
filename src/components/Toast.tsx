import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border-2 animate-slide-up z-50 min-w-[300px] ${
        type === 'success'
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400'
          : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-400'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
      ) : (
        <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
      )}
      <p
        className={`text-base font-semibold flex-1 ${
          type === 'success' ? 'text-green-900' : 'text-red-900'
        }`}
      >
        {message}
      </p>
      <button
        onClick={onClose}
        className={`ml-2 p-1.5 rounded-lg hover:bg-white/50 transition ${
          type === 'success' ? 'text-green-600' : 'text-red-600'
        }`}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
