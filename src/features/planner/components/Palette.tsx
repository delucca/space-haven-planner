import { useState, useMemo, useRef, useCallback } from 'react'
import { usePlanner } from '../state'
import { StructureInfoPopover } from './StructureInfoPopover'
import type { StructureDef, StructureCategory } from '@/data/types'
import styles from './Palette.module.css'

/** Hover delay before showing popover (ms) */
const HOVER_DELAY_MS = 500

/** Delay before closing popover when mouse leaves (ms) - allows moving to popover */
const CLOSE_DELAY_MS = 150

interface SearchMatch {
  item: StructureDef
  categoryId: string
  categoryName: string
}

/** State for hovered item popover */
interface HoveredItemState {
  structure: StructureDef
  category: StructureCategory
  anchorX: number
  anchorY: number
}

export function Palette() {
  const { state, dispatch } = usePlanner()
  const { catalog, selection, expandedCategories } = state

  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const isSearching = trimmedQuery.length > 0

  // Hover popover state
  const [hoveredItem, setHoveredItem] = useState<HoveredItemState | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingHoverRef = useRef<{ structure: StructureDef; category: StructureCategory } | null>(
    null
  )
  const mousePositionRef = useRef({ x: 0, y: 0 })

  // Build flat list of matching items when searching
  const searchMatches = useMemo<SearchMatch[]>(() => {
    if (!isSearching) return []

    const matches: SearchMatch[] = []
    for (const category of catalog.categories) {
      const categoryNameLower = category.name.toLowerCase()
      const categoryMatches = categoryNameLower.includes(trimmedQuery)

      for (const item of category.items) {
        const itemNameLower = item.name.toLowerCase()
        if (categoryMatches || itemNameLower.includes(trimmedQuery)) {
          matches.push({
            item,
            categoryId: category.id,
            categoryName: category.name,
          })
        }
      }
    }
    return matches
  }, [catalog.categories, trimmedQuery, isSearching])

  // Clear hover timer
  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    pendingHoverRef.current = null
  }, [])

  // Clear close timer
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  // Schedule popover close with delay (allows mouse to reach popover)
  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setHoveredItem(null)
    }, CLOSE_DELAY_MS)
  }, [clearCloseTimer])

  // Handle mouse enter on an item
  const handleItemMouseEnter = useCallback(
    (structure: StructureDef, category: StructureCategory, e: React.MouseEvent) => {
      // Update mouse position
      mousePositionRef.current = { x: e.clientX, y: e.clientY }

      // Cancel any pending close
      clearCloseTimer()

      // Clear any existing hover timer
      clearHoverTimer()

      // Store pending hover info
      pendingHoverRef.current = { structure, category }

      // Start delay timer
      hoverTimerRef.current = setTimeout(() => {
        if (pendingHoverRef.current) {
          setHoveredItem({
            structure: pendingHoverRef.current.structure,
            category: pendingHoverRef.current.category,
            anchorX: mousePositionRef.current.x,
            anchorY: mousePositionRef.current.y,
          })
        }
      }, HOVER_DELAY_MS)
    },
    [clearHoverTimer, clearCloseTimer]
  )

  // Handle mouse move on an item (update position for popover)
  const handleItemMouseMove = useCallback((e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  // Handle mouse leave on an item
  const handleItemMouseLeave = useCallback(() => {
    clearHoverTimer()
    // Schedule close with delay to allow mouse to reach popover
    scheduleClose()
  }, [clearHoverTimer, scheduleClose])

  // Handle popover mouse enter
  const handlePopoverMouseEnter = useCallback(() => {
    // Cancel any pending close when mouse enters popover
    clearCloseTimer()
  }, [clearCloseTimer])

  // Handle popover mouse leave
  const handlePopoverMouseLeave = useCallback(() => {
    // Schedule close with delay
    scheduleClose()
  }, [scheduleClose])

  const handleCategoryClick = (categoryId: string) => {
    dispatch({ type: 'TOGGLE_CATEGORY_EXPANDED', categoryId })
  }

  const handleStructureClick = (categoryId: string, structureId: string) => {
    // Close popover on click
    clearHoverTimer()
    clearCloseTimer()
    setHoveredItem(null)

    dispatch({ type: 'SELECT_STRUCTURE', categoryId, structureId })
    // Auto-switch to place tool when selecting a structure
    dispatch({ type: 'SET_TOOL', tool: 'place' })
  }

  // Find category by ID for search results
  const getCategoryById = useCallback(
    (categoryId: string): StructureCategory | undefined => {
      return catalog.categories.find((c) => c.id === categoryId)
    },
    [catalog.categories]
  )

  return (
    <div className={styles.palette}>
      {/* Search input */}
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search structures…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        aria-label="Search structures"
      />

      {isSearching ? (
        // Search results mode: flat list only
        <div className={styles.searchResults}>
          {searchMatches.length === 0 ? (
            <div className={styles.emptyState}>No matching structures</div>
          ) : (
            searchMatches.map((match) => {
              const isSelected =
                selection?.categoryId === match.categoryId &&
                selection?.structureId === match.item.id
              const category = getCategoryById(match.categoryId)

              return (
                <button
                  key={`${match.categoryId}-${match.item.id}`}
                  className={styles.item}
                  onClick={() => handleStructureClick(match.categoryId, match.item.id)}
                  onMouseEnter={
                    category ? (e) => handleItemMouseEnter(match.item, category, e) : undefined
                  }
                  onMouseMove={handleItemMouseMove}
                  onMouseLeave={handleItemMouseLeave}
                  data-selected={isSelected}
                >
                  <span className={styles.itemInfo}>
                    <span
                      className={styles.itemColor}
                      style={{ backgroundColor: match.item.color }}
                    />
                    <span className={styles.itemName}>{match.item.name}</span>
                  </span>
                  <span className={styles.itemSize}>
                    {match.item.size[0]}×{match.item.size[1]}
                  </span>
                </button>
              )
            })
          )}
        </div>
      ) : (
        // Normal mode: categorized collapsible sections
        catalog.categories.map((category) => (
          <div key={category.id} className={styles.category}>
            <button
              className={styles.categoryHeader}
              onClick={() => handleCategoryClick(category.id)}
              style={{ borderLeftColor: category.color }}
              data-expanded={expandedCategories.has(category.id)}
            >
              <span className={styles.categoryName}>{category.name}</span>
              <span className={styles.categoryArrow}>
                {expandedCategories.has(category.id) ? '▼' : '▶'}
              </span>
            </button>

            {expandedCategories.has(category.id) && (
              <div className={styles.items}>
                {category.items.map((item) => {
                  const isSelected =
                    selection?.categoryId === category.id && selection?.structureId === item.id

                  return (
                    <button
                      key={item.id}
                      className={styles.item}
                      onClick={() => handleStructureClick(category.id, item.id)}
                      onMouseEnter={(e) => handleItemMouseEnter(item, category, e)}
                      onMouseMove={handleItemMouseMove}
                      onMouseLeave={handleItemMouseLeave}
                      data-selected={isSelected}
                    >
                      <span className={styles.itemInfo}>
                        <span
                          className={styles.itemColor}
                          style={{ backgroundColor: item.color }}
                        />
                        <span className={styles.itemName}>{item.name}</span>
                      </span>
                      <span className={styles.itemSize}>
                        {item.size[0]}×{item.size[1]}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))
      )}

      {/* Hover popover */}
      {hoveredItem && (
        <StructureInfoPopover
          structure={hoveredItem.structure}
          category={hoveredItem.category}
          anchorX={hoveredItem.anchorX}
          anchorY={hoveredItem.anchorY}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        />
      )}
    </div>
  )
}
