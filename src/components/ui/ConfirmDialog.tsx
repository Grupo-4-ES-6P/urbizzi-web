import { useEffect, useRef } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fecha com Esc (teclado) ou com clique no fundo escurecido (mouse).
  useEffect(() => {
    const overlay = overlayRef.current;
    const fecharNoEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    const fecharNoFundo = (event: MouseEvent) => {
      if (event.target === overlay) onCancel();
    };
    document.addEventListener('keydown', fecharNoEsc);
    overlay?.addEventListener('click', fecharNoFundo);
    return () => {
      document.removeEventListener('keydown', fecharNoEsc);
      overlay?.removeEventListener('click', fecharNoFundo);
    };
  }, [onCancel]);

  return (
    <div ref={overlayRef} className={styles.overlay}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true">
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button variant="outline" type="button" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
