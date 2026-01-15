import { useCallback, useEffect, useRef } from 'react'
import styles from './ConfirmDialog.module.css'

export type ConfirmDialogVariant = 'default' | 'danger'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  variant?: ConfirmDialogVariant
  confirmDisabled?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'default',
  confirmDisabled = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Sync dialog open state with the native dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Close if clicking the backdrop (the dialog element itself)
  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  const handleCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault()
      onClose()
    },
    [onClose]
  )

  const handleConfirm = useCallback(() => {
    onConfirm()
    onClose()
  }, [onConfirm, onClose])

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={handleDialogClick}
      onCancel={handleCancel}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.message}>{message}</div>
        </div>

        <footer className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={`${styles.confirmButton} ${variant === 'danger' ? styles.confirmButtonDanger : ''}`}
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </dialog>
  )
}


