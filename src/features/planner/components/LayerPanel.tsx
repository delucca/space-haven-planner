import { useState, useCallback } from 'react'
import { usePlanner } from '../state'
import { findStructureById } from '@/data/catalog'
import type { UserLayer, UserGroup, PlacedStructure } from '@/data/types'
import { ConfirmDialog } from './ConfirmDialog'
import styles from './LayerPanel.module.css'

interface EditingState {
  type: 'layer' | 'group'
  id: string
  name: string
}

// Minimalist SVG icons (Photoshop-style)
const EyeIcon = ({ visible }: { visible: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    {visible ? (
      <>
        <path
          d="M7 3C3.5 3 1 7 1 7C1 7 3.5 11 7 11C10.5 11 13 7 13 7C13 7 10.5 3 7 3Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
        <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </>
    ) : (
      <>
        <path
          d="M7 3C3.5 3 1 7 1 7C1 7 3.5 11 7 11C10.5 11 13 7 13 7C13 7 10.5 3 7 3Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          opacity="0.3"
        />
        <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.2" />
      </>
    )}
  </svg>
)

const LockIcon = ({ locked }: { locked: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    {locked ? (
      <>
        <rect
          x="3"
          y="6"
          width="8"
          height="6"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
        <path
          d="M5 6V4C5 2.89543 5.89543 2 7 2C8.10457 2 9 2.89543 9 4V6"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="7" cy="9" r="1" fill="currentColor" />
      </>
    ) : (
      <>
        <rect
          x="3"
          y="6"
          width="8"
          height="6"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          opacity="0.3"
        />
        <path
          d="M5 6V4C5 2.89543 5.89543 2 7 2C8.10457 2 9 2.89543 9 4"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.3"
        />
      </>
    )}
  </svg>
)

export function LayerPanel() {
  const { state, dispatch } = usePlanner()
  const {
    userLayers,
    userGroups,
    structures,
    catalog,
    activeLayerId,
    activeGroupId,
    expandedLayerIds,
    expandedGroupIds,
    selection,
    previewRotation,
  } = state

  const [editing, setEditing] = useState<EditingState | null>(null)
  const [newLayerName, setNewLayerName] = useState('')
  const [newGroupLayerId, setNewGroupLayerId] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'layer' | 'group'
    id: string
    name: string
  } | null>(null)
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null)
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null)
  const [showAddLayerForm, setShowAddLayerForm] = useState(false)

  // Get structures in a group (or ungrouped in a layer)
  const getStructuresInGroup = useCallback(
    (layerId: string, groupId: string | null) => {
      if (groupId) {
        return structures.filter((s) => s.orgGroupId === groupId)
      }
      // Ungrouped structures in this layer
      return structures.filter((s) => s.orgLayerId === layerId && !s.orgGroupId)
    },
    [structures]
  )

  // Get groups in a layer
  const getGroupsInLayer = useCallback(
    (layerId: string) => {
      return userGroups.filter((g) => g.layerId === layerId).sort((a, b) => a.order - b.order)
    },
    [userGroups]
  )

  // Handlers
  const handleToggleLayerVisible = (layerId: string) => {
    dispatch({ type: 'TOGGLE_LAYER_VISIBLE', layerId })
  }

  const handleToggleLayerLock = (layerId: string) => {
    dispatch({ type: 'TOGGLE_LAYER_LOCK', layerId })
  }

  const handleToggleLayerExpanded = (layerId: string) => {
    dispatch({ type: 'TOGGLE_LAYER_EXPANDED', layerId })
  }

  const handleSetActiveLayer = (layerId: string) => {
    // Always set the layer - there should always be one layer selected
    dispatch({ type: 'SET_ACTIVE_LAYER', layerId })
  }

  const handleDeleteLayer = (layer: UserLayer) => {
    // Don't allow deleting locked layers
    if (layer.isLocked) return
    setDeleteConfirm({ type: 'layer', id: layer.id, name: layer.name })
  }

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return
    if (deleteConfirm.type === 'layer') {
      dispatch({ type: 'DELETE_LAYER_AND_ITEMS', layerId: deleteConfirm.id })
    } else {
      dispatch({ type: 'DELETE_GROUP_AND_ITEMS', groupId: deleteConfirm.id })
    }
    setDeleteConfirm(null)
  }

  const handleToggleGroupVisible = (groupId: string) => {
    dispatch({ type: 'TOGGLE_GROUP_VISIBLE', groupId })
  }

  const handleToggleGroupLock = (groupId: string) => {
    dispatch({ type: 'TOGGLE_GROUP_LOCK', groupId })
  }

  const handleToggleGroupExpanded = (groupId: string) => {
    dispatch({ type: 'TOGGLE_GROUP_EXPANDED', groupId })
  }

  const handleSetActiveGroup = (groupId: string) => {
    dispatch({ type: 'SET_ACTIVE_GROUP', groupId: activeGroupId === groupId ? null : groupId })
  }

  const handleDeleteGroup = (group: UserGroup) => {
    setDeleteConfirm({ type: 'group', id: group.id, name: group.name })
  }

  const handleDeleteStructure = (structureId: string) => {
    dispatch({ type: 'DELETE_STRUCTURE', structureId })
  }

  const handleStartRename = (type: 'layer' | 'group', id: string, name: string) => {
    setEditing({ type, id, name })
  }

  const handleFinishRename = () => {
    if (!editing) return
    if (editing.name.trim()) {
      if (editing.type === 'layer') {
        dispatch({ type: 'RENAME_LAYER', layerId: editing.id, name: editing.name.trim() })
      } else {
        dispatch({ type: 'RENAME_GROUP', groupId: editing.id, name: editing.name.trim() })
      }
    }
    setEditing(null)
  }

  const handleCreateLayer = () => {
    if (newLayerName.trim()) {
      dispatch({ type: 'CREATE_LAYER', name: newLayerName.trim() })
      setNewLayerName('')
      setShowAddLayerForm(false)
    }
  }

  const handleCreateGroup = (layerId: string) => {
    if (newGroupName.trim()) {
      dispatch({ type: 'CREATE_GROUP', layerId, name: newGroupName.trim() })
      setNewGroupName('')
      setNewGroupLayerId(null)
    }
  }

  // Drag and drop handlers for layer reordering
  const handleDragStart = (e: React.DragEvent, layerId: string) => {
    setDraggedLayerId(layerId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', layerId)
  }

  const handleDragOver = (e: React.DragEvent, layerId: string) => {
    e.preventDefault()
    if (draggedLayerId && draggedLayerId !== layerId) {
      setDragOverLayerId(layerId)
    }
  }

  const handleDragLeave = () => {
    setDragOverLayerId(null)
  }

  const handleDrop = (e: React.DragEvent, targetLayerId: string) => {
    e.preventDefault()
    if (!draggedLayerId || draggedLayerId === targetLayerId) {
      setDraggedLayerId(null)
      setDragOverLayerId(null)
      return
    }

    // Find the target layer's order and swap positions
    const targetLayer = userLayers.find((l) => l.id === targetLayerId)
    const draggedLayer = userLayers.find((l) => l.id === draggedLayerId)

    if (targetLayer && draggedLayer) {
      // Swap orders
      dispatch({ type: 'REORDER_LAYER', layerId: draggedLayerId, newOrder: targetLayer.order })
      dispatch({ type: 'REORDER_LAYER', layerId: targetLayerId, newOrder: draggedLayer.order })
    }

    setDraggedLayerId(null)
    setDragOverLayerId(null)
  }

  const handleDragEnd = () => {
    setDraggedLayerId(null)
    setDragOverLayerId(null)
  }

  // Get selected structure info for preview
  const selectedInfo = selection ? findStructureById(catalog, selection.structureId) : null

  // Sort layers by order
  const sortedLayers = [...userLayers].sort((a, b) => a.order - b.order)

  // Check if all layers are visible/locked/expanded for header toggle state
  const allVisible = userLayers.every((l) => l.isVisible)
  const allLocked = userLayers.every((l) => l.isLocked)
  const allExpanded = userLayers.every((l) => expandedLayerIds.has(l.id))

  // Toggle all visibility
  const handleToggleAllVisible = () => {
    // If all visible, hide all. Otherwise, show all.
    const newVisibility = !allVisible
    userLayers.forEach((layer) => {
      if (layer.isVisible !== newVisibility) {
        dispatch({ type: 'TOGGLE_LAYER_VISIBLE', layerId: layer.id })
      }
    })
  }

  // Toggle all lock
  const handleToggleAllLock = () => {
    // If all locked, unlock all. Otherwise, lock all.
    const newLocked = !allLocked
    userLayers.forEach((layer) => {
      if (layer.isLocked !== newLocked) {
        dispatch({ type: 'TOGGLE_LAYER_LOCK', layerId: layer.id })
      }
    })
  }

  // Toggle all expanded
  const handleToggleAllExpanded = () => {
    // If all expanded, collapse all. Otherwise, expand all.
    const shouldExpand = !allExpanded
    userLayers.forEach((layer) => {
      const isExpanded = expandedLayerIds.has(layer.id)
      if (isExpanded !== shouldExpand) {
        dispatch({ type: 'TOGGLE_LAYER_EXPANDED', layerId: layer.id })
      }
    })
  }

  return (
    <div className={styles.panel}>
      {/* Layer Manager section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Layers</h3>
        </div>

        {/* Header row with icons */}
        <div className={styles.layerHeader}>
          <button
            className={`${styles.headerExpandBtn} ${allExpanded ? styles.allActive : ''}`}
            onClick={handleToggleAllExpanded}
            title={allExpanded ? 'Collapse all layers' : 'Expand all layers'}
          >
            {allExpanded ? '▼' : '▶'}
          </button>
          <button
            className={`${styles.headerIconBtn} ${allVisible ? styles.allActive : ''}`}
            onClick={handleToggleAllVisible}
            title={allVisible ? 'Hide all layers' : 'Show all layers'}
          >
            <EyeIcon visible={allVisible} />
          </button>
          <button
            className={`${styles.headerIconBtn} ${allLocked ? styles.allActive : ''}`}
            onClick={handleToggleAllLock}
            title={allLocked ? 'Unlock all layers' : 'Lock all layers'}
          >
            <LockIcon locked={allLocked} />
          </button>
          <span className={styles.headerLabel}>Name</span>
        </div>

        <div className={styles.layerTree}>
          {sortedLayers.map((layer) => {
            const isExpanded = expandedLayerIds.has(layer.id)
            const isActive = activeLayerId === layer.id
            const groups = getGroupsInLayer(layer.id)
            const ungroupedStructures = getStructuresInGroup(layer.id, null)

            const isDragging = draggedLayerId === layer.id
            const isDragOver = dragOverLayerId === layer.id

            return (
              <div key={layer.id} className={styles.layerNode}>
                {/* Layer row */}
                <div
                  className={`${styles.layerRow} ${isActive ? styles.active : ''} ${isDragging ? styles.dragging : ''} ${isDragOver ? styles.dragOver : ''}`}
                  onClick={() => handleSetActiveLayer(layer.id)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, layer.id)}
                  onDragOver={(e) => handleDragOver(e, layer.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, layer.id)}
                  onDragEnd={handleDragEnd}
                >
                  <button
                    className={styles.expandBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleLayerExpanded(layer.id)
                    }}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>

                  <button
                    className={`${styles.iconBtn} ${layer.isVisible ? styles.visible : styles.hidden}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleLayerVisible(layer.id)
                    }}
                    title={layer.isVisible ? 'Hide layer' : 'Show layer'}
                  >
                    <EyeIcon visible={layer.isVisible} />
                  </button>

                  <button
                    className={`${styles.iconBtn} ${layer.isLocked ? styles.locked : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleLayerLock(layer.id)
                    }}
                    title={layer.isLocked ? 'Unlock layer' : 'Lock layer'}
                  >
                    <LockIcon locked={layer.isLocked} />
                  </button>

                  {editing?.type === 'layer' && editing.id === layer.id ? (
                    <input
                      type="text"
                      className={styles.renameInput}
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFinishRename()
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={styles.layerName}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        handleStartRename('layer', layer.id, layer.name)
                      }}
                    >
                      {layer.name}
                    </span>
                  )}

                  {/* Only show delete button for unlocked layers */}
                  {!layer.isLocked && (
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteLayer(layer)
                      }}
                      title="Delete layer and all items"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Layer children (groups and ungrouped items) */}
                {isExpanded && (
                  <div className={styles.layerChildren}>
                    {/* Groups */}
                    {groups.map((group) => {
                      const groupExpanded = expandedGroupIds.has(group.id)
                      const groupActive = activeGroupId === group.id
                      const groupStructures = getStructuresInGroup(layer.id, group.id)

                      return (
                        <div key={group.id} className={styles.groupNode}>
                          {/* Group row */}
                          <div
                            className={`${styles.groupRow} ${groupActive ? styles.active : ''}`}
                            onClick={() => handleSetActiveGroup(group.id)}
                          >
                            <button
                              className={`${styles.iconBtn} ${group.isVisible ? styles.visible : styles.hidden}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleGroupVisible(group.id)
                              }}
                              title={group.isVisible ? 'Hide group' : 'Show group'}
                            >
                              <EyeIcon visible={group.isVisible} />
                            </button>

                            <button
                              className={`${styles.iconBtn} ${group.isLocked ? styles.locked : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleGroupLock(group.id)
                              }}
                              title={group.isLocked ? 'Unlock group' : 'Lock group'}
                            >
                              <LockIcon locked={group.isLocked} />
                            </button>

                            <button
                              className={styles.expandBtn}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleGroupExpanded(group.id)
                              }}
                              title={groupExpanded ? 'Collapse' : 'Expand'}
                            >
                              {groupExpanded ? '▼' : '▶'}
                            </button>

                            {editing?.type === 'group' && editing.id === group.id ? (
                              <input
                                type="text"
                                className={styles.renameInput}
                                value={editing.name}
                                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                onBlur={handleFinishRename}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleFinishRename()
                                  if (e.key === 'Escape') setEditing(null)
                                }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className={styles.groupName}
                                onDoubleClick={(e) => {
                                  e.stopPropagation()
                                  handleStartRename('group', group.id, group.name)
                                }}
                              >
                                {group.name}
                              </span>
                            )}

                            <button
                              className={styles.deleteBtn}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteGroup(group)
                              }}
                              title="Delete group and all items"
                            >
                              ×
                            </button>
                          </div>

                          {/* Group items */}
                          {groupExpanded && groupStructures.length > 0 && (
                            <div className={styles.itemList}>
                              {groupStructures.map((struct) => (
                                <StructureItem
                                  key={struct.id}
                                  structure={struct}
                                  catalog={catalog}
                                  onDelete={handleDeleteStructure}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Ungrouped items in this layer */}
                    {ungroupedStructures.length > 0 && (
                      <div className={styles.ungroupedSection}>
                        <div className={styles.ungroupedLabel}>Ungrouped</div>
                        <div className={styles.itemList}>
                          {ungroupedStructures.map((struct) => (
                            <StructureItem
                              key={struct.id}
                              structure={struct}
                              catalog={catalog}
                              onDelete={handleDeleteStructure}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add group button - hidden when layer is locked */}
                    {!layer.isLocked &&
                      (newGroupLayerId === layer.id ? (
                        <div className={styles.newGroupForm}>
                          <input
                            type="text"
                            className={styles.newGroupInput}
                            placeholder="Group name..."
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateGroup(layer.id)
                              if (e.key === 'Escape') {
                                setNewGroupLayerId(null)
                                setNewGroupName('')
                              }
                            }}
                            autoFocus
                          />
                          <button
                            className={styles.addBtn}
                            onClick={() => handleCreateGroup(layer.id)}
                          >
                            Add
                          </button>
                          <button
                            className={styles.cancelBtn}
                            onClick={() => {
                              setNewGroupLayerId(null)
                              setNewGroupName('')
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.addGroupBtn}
                          onClick={() => setNewGroupLayerId(layer.id)}
                        >
                          + Add Group
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add layer section */}
        {showAddLayerForm ? (
          <div className={styles.addLayerForm}>
            <input
              type="text"
              className={styles.newLayerInput}
              placeholder="Layer name..."
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateLayer()
                if (e.key === 'Escape') {
                  setShowAddLayerForm(false)
                  setNewLayerName('')
                }
              }}
              autoFocus
            />
            <button className={styles.addLayerBtn} onClick={handleCreateLayer}>
              Add
            </button>
            <button
              className={styles.cancelLayerBtn}
              onClick={() => {
                setShowAddLayerForm(false)
                setNewLayerName('')
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <div className={styles.addLayerSection}>
            <button
              className={styles.addLayerTrigger}
              onClick={() => setShowAddLayerForm(true)}
              title="Add new layer"
            >
              +
            </button>
          </div>
        )}
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
          <p>• +/- to zoom, 0 to reset</p>
          <p>• 1/2/3 for Hull/Place/Erase</p>
          <p>• Double-click to rename</p>
        </div>
      </section>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={`Delete ${deleteConfirm?.type === 'layer' ? 'Layer' : 'Group'}`}
        message={
          deleteConfirm
            ? `Delete "${deleteConfirm.name}" and all its contents? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

/**
 * Individual structure item in the layer tree
 */
function StructureItem({
  structure,
  catalog,
  onDelete,
}: {
  structure: PlacedStructure
  catalog: Parameters<typeof findStructureById>[0]
  onDelete: (id: string) => void
}) {
  const found = findStructureById(catalog, structure.structureId)
  if (!found) return null

  return (
    <div className={styles.itemRow}>
      <span className={styles.itemColor} style={{ backgroundColor: found.structure.color }} />
      <span className={styles.itemName}>{found.structure.name}</span>
      <span className={styles.itemCoords}>
        ({structure.x}, {structure.y})
      </span>
      <button
        className={styles.deleteBtn}
        onClick={() => onDelete(structure.id)}
        title="Delete structure"
      >
        ×
      </button>
    </div>
  )
}
