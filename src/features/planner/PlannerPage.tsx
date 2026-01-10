import { PlannerProvider, usePlanner } from './state'
import { CanvasViewport } from './canvas'
import { Palette, Toolbar, LayerPanel, StatusBar, ActionBar } from './components'
import { useKeyboardShortcuts, useAutosave, useCatalogRefresh } from './hooks'
import styles from './PlannerPage.module.css'

function PlannerContent() {
  const { state, dispatch } = usePlanner()

  // Enable keyboard shortcuts
  useKeyboardShortcuts(dispatch, state.zoom)

  // Enable localStorage autosave
  useAutosave(state, dispatch)

  // Enable catalog refresh from wiki
  useCatalogRefresh(state, dispatch)

  return (
    <div className={styles.container}>
      <aside className={styles.leftPanel}>
        <div className={styles.header}>
          <h1 className={styles.title}>Space Haven Planner</h1>
          <p className={styles.subtitle}>Ship Design Tool</p>
        </div>
        <div className={styles.palette}>
          <Palette />
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.toolbarRow}>
          <Toolbar />
          <ActionBar />
        </div>
        <div className={styles.canvasContainer}>
          <CanvasViewport />
        </div>
        <div className={styles.statusBar}>
          <StatusBar />
        </div>
      </main>

      <aside className={styles.rightPanel}>
        <LayerPanel />
      </aside>
    </div>
  )
}

export function PlannerPage() {
  return (
    <PlannerProvider>
      <PlannerContent />
    </PlannerProvider>
  )
}
