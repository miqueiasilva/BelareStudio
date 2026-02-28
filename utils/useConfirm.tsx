
import React, { useState, useCallback } from 'react';
import ConfirmDialog from '../components/shared/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const useConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions, onConfirm: () => void) => {
    setOptions(opts);
    setOnConfirmCallback(() => onConfirm);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
    setOnConfirmCallback(null);
  }, []);

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={isOpen}
      title={options?.title || ''}
      message={options?.message || ''}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      type={options?.type}
      onConfirm={() => {
        if (onConfirmCallback) onConfirmCallback();
        close();
      }}
      onCancel={close}
    />
  );

  return { confirm, ConfirmDialogComponent };
};
