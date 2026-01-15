import { useCallback, useEffect, useRef, useState } from 'react'
import { Select } from '@/components/Select'
import type { SaveParseResult, ShipConversionResult } from '@/data/saveGame'
import styles from './SaveImportDialog.module.css'

type DialogStep = 'select_file' | 'select_ship' | 'confirm' | 'result'

interface SaveImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (shipSid: string, parseResult: SaveParseResult) => Promise<ShipConversionResult>
  parseResult: SaveParseResult | null
  isLoading: boolean
  error: string | null
  conversionResult: ShipConversionResult | null
  onSelectFile: () => void
  onReset: () => void
}

/**
 * Dialog for importing a ship from a Space Haven save file
 */
export function SaveImportDialog({
  isOpen,
  onClose,
  onImport,
  parseResult,
  isLoading,
  error,
  conversionResult,
  onSelectFile,
  onReset,
}: SaveImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedShipSid, setSelectedShipSid] = useState<string>('')
  const [step, setStep] = useState<DialogStep>('select_file')
  const [isImporting, setIsImporting] = useState(false)

  // Determine current step based on state
  useEffect(() => {
    if (conversionResult) {
      setStep('result')
    } else if (parseResult && parseResult.playerShips.length > 0) {
      setStep('select_ship')
      // Auto-select first ship if none selected
      if (!selectedShipSid && parseResult.playerShips.length > 0) {
        setSelectedShipSid(parseResult.playerShips[0].sid)
      }
    } else {
      setStep('select_file')
    }
  }, [parseResult, conversionResult, selectedShipSid])

  // Sync dialog open state
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedShipSid('')
      setStep('select_file')
      setIsImporting(false)
    }
  }, [isOpen])

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

  const handleSelectFileClick = useCallback(() => {
    onSelectFile()
  }, [onSelectFile])

  const handleImportClick = useCallback(async () => {
    if (!parseResult || !selectedShipSid) return

    setIsImporting(true)
    try {
      await onImport(selectedShipSid, parseResult)
    } finally {
      setIsImporting(false)
    }
  }, [parseResult, selectedShipSid, onImport])

  const handleDone = useCallback(() => {
    onClose()
  }, [onClose])

  const handleTryAnother = useCallback(() => {
    onReset()
    setSelectedShipSid('')
    setStep('select_file')
  }, [onReset])

  const shipOptions =
    parseResult?.playerShips.map((ship) => ({
      value: ship.sid,
      label: `${ship.name} (${ship.width}×${ship.height})`,
    })) ?? []

  const selectedShip = parseResult?.playerShips.find((s) => s.sid === selectedShipSid)

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
          <h2 className={styles.title}>🚀 Import Ship from Save</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {/* Step 1: Select File */}
          {step === 'select_file' && (
            <>
              <p className={styles.intro}>
                Import a ship layout from your Space Haven save file. This will load the hull and
                structures onto the planner canvas.
              </p>

              {error && <div className={styles.error}>{error}</div>}

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>📍 Where to find your save</h3>
                <p className={styles.instruction}>
                  Look for a file named <code>game</code> (no extension) in your save folder:
                </p>

                <div className={styles.pathList}>
                  <div className={styles.pathItem}>
                    <span className={styles.platform}>🪟 Windows</span>
                    <code className={styles.path}>
                      %APPDATA%\SpaceHaven\savegames\[SaveName]\save\game
                    </code>
                  </div>
                  <div className={styles.pathItem}>
                    <span className={styles.platform}>🐧 Linux</span>
                    <code className={styles.path}>
                      ~/.config/SpaceHaven/savegames/[SaveName]/save/game
                    </code>
                  </div>
                  <div className={styles.pathItem}>
                    <span className={styles.platform}>🍎 macOS</span>
                    <code className={styles.path}>
                      ~/Library/Application Support/SpaceHaven/savegames/[SaveName]/save/game
                    </code>
                  </div>
                </div>

                <p className={styles.tip}>
                  💡 <strong>Tip:</strong> You can also use files from <code>autosave1/</code>,{' '}
                  <code>autosave2/</code>, etc. if you want an earlier state.
                </p>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>ℹ️ What gets imported</h3>
                <ul className={styles.benefitList}>
                  <li>Hull tiles and floor layout</li>
                  <li>All buildable structures (matched to your catalog)</li>
                  <li>Structure positions and rotations</li>
                </ul>
                <p className={styles.note}>
                  <strong>Note:</strong> Crew, items, and game state are not imported — only the
                  ship layout.
                </p>
              </section>
            </>
          )}

          {/* Step 2: Select Ship */}
          {step === 'select_ship' && parseResult && (
            <>
              <p className={styles.intro}>
                Found <strong>{parseResult.playerShips.length}</strong> player-owned ship
                {parseResult.playerShips.length !== 1 ? 's' : ''} in your save. Select which one to
                import:
              </p>

              <div className={styles.shipSelector}>
                <label className={styles.label} htmlFor="ship-select">
                  Select Ship
                </label>
                <Select
                  options={shipOptions}
                  value={selectedShipSid}
                  onChange={setSelectedShipSid}
                  placeholder="Choose a ship..."
                  aria-label="Select ship to import"
                />
              </div>

              {selectedShip && (
                <div className={styles.shipPreview}>
                  <h4 className={styles.shipName}>{selectedShip.name}</h4>
                  <p className={styles.shipDetails}>
                    Grid size: {selectedShip.width} × {selectedShip.height} tiles
                  </p>
                </div>
              )}

              <div className={styles.warning}>
                ⚠️ <strong>Warning:</strong> Importing will replace your current canvas. Make sure
                to save your work first!
              </div>
            </>
          )}

          {/* Step 3: Result */}
          {step === 'result' && conversionResult && (
            <>
              <div className={styles.success}>
                ✅ <strong>Import complete!</strong>
              </div>

              <div className={styles.stats}>
                <h4 className={styles.statsTitle}>Import Summary</h4>
                <ul className={styles.statsList}>
                  <li>
                    <span className={styles.statLabel}>Hull tiles:</span>
                    <span className={styles.statValue}>
                      {conversionResult.stats.hullTilesCreated}
                    </span>
                  </li>
                  <li>
                    <span className={styles.statLabel}>Structures:</span>
                    <span className={styles.statValue}>
                      {conversionResult.stats.structuresCreated}
                    </span>
                  </li>
                  <li>
                    <span className={styles.statLabel}>Canvas preset:</span>
                    <span className={styles.statValue}>{conversionResult.preset.label}</span>
                  </li>
                </ul>
              </div>

              {conversionResult.warnings.length > 0 && (
                <div className={styles.warnings}>
                  <h4 className={styles.warningsTitle}>⚠️ Warnings</h4>
                  <ul className={styles.warningsList}>
                    {conversionResult.warnings.map((warning, index) => (
                      <li key={index} className={styles.warningItem}>
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className={styles.loading}>
              <span className={styles.spinner}>⏳</span>
              <span>Parsing save file...</span>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          {step === 'select_file' && (
            <>
              <button className={styles.cancelButton} onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                onClick={handleSelectFileClick}
                disabled={isLoading}
              >
                {isLoading ? '⏳ Loading...' : '📂 Select save file'}
              </button>
            </>
          )}

          {step === 'select_ship' && (
            <>
              <button className={styles.cancelButton} onClick={handleTryAnother}>
                ← Back
              </button>
              <button
                className={styles.primaryButton}
                onClick={handleImportClick}
                disabled={!selectedShipSid || isImporting}
              >
                {isImporting ? '⏳ Importing...' : '🚀 Import Ship'}
              </button>
            </>
          )}

          {step === 'result' && (
            <>
              <button className={styles.cancelButton} onClick={handleTryAnother}>
                Import Another
              </button>
              <button className={styles.primaryButton} onClick={handleDone}>
                Done
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  )
}

