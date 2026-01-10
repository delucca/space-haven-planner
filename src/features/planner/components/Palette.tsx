import { usePlanner } from '../state'
import styles from './Palette.module.css'

export function Palette() {
  const { state, dispatch } = usePlanner()
  const { catalog, selection, expandedCategories } = state

  const handleCategoryClick = (categoryId: string) => {
    dispatch({ type: 'TOGGLE_CATEGORY_EXPANDED', categoryId })
  }

  const handleStructureClick = (categoryId: string, structureId: string) => {
    dispatch({ type: 'SELECT_STRUCTURE', categoryId, structureId })
  }

  return (
    <div className={styles.palette}>
      {catalog.categories.map((category) => (
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
                      <span className={styles.itemColor} style={{ backgroundColor: item.color }} />
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
      ))}
    </div>
  )
}

