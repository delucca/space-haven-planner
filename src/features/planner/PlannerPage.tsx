import { useState, useEffect, useCallback, useRef } from 'react'
import { PlannerProvider, usePlanner } from './state'
import { CanvasViewport } from './canvas'
import { Palette, Toolbar, LayerPanel, StatusBar, ActionBar, LayoutControls } from './components'
import {
  useKeyboardShortcuts,
  useAutosave,
  useCatalogRefresh,
  useInitialZoom,
  useElementContentWidth,
} from './hooks'
import styles from './PlannerPage.module.css'

// Layout constants
const LEFT_DEFAULT_WIDTH = 280
const LEFT_MIN_WIDTH = 220
const LEFT_MAX_WIDTH = 520
const RIGHT_DEFAULT_WIDTH = 320
const RIGHT_MIN_WIDTH = 240
const RIGHT_MAX_WIDTH = 640

const LAYOUT_STORAGE_KEY = 'space-haven-planner-layout'

interface LayoutState {
  leftWidth: number
  rightWidth: number
  isLeftCollapsed: boolean
  isRightCollapsed: boolean
}

function loadLayoutState(): LayoutState {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<LayoutState>
      return {
        leftWidth: clamp(parsed.leftWidth ?? LEFT_DEFAULT_WIDTH, LEFT_MIN_WIDTH, LEFT_MAX_WIDTH),
        rightWidth: clamp(
          parsed.rightWidth ?? RIGHT_DEFAULT_WIDTH,
          RIGHT_MIN_WIDTH,
          RIGHT_MAX_WIDTH
        ),
        isLeftCollapsed: parsed.isLeftCollapsed ?? false,
        isRightCollapsed: parsed.isRightCollapsed ?? false,
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {
    leftWidth: LEFT_DEFAULT_WIDTH,
    rightWidth: RIGHT_DEFAULT_WIDTH,
    isLeftCollapsed: false,
    isRightCollapsed: false,
  }
}

function saveLayoutState(state: LayoutState): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function PlannerContent() {
  const { state, dispatch } = usePlanner()

  // Layout state
  const [layout, setLayout] = useState<LayoutState>(loadLayoutState)

  // Peek state (transient, not persisted)
  const [isLeftPeeking, setIsLeftPeeking] = useState(false)
  const [isRightPeeking, setIsRightPeeking] = useState(false)

  // Resize dragging state
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)

  // Ref for canvas container (for measuring width)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Measure canvas container content width for dynamic zoom baseline
  const canvasContentWidth = useElementContentWidth(canvasContainerRef)

  // Persist layout changes
  useEffect(() => {
    saveLayoutState(layout)
  }, [layout])

  // Set initial zoom to fit grid width within viewport
  useInitialZoom(dispatch, state.gridSize.width, canvasContentWidth)

  // Enable keyboard shortcuts
  useKeyboardShortcuts(dispatch, state.zoom, state.gridSize.width, canvasContentWidth)

  // Enable localStorage autosave
  useAutosave(state, dispatch)

  // Enable catalog refresh from wiki
  useCatalogRefresh(state, dispatch)

  // Layout toggle handlers
  const handleToggleLeft = useCallback(() => {
    setLayout((prev) => ({ ...prev, isLeftCollapsed: !prev.isLeftCollapsed }))
    setIsLeftPeeking(false)
  }, [])

  const handleToggleRight = useCallback(() => {
    setLayout((prev) => ({ ...prev, isRightCollapsed: !prev.isRightCollapsed }))
    setIsRightPeeking(false)
  }, [])

  const handleToggleBoth = useCallback(() => {
    setLayout((prev) => {
      const bothCollapsed = prev.isLeftCollapsed && prev.isRightCollapsed
      return {
        ...prev,
        isLeftCollapsed: !bothCollapsed,
        isRightCollapsed: !bothCollapsed,
      }
    })
    setIsLeftPeeking(false)
    setIsRightPeeking(false)
  }, [])

  // Resize handlers for left panel
  const handleLeftResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingLeft(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handleLeftResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingLeft) return
      const newWidth = clamp(e.clientX, LEFT_MIN_WIDTH, LEFT_MAX_WIDTH)
      setLayout((prev) => ({ ...prev, leftWidth: newWidth }))
    },
    [isDraggingLeft]
  )

  const handleLeftResizeEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingLeft) return
      setIsDraggingLeft(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [isDraggingLeft]
  )

  // Resize handlers for right panel
  const handleRightResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingRight(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handleRightResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRight) return
      const newWidth = clamp(window.innerWidth - e.clientX, RIGHT_MIN_WIDTH, RIGHT_MAX_WIDTH)
      setLayout((prev) => ({ ...prev, rightWidth: newWidth }))
    },
    [isDraggingRight]
  )

  const handleRightResizeEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRight) return
      setIsDraggingRight(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [isDraggingRight]
  )

  // Peek hover handlers for collapsed left sidebar
  const handleLeftPeekEnter = useCallback(() => {
    if (layout.isLeftCollapsed) {
      setIsLeftPeeking(true)
    }
  }, [layout.isLeftCollapsed])

  const handleLeftPeekLeave = useCallback(() => {
    setIsLeftPeeking(false)
  }, [])

  // Peek hover handlers for collapsed right sidebar
  const handleRightPeekEnter = useCallback(() => {
    if (layout.isRightCollapsed) {
      setIsRightPeeking(true)
    }
  }, [layout.isRightCollapsed])

  const handleRightPeekLeave = useCallback(() => {
    setIsRightPeeking(false)
  }, [])

  const isResizing = isDraggingLeft || isDraggingRight

  return (
    <div className={styles.container} data-resizing={isResizing || undefined}>
      {/* Left Panel - Docked */}
      {!layout.isLeftCollapsed && (
        <>
          <aside
            className={styles.leftPanel}
            style={{ width: layout.leftWidth, minWidth: layout.leftWidth }}
          >
            <div className={styles.header}>
              <h1 className={styles.title}>Space Haven Planner</h1>
              <p className={styles.subtitle}>Ship Design Tool</p>
            </div>
            <div className={styles.palette}>
              <Palette />
            </div>
          </aside>
          <div
            className={styles.resizeHandle}
            data-side="left"
            onPointerDown={handleLeftResizeStart}
            onPointerMove={handleLeftResizeMove}
            onPointerUp={handleLeftResizeEnd}
            onPointerCancel={handleLeftResizeEnd}
          />
        </>
      )}

      {/* Left Panel - Peek Trigger (when collapsed) */}
      {layout.isLeftCollapsed && (
        <div className={styles.peekTrigger} data-side="left" onMouseEnter={handleLeftPeekEnter} />
      )}

      {/* Left Panel - Peek Overlay */}
      {layout.isLeftCollapsed && isLeftPeeking && (
        <aside
          className={styles.peekOverlay}
          data-side="left"
          style={{ width: layout.leftWidth }}
          onMouseLeave={handleLeftPeekLeave}
        >
          <div className={styles.header}>
            <h1 className={styles.title}>Space Haven Planner</h1>
            <p className={styles.subtitle}>Ship Design Tool</p>
          </div>
          <div className={styles.palette}>
            <Palette />
          </div>
        </aside>
      )}

      <main className={styles.main}>
        <div className={styles.toolbarRow}>
          <LayoutControls
            isLeftCollapsed={layout.isLeftCollapsed}
            isRightCollapsed={layout.isRightCollapsed}
            onToggleLeft={handleToggleLeft}
            onToggleRight={handleToggleRight}
            onToggleBoth={handleToggleBoth}
          />
          <Toolbar canvasContentWidth={canvasContentWidth} />
          <ActionBar />
        </div>
        <div className={styles.canvasContainer} ref={canvasContainerRef}>
          <CanvasViewport />
        </div>
        <div className={styles.statusBar}>
          <StatusBar />
        </div>
      </main>

      {/* Right Panel - Peek Trigger (when collapsed) */}
      {layout.isRightCollapsed && (
        <div className={styles.peekTrigger} data-side="right" onMouseEnter={handleRightPeekEnter} />
      )}

      {/* Right Panel - Peek Overlay */}
      {layout.isRightCollapsed && isRightPeeking && (
        <aside
          className={styles.peekOverlay}
          data-side="right"
          style={{ width: layout.rightWidth }}
          onMouseLeave={handleRightPeekLeave}
        >
          <LayerPanel />
        </aside>
      )}

      {/* Right Panel - Docked */}
      {!layout.isRightCollapsed && (
        <>
          <div
            className={styles.resizeHandle}
            data-side="right"
            onPointerDown={handleRightResizeStart}
            onPointerMove={handleRightResizeMove}
            onPointerUp={handleRightResizeEnd}
            onPointerCancel={handleRightResizeEnd}
          />
          <aside
            className={styles.rightPanel}
            style={{ width: layout.rightWidth, minWidth: layout.rightWidth }}
          >
            <LayerPanel />
          </aside>
        </>
      )}
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
