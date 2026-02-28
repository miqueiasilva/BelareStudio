
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const typeStyles = {
    danger: 'bg-rose-500 hover:bg-rose-600 shadow-rose-100',
    warning: 'bg-orange-500 hover:bg-orange-600 shadow-orange-100',
    info: 'bg-blue-500 hover:bg-blue-600 shadow-blue-100'
  };

  const iconStyles = {
    danger: 'bg-rose-100 text-rose-600',
    warning: 'bg-orange-100 text-orange-600',
    info: 'bg-blue-100 text-blue-600'
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden border border-slate-100"
        >
          <div className="p-8">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl flex-shrink-0 ${iconStyles[type]}`}>
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-800 leading-tight mb-2">{title}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
              </div>
              <button 
                onClick={onCancel}
                className="p-2 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`flex-[2] py-3.5 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${typeStyles[type]}`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
