import { usePlanner } from '../state'
import { LAYERS } from '@/data/presets'
import { findStructureById } from '@/data/catalog'
import type { LayerId } from '@/data/types'
import styles from './LayerPanel.module.css'

export function LayerPanel() {
  const { state, dispatch } = usePlanner()
  const { visibleLayers, selection, catalog, previewRotation } = state

  const handleLayerToggle = (layer: LayerId) => {
    dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', layer })
  }

  // Get selected structure info
  const selectedInfo = selection ? findStructureById(catalog, selection.structureId) : null

  return (
    <div className={styles.panel}>
      {/* Layers section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Layers</h3>
        <div className={styles.layers}>
          {LAYERS.map((layer) => (
            <label key={layer} className={styles.layerItem}>
              <input
                type="checkbox"
                checked={visibleLayers.has(layer)}
                onChange={() => handleLayerToggle(layer)}
              />
              <span className={styles.layerCheckbox} />
              <span className={styles.layerName}>{layer}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Selection info section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Selected</h3>
        {selectedInfo ? (
          <div className={styles.selectionInfo}>
            <div className={styles.selectionName}>{selectedInfo.structure.name}</div>
            <div className={styles.selectionDetails}>
              Size: {selectedInfo.structure.size[0]}×{selectedInfo.structure.size[1]} tiles
            </div>
            <div className={styles.selectionDetails}>Rotation: {previewRotation}°</div>
            <div
              className={styles.selectionPreview}
              style={{ backgroundColor: selectedInfo.structure.color }}
            >
              Preview
            </div>
          </div>
        ) : (
          <div className={styles.noSelection}>Select a structure from the palette</div>
        )}
      </section>

      {/* Help section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Help</h3>
        <div className={styles.helpText}>
          <p>• Click structure to select</p>
          <p>• Click grid to place</p>
          <p>• Q/E to rotate</p>
          <p>• +/- to zoom in/out</p>
          <p>• 1/2/3 for Hull/Place/Erase</p>
          <p>• Save/Load as JSON</p>
          <p>• Export as PNG image</p>
        </div>
      </section>
    </div>
  )
}
