import styles from './LayoutControls.module.css'

interface LayoutControlsProps {
  isLeftCollapsed: boolean
  isRightCollapsed: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  onToggleBoth: () => void
}

/** Icon: sidebar left (open state) */
function SidebarLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="1"
        y="2"
        width="14"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="1" y="2" width="5" height="12" fill="currentColor" opacity="0.4" />
      <line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Icon: sidebar right (open state) */
function SidebarRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="1"
        y="2"
        width="14"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="10" y="2" width="5" height="12" fill="currentColor" opacity="0.4" />
      <line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Icon: both sidebars (open state) */
function SidebarBothIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="1"
        y="2"
        width="14"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="1" y="2" width="4" height="12" fill="currentColor" opacity="0.4" />
      <rect x="11" y="2" width="4" height="12" fill="currentColor" opacity="0.4" />
      <line x1="5" y1="2" x2="5" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <line x1="11" y1="2" x2="11" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function LayoutControls({
  isLeftCollapsed,
  isRightCollapsed,
  onToggleLeft,
  onToggleRight,
  onToggleBoth,
}: LayoutControlsProps) {
  const bothCollapsed = isLeftCollapsed && isRightCollapsed

  return (
    <div className={styles.controls}>
      <button
        className={styles.button}
        onClick={onToggleLeft}
        title={isLeftCollapsed ? 'Show left sidebar' : 'Hide left sidebar'}
        data-active={!isLeftCollapsed}
        aria-label={isLeftCollapsed ? 'Show left sidebar' : 'Hide left sidebar'}
      >
        <SidebarLeftIcon />
      </button>
      <button
        className={styles.button}
        onClick={onToggleBoth}
        title={bothCollapsed ? 'Show both sidebars' : 'Hide both sidebars'}
        data-active={!bothCollapsed}
        aria-label={bothCollapsed ? 'Show both sidebars' : 'Hide both sidebars'}
      >
        <SidebarBothIcon />
      </button>
      <button
        className={styles.button}
        onClick={onToggleRight}
        title={isRightCollapsed ? 'Show right sidebar' : 'Hide right sidebar'}
        data-active={!isRightCollapsed}
        aria-label={isRightCollapsed ? 'Show right sidebar' : 'Hide right sidebar'}
      >
        <SidebarRightIcon />
      </button>
    </div>
  )
}


