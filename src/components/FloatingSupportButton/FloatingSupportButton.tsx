import styles from './FloatingSupportButton.module.css'

const BMAC_URL = 'https://buymeacoffee.com/delucca'
const CANNY_URL = 'https://space-haven-planner.canny.io'

/**
 * Floating support buttons - always visible in bottom-right corner.
 * Contains:
 * - "Feedback" link that opens Canny board in a new tab
 * - "Buy me a coffee" link that opens in a new tab
 */
export function FloatingSupportButton() {
  return (
    <div className={styles.stack}>
      <a
        href={CANNY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.button} ${styles.feedbackButton}`}
        aria-label="Send feedback or request features"
      >
        <span className={styles.icon} aria-hidden="true">
          💬
        </span>
        <span className={styles.label}>Feedback</span>
      </a>

      <a
        href={BMAC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.button} ${styles.coffeeButton}`}
        aria-label="Support this project - Buy me a coffee"
      >
        <span className={styles.icon} aria-hidden="true">
          ☕
        </span>
        <span className={styles.label}>Buy me a coffee</span>
      </a>
    </div>
  )
}
