import styles from './FloatingSupportButton.module.css'

const BMAC_URL = 'https://buymeacoffee.com/delucca'

/**
 * Floating "Buy me a coffee" button - always visible in bottom-right corner.
 * Opens the Buy Me a Coffee page in a new tab.
 *
 * Named generically ("Support") so it can later evolve into a modal/popover
 * with multiple support options (Canny, contact, etc.).
 */
export function FloatingSupportButton() {
  return (
    <a
      href={BMAC_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.button}
      aria-label="Support this project - Buy me a coffee"
    >
      <span className={styles.icon} aria-hidden="true">
        ☕
      </span>
      <span className={styles.label}>Buy me a coffee</span>
    </a>
  )
}

