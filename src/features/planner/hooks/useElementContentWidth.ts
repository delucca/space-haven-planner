import { useEffect, useState, type RefObject } from 'react'

/**
 * Hook that measures the content box width of an element using ResizeObserver.
 * Returns the width in pixels, or 0 if the element is not yet mounted.
 */
export function useElementContentWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use contentBoxSize if available, otherwise fall back to contentRect
        if (entry.contentBoxSize && entry.contentBoxSize.length > 0) {
          setWidth(entry.contentBoxSize[0].inlineSize)
        } else {
          setWidth(entry.contentRect.width)
        }
      }
    })

    observer.observe(element)

    // Get initial size
    const rect = element.getBoundingClientRect()
    const computedStyle = getComputedStyle(element)
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0
    setWidth(rect.width - paddingLeft - paddingRight)

    return () => {
      observer.disconnect()
    }
  }, [ref])

  return width
}


