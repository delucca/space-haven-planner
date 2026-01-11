import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { ZOOM_STEP } from '@/data/presets'
import { calculateFitZoomForViewport } from '../zoom'

describe('useKeyboardShortcuts', () => {
  const mockDispatch = vi.fn()
  const baseZoom = 12
  // Default grid and canvas dimensions for tests
  const defaultGridWidth = 54
  const defaultCanvasWidth = 1000

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
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('+')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms in with = key (unshifted +)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('=')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms out with - key', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('-')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom - ZOOM_STEP,
      })
    })

    it('zooms out with _ key (shifted -)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('_')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom - ZOOM_STEP,
      })
    })

    it('zooms in with Ctrl++', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('+', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms in with Ctrl+=', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('=', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms out with Ctrl+-', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('-', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom - ZOOM_STEP,
      })
    })

    it('zooms in with Cmd++ (metaKey)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('+', { metaKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom + ZOOM_STEP,
      })
    })

    it('zooms out with Cmd+- (metaKey)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('-', { metaKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: baseZoom - ZOOM_STEP,
      })
    })

    it('resets zoom to 100% with 0 key', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('0')

      const expectedFitZoom = calculateFitZoomForViewport(defaultGridWidth, defaultCanvasWidth)
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: expectedFitZoom,
      })
    })

    it('resets zoom to 100% with Ctrl+0', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('0', { ctrlKey: true })

      const expectedFitZoom = calculateFitZoomForViewport(defaultGridWidth, defaultCanvasWidth)
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: expectedFitZoom,
      })
    })

    it('resets zoom to 100% with Cmd+0 (metaKey)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('0', { metaKey: true })

      const expectedFitZoom = calculateFitZoomForViewport(defaultGridWidth, defaultCanvasWidth)
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_ZOOM',
        zoom: expectedFitZoom,
      })
    })
  })

  describe('rotation shortcuts', () => {
    it('rotates counter-clockwise with q', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('q')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ROTATE_PREVIEW',
        direction: 'ccw',
      })
    })

    it('rotates counter-clockwise with Q (uppercase)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('Q')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ROTATE_PREVIEW',
        direction: 'ccw',
      })
    })

    it('rotates clockwise with e', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('e')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ROTATE_PREVIEW',
        direction: 'cw',
      })
    })

    it('rotates clockwise with E (uppercase)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('E')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ROTATE_PREVIEW',
        direction: 'cw',
      })
    })
  })

  describe('tool shortcuts', () => {
    it('switches to select tool with 1', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('1')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_TOOL',
        tool: 'select',
      })
    })

    it('switches to hull tool with 2', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('2')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_TOOL',
        tool: 'hull',
      })
    })

    it('switches to place tool with 3', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('3')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_TOOL',
        tool: 'place',
      })
    })

    it('switches to erase tool with 4', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('4')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_TOOL',
        tool: 'erase',
      })
    })
  })

  describe('selection shortcuts', () => {
    it('clears selection with Escape', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('Escape')

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'CLEAR_SELECTION',
      })
    })
  })

  describe('undo/redo shortcuts', () => {
    it('dispatches UNDO with Ctrl+Z', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('z', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'UNDO' })
    })

    it('dispatches UNDO with Cmd+Z (metaKey)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('z', { metaKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'UNDO' })
    })

    it('dispatches UNDO with Ctrl+Z (uppercase Z)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('Z', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'UNDO' })
    })

    it('dispatches REDO with Ctrl+Y', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('y', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REDO' })
    })

    it('dispatches REDO with Ctrl+Y (uppercase Y)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('Y', { ctrlKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REDO' })
    })

    it('dispatches REDO with Ctrl+Shift+Z', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('z', { ctrlKey: true, shiftKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REDO' })
    })

    it('dispatches REDO with Cmd+Shift+Z (metaKey)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('z', { metaKey: true, shiftKey: true })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REDO' })
    })

    it('does not dispatch UNDO when Shift is held (Ctrl+Shift+Z is redo)', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      fireKeyDown('z', { ctrlKey: true, shiftKey: true })

      expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'UNDO' })
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REDO' })
    })

    it('ignores Ctrl+Z in input fields', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'target', { value: input, writable: false })
      window.dispatchEvent(event)

      expect(mockDispatch).not.toHaveBeenCalled()

      document.body.removeChild(input)
    })

    it('ignores Ctrl+Y in textarea', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'target', { value: textarea, writable: false })
      window.dispatchEvent(event)

      expect(mockDispatch).not.toHaveBeenCalled()

      document.body.removeChild(textarea)
    })
  })

  describe('input field handling', () => {
    it('ignores shortcuts when typing in input field', () => {
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

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
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

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
      renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )

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

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts(mockDispatch, baseZoom, defaultGridWidth, defaultCanvasWidth)
      )
      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })
})
