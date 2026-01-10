import { useState, useMemo } from 'react'
import { usePlanner } from '../state'
import type { StructureDef } from '@/data/types'
import styles from './Palette.module.css'

interface SearchMatch {
  item: StructureDef
  categoryId: string
  categoryName: string
}

export function Palette() {
  const { state, dispatch } = usePlanner()
  const { catalog, selection, expandedCategories } = state

  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const isSearching = trimmedQuery.length > 0

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

  const handleCategoryClick = (categoryId: string) => {
    dispatch({ type: 'TOGGLE_CATEGORY_EXPANDED', categoryId })
  }

  const handleStructureClick = (categoryId: string, structureId: string) => {
    dispatch({ type: 'SELECT_STRUCTURE', categoryId, structureId })
    // Auto-switch to place tool when selecting a structure
    dispatch({ type: 'SET_TOOL', tool: 'place' })
  }

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

              return (
                <button
                  key={`${match.categoryId}-${match.item.id}`}
                  className={styles.item}
                  onClick={() => handleStructureClick(match.categoryId, match.item.id)}
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
    </div>
  )
}
