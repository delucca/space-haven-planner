import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { ZOOM_STEP } from '@/data/presets'

describe('useKeyboardShortcuts', () => {
  const mockDispatch = vi.fn()
  const baseZoom = 12

  beforeEach(() => {
    mockDispatch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function fireKeyDown(key: string, options: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    })
    window.dispatchEvent(event)
    return event
  }

  describe('zoom shortcuts', () => {
    it('zooms in with + key', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('+')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms in with = key (unshifted +)', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('=')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms out with - key', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('-')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom - ZOOM_STEP,
      })
    })

    it('zooms out with _ key (shifted -)', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('_')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom - ZOOM_STEP,
      })
    })

    it('zooms in with Ctrl++', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('+', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms in with Ctrl+=', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('=', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms out with Ctrl+-', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('-', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom - ZOOM_STEP,
      })
    })

    it('zooms in with Cmd++ (metaKey)', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('+', { metaKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms out with Cmd+- (metaKey)', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('-', { metaKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom - ZOOM_STEP,
      })
    })
  })

  describe('rotation shortcuts', () => {
    it('rotates counter-clockwise with q', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('q')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ROTATE_PREVIEW',
        direction: 'ccw',
      })
    })

    it('rotates counter-clockwise with Q (uppercase)', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('Q')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ROTATE_PREVIEW',
        direction: 'ccw',
      })
    })

    it('rotates clockwise with e', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('e')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ROTATE_PREVIEW',
        direction: 'cw',
      })
    })

    it('rotates clockwise with E (uppercase)', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('E')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ROTATE_PREVIEW',
        direction: 'cw',
      })
    })
  })

  describe('tool shortcuts', () => {
    it('switches to hull tool with 1', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('1')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_TOOL',
        tool: 'hull',
      })
    })

    it('switches to place tool with 2', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('2')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_TOOL',
        tool: 'place',
      })
    })

    it('switches to erase tool with 3', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('3')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_TOOL',
        tool: 'erase',
      })
    })
  })

  describe('selection shortcuts', () => {
    it('clears selection with Escape', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      fireKeyDown('Escape')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'CLEAR_SELECTION',
      })
    })
  })

  describe('input field handling', () => {
    it('ignores shortcuts when typing in input field', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent('keydown', {
        key: '+',
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'target', { value: input, writable: false })
      window.dispatchEvent(event)

      expect(mockDispatch).not.toHaveBeenCalled()

      document.body.removeChild(input)
    })

    it('ignores shortcuts when typing in textarea', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'q',
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'target', { value: textarea, writable: false })
      window.dispatchEvent(event)

      expect(mockDispatch).not.toHaveBeenCalled()

      document.body.removeChild(textarea)
    })

    it('ignores shortcuts when typing in select', () => {
      renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))

      const select = document.createElement('select')
      document.body.appendChild(select)
      select.focus()

      const event = new KeyboardEvent('keydown', {
        key: '1',
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'target', { value: select, writable: false })
      window.dispatchEvent(event)

      expect(mockDispatch).not.toHaveBeenCalled()

      document.body.removeChild(select)
    })
  })

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useKeyboardShortcuts(mockDispatch, baseZoom))
      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })
})

