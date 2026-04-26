import { useEffect, useState } from 'react'
import { capture } from '@/lib/analytics'
import styles from './FloatingSupportButton.module.css'

const BMAC_URL = 'https://buymeacoffee.com/spacehavenplanner'
const CANNY_URL = 'https://space-haven-planner.canny.io'

const DEFAULT_COFFEE_LABEL = 'Support this project ☕'

const PULSE_LABELS = [
  'Enjoying it? Buy me a coffee ☕',
  'Saved you time? Tip the dev ☕',
  'Free forever — powered by your ☕',
  'Caffeinate the next update ☕',
  'Solo dev. Lots of coffee. ☕',
  'Fund the roadmap ☕',
]

const PULSE_INTERVAL_MS = 60_000
const PULSE_DURATION_MS = 4_000

export function FloatingSupportButton() {
  const [pulseIdx, setPulseIdx] = useState(-1)
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    let endTimer: ReturnType<typeof setTimeout> | undefined
    const intervalTimer = setInterval(() => {
      setPulseIdx((i) => (i + 1) % PULSE_LABELS.length)
      setIsPulsing(true)
      if (endTimer) clearTimeout(endTimer)
      endTimer = setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS)
    }, PULSE_INTERVAL_MS)

    return () => {
      clearInterval(intervalTimer)
      if (endTimer) clearTimeout(endTimer)
    }
  }, [])

  const handleFeedbackClick = () => {
    capture('support_click', { target: 'feedback' })
  }

  const handleCoffeeClick = () => {
    capture('support_click', { target: 'coffee' })
  }

  const coffeeLabel = isPulsing && pulseIdx >= 0 ? PULSE_LABELS[pulseIdx] : DEFAULT_COFFEE_LABEL

  return (
    <>
      <a
        href={CANNY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.button} ${styles.feedbackButton}`}
        aria-label="Send feedback or request features"
        onClick={handleFeedbackClick}
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
        className={`${styles.button} ${styles.coffeeButton}${isPulsing ? ` ${styles.pulsing}` : ''}`}
        aria-label="Support this project - Buy me a coffee"
        onClick={handleCoffeeClick}
      >
        <span className={styles.steam} aria-hidden="true">
          <span className={styles.steamWisp} />
          <span className={styles.steamWisp} />
        </span>
        <span className={styles.label}>{coffeeLabel}</span>
      </a>
    </>
  )
}
