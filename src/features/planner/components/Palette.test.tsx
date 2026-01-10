import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Palette } from './Palette'
import { PlannerContext, type PlannerContextValue } from '../state/PlannerContext'
import type { PlannerState } from '../state/types'
import type { StructureCatalog } from '@/data/types'

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
    structures: [],
    hoveredTile: null,
    isDragging: false,
    catalog: mockCatalog,
    hullTiles: new Set(),
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
})
