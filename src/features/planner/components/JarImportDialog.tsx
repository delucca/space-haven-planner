import { useCallback, useEffect, useRef } from 'react'
import styles from './JarImportDialog.module.css'

interface JarImportDialogProps {
  isOpen: boolean
  isParsing: boolean
  onClose: () => void
  onSelectFile: () => void
}

/**
 * Dialog explaining how to find spacehaven.jar and allowing upload
 */
export function JarImportDialog({
  isOpen,
  isParsing,
  onClose,
  onSelectFile,
}: JarImportDialogProps) {
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

  // Handle escape key and backdrop click
  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      // Close if clicking the backdrop (the dialog element itself)
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

  const handleUploadClick = useCallback(() => {
    onSelectFile()
    onClose()
  }, [onSelectFile, onClose])

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
          <h2 className={styles.title}>📦 Import Game Data</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </header>

        <div className={styles.body}>
          <p className={styles.intro}>
            Upload your <code>spacehaven.jar</code> file to get the latest structures from your game
            version.
          </p>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>📍 Where to find it</h3>
            <p className={styles.instruction}>
              The JAR file is located in your Space Haven installation folder:
            </p>

            <div className={styles.pathList}>
              <div className={styles.pathItem}>
                <span className={styles.platform}>🪟 Windows</span>
                <code className={styles.path}>
                  C:\Program Files (x86)\Steam\steamapps\common\SpaceHaven\spacehaven.jar
                </code>
              </div>
              <div className={styles.pathItem}>
                <span className={styles.platform}>🐧 Linux</span>
                <code className={styles.path}>
                  ~/.steam/steam/steamapps/common/SpaceHaven/spacehaven.jar
                </code>
              </div>
              <div className={styles.pathItem}>
                <span className={styles.platform}>🍎 macOS</span>
                <code className={styles.path}>
                  ~/Library/Application Support/Steam/steamapps/common/SpaceHaven/spacehaven.jar
                </code>
              </div>
            </div>

            <p className={styles.tip}>
              💡 <strong>Tip:</strong> In Steam, right-click Space Haven → Properties → Installed
              Files → Browse to open the folder directly.
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>ℹ️ What this does</h3>
            <ul className={styles.benefitList}>
              <li>Extracts all buildable structures from your game</li>
              <li>Gets accurate sizes and categories</li>
              <li>Works with any game version</li>
              <li>Data is cached locally for future sessions</li>
            </ul>
          </section>
        </div>

        <footer className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.uploadButton} onClick={handleUploadClick} disabled={isParsing}>
            {isParsing ? '⏳ Parsing...' : '📂 Select spacehaven.jar'}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
