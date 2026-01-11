import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Palette } from './Palette'
import { PlannerContext, type PlannerContextValue } from '../state/PlannerContext'
import type { PlannerState } from '../state/types'
import type { StructureCatalog } from '@/data/types'

// Mock the wiki metadata hook
vi.mock('../hooks/useWikiStructureMetadata', () => ({
  useWikiStructureMetadata: vi.fn(() => ({
    status: 'loading',
    metadata: null,
  })),
}))

const mockCatalog: StructureCatalog = {
  categories: [
    {
      id: 'power',
      name: 'Power',
      color: '#cc8844',
      defaultLayer: 'Systems',
      items: [
        {
          id: 'system_core_x1',
          name: 'System Core X1',
          size: [2, 3],
          color: '#ffaa44',
          categoryId: 'power',
        },
        {
          id: 'solar_panel',
          name: 'Solar Panel',
          size: [3, 2],
          color: '#4488cc',
          categoryId: 'power',
        },
      ],
    },
    {
      id: 'life_support',
      name: 'Life Support',
      color: '#44aa88',
      defaultLayer: 'Systems',
      items: [
        {
          id: 'oxygen_gen',
          name: 'Oxygen Generator',
          size: [2, 2],
          color: '#44ccaa',
          categoryId: 'life_support',
        },
      ],
    },
  ],
}

function createMockState(overrides: Partial<PlannerState> = {}): PlannerState {
  return {
    gridSize: { width: 54, height: 54 },
    presetLabel: '2x2',
    zoom: 12,
    showGrid: true,
    tool: 'place',
    selection: null,
    previewRotation: 0,
    visibleLayers: new Set(['Hull', 'Rooms', 'Systems', 'Furniture']),
    expandedCategories: new Set(['power']),
    // CAD-style layers and groups
    userLayers: [
      { id: 'layer-hull', name: 'Hull', isVisible: true, isLocked: false, order: 0 },
      { id: 'layer-rooms', name: 'Rooms', isVisible: true, isLocked: false, order: 1 },
      { id: 'layer-systems', name: 'Systems', isVisible: true, isLocked: false, order: 2 },
      { id: 'layer-furniture', name: 'Furniture', isVisible: true, isLocked: false, order: 3 },
    ],
    userGroups: [],
    activeLayerId: null,
    activeGroupId: null,
    expandedLayerIds: new Set(['layer-hull', 'layer-rooms', 'layer-systems', 'layer-furniture']),
    expandedGroupIds: new Set(),
    structures: [],
    hoveredTile: null,
    isDragging: false,
    catalog: mockCatalog,
    hullTiles: new Set(),
    selectedStructureIds: new Set(),
    catalogStatus: {
      source: 'jar_builtin_snapshot',
      isParsing: false,
      lastUpdatedAt: null,
      lastError: null,
      jarFileName: null,
    },
    ...overrides,
  }
}

function renderWithProvider(state: PlannerState) {
  const dispatch = vi.fn()
  const value: PlannerContextValue = { state, dispatch }
  return {
    dispatch,
    ...render(
      <PlannerContext.Provider value={value}>
        <Palette />
      </PlannerContext.Provider>
    ),
  }
}

describe('Palette', () => {
  describe('normal mode (no search query)', () => {
    it('renders category headers', () => {
      renderWithProvider(createMockState())
      expect(screen.getByText('Power')).toBeInTheDocument()
      expect(screen.getByText('Life Support')).toBeInTheDocument()
    })

    it('shows items only for expanded categories', () => {
      renderWithProvider(createMockState({ expandedCategories: new Set(['power']) }))
      // Power is expanded, so its items should be visible
      expect(screen.getByText('System Core X1')).toBeInTheDocument()
      expect(screen.getByText('Solar Panel')).toBeInTheDocument()
      // Life Support is collapsed, so its item should not be visible
      expect(screen.queryByText('Oxygen Generator')).not.toBeInTheDocument()
    })
  })

  describe('search mode', () => {
    it('hides category headers when searching', async () => {
      const user = userEvent.setup()
      renderWithProvider(createMockState())

      const searchInput = screen.getByPlaceholderText('Search structures…')
      await user.type(searchInput, 'core')

      // Category headers should be hidden
      expect(screen.queryByRole('button', { name: /Power/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Life Support/ })).not.toBeInTheDocument()
    })

    it('shows flat list of matching items by structure name', async () => {
      const user = userEvent.setup()
      renderWithProvider(createMockState())

      const searchInput = screen.getByPlaceholderText('Search structures…')
      await user.type(searchInput, 'oxygen')

      // Only Oxygen Generator should match
      expect(screen.getByText('Oxygen Generator')).toBeInTheDocument()
      expect(screen.queryByText('System Core X1')).not.toBeInTheDocument()
      expect(screen.queryByText('Solar Panel')).not.toBeInTheDocument()
    })

    it('matches by category name and shows all items in that category', async () => {
      const user = userEvent.setup()
      renderWithProvider(createMockState())

      const searchInput = screen.getByPlaceholderText('Search structures…')
      await user.type(searchInput, 'Power')

      // All Power category items should appear
      expect(screen.getByText('System Core X1')).toBeInTheDocument()
      expect(screen.getByText('Solar Panel')).toBeInTheDocument()
      // Life Support items should not appear
      expect(screen.queryByText('Oxygen Generator')).not.toBeInTheDocument()
    })

    it('shows empty state when no matches', async () => {
      const user = userEvent.setup()
      renderWithProvider(createMockState())

      const searchInput = screen.getByPlaceholderText('Search structures…')
      await user.type(searchInput, 'xyznonexistent')

      expect(screen.getByText('No matching structures')).toBeInTheDocument()
    })

    it('returns to categorized view when search is cleared', async () => {
      const user = userEvent.setup()
      renderWithProvider(createMockState())

      const searchInput = screen.getByPlaceholderText('Search structures…')
      await user.type(searchInput, 'oxygen')

      // Now clear the search
      await user.clear(searchInput)

      // Category headers should reappear
      expect(screen.getByText('Power')).toBeInTheDocument()
      expect(screen.getByText('Life Support')).toBeInTheDocument()
    })

    it('is case-insensitive', async () => {
      const user = userEvent.setup()
      renderWithProvider(createMockState())

      const searchInput = screen.getByPlaceholderText('Search structures…')
      await user.type(searchInput, 'SOLAR')

      expect(screen.getByText('Solar Panel')).toBeInTheDocument()
    })
  })

  describe('hover popover', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not show popover immediately on hover', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderWithProvider(createMockState({ expandedCategories: new Set(['power']) }))

      const item = screen.getByText('System Core X1')
      await user.hover(item)

      // Popover should not appear immediately
      expect(screen.queryByText('Category')).not.toBeInTheDocument()
    })

    it('shows popover after hover delay', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderWithProvider(createMockState({ expandedCategories: new Set(['power']) }))

      const item = screen.getByText('System Core X1')
      await user.hover(item)

      // Advance time past the 500ms hover delay
      await act(async () => {
        vi.advanceTimersByTime(600)
      })

      // Now the popover should be visible (it renders via portal to body)
      // The StructureInfoCard shows the structure name in a specific element
      await waitFor(() => {
        // Look for the popover content - it should show the structure name
        const popovers = document.querySelectorAll('[class*="popover"]')
        expect(popovers.length).toBeGreaterThan(0)
      })
    })

    it('hides popover when mouse leaves before delay', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderWithProvider(createMockState({ expandedCategories: new Set(['power']) }))

      const item = screen.getByText('System Core X1')
      await user.hover(item)

      // Advance time but not past the delay
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Move mouse away
      await user.unhover(item)

      // Advance time past the original delay
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      // Popover should not appear
      const popovers = document.querySelectorAll('[class*="popover"]')
      expect(popovers.length).toBe(0)
    })

    it('hides popover on item click', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { dispatch } = renderWithProvider(
        createMockState({ expandedCategories: new Set(['power']) })
      )

      const item = screen.getByText('System Core X1')
      await user.hover(item)

      // Wait for popover to appear
      await act(async () => {
        vi.advanceTimersByTime(600)
      })

      // Click the item
      await user.click(item)

      // Popover should be hidden
      await waitFor(() => {
        const popovers = document.querySelectorAll('[class*="popover"]')
        expect(popovers.length).toBe(0)
      })

      // And the structure should be selected
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SELECT_STRUCTURE',
          structureId: 'system_core_x1',
        })
      )
    })
  })
})
