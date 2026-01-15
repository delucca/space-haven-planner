import type {
  ParsedShipMeta,
  ParsedTileElement,
  ParsedChildTile,
  ParsedShip,
  SaveParseResult,
} from './types'
import { parseRotation } from './types'

/**
 * Parse a Space Haven save file (the "game" file) from text content.
 *
 * @param xmlText - The raw XML text content of the save file
 * @returns Parsed save result with ship metadata
 * @throws Error if the XML is invalid or missing expected structure
 */
export function parseSaveFile(xmlText: string): SaveParseResult {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

  // Check for parse errors
  const parseError = xmlDoc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Invalid XML: ${parseError.textContent}`)
  }

  // Find all ship elements
  const shipElements = xmlDoc.querySelectorAll('ships > ship')
  const allShips: ParsedShipMeta[] = []
  const playerShips: ParsedShipMeta[] = []

  for (const shipEl of shipElements) {
    const meta = parseShipMeta(shipEl)
    if (meta) {
      allShips.push(meta)
      if (meta.isPlayerOwned) {
        playerShips.push(meta)
      }
    }
  }

  return {
    allShips,
    playerShips,
    xmlDoc,
  }
}

/**
 * Parse ship metadata from a ship XML element.
 */
function parseShipMeta(shipEl: Element): ParsedShipMeta | null {
  const sid = shipEl.getAttribute('sid')
  const sname = shipEl.getAttribute('sname')
  const sx = shipEl.getAttribute('sx')
  const sy = shipEl.getAttribute('sy')

  // Skip ships without required attributes
  if (!sid || !sname || !sx || !sy) {
    return null
  }

  // Check if this ship is player-owned by looking for settings with owner="Player"
  const settingsEl = shipEl.querySelector('settings[owner="Player"]')
  const isPlayerOwned = settingsEl !== null

  return {
    sid,
    name: sname,
    width: parseInt(sx, 10),
    height: parseInt(sy, 10),
    isPlayerOwned,
  }
}

/**
 * Parse a full ship with all its tile elements.
 *
 * @param xmlDoc - The parsed XML document
 * @param shipSid - The ship ID (sid) to parse
 * @returns Parsed ship data or null if not found
 */
export function parseShipById(xmlDoc: Document, shipSid: string): ParsedShip | null {
  // Find the ship element with matching sid
  const shipElements = xmlDoc.querySelectorAll('ships > ship')
  let targetShip: Element | null = null

  for (const shipEl of shipElements) {
    if (shipEl.getAttribute('sid') === shipSid) {
      targetShip = shipEl
      break
    }
  }

  if (!targetShip) {
    return null
  }

  const meta = parseShipMeta(targetShip)
  if (!meta) {
    return null
  }

  // Parse all tile elements (direct children <e> elements of the ship)
  const elements: ParsedTileElement[] = []
  const tileElements = targetShip.querySelectorAll(':scope > e')

  for (const tileEl of tileElements) {
    const parsed = parseTileElement(tileEl)
    if (parsed) {
      elements.push(parsed)
    }
  }

  return {
    meta,
    elements,
  }
}

/**
 * Parse a single tile element from the save file.
 */
function parseTileElement(el: Element): ParsedTileElement | null {
  const xStr = el.getAttribute('x')
  const yStr = el.getAttribute('y')
  const mStr = el.getAttribute('m')

  // Skip elements without required position attributes
  if (xStr === null || yStr === null) {
    return null
  }

  const x = parseInt(xStr, 10)
  const y = parseInt(yStr, 10)
  const mid = mStr !== null ? parseInt(mStr, 10) : -2 // -2 is the "empty" marker in saves

  // Skip empty tiles (m="-2" with no other data)
  // We still want to process them for hull detection though
  const rotation = parseRotation(el.getAttribute('rot'))

  // Check for child <l> elements (multi-tile structures)
  const childElements = el.querySelectorAll(':scope > l')
  const isMultiTile = childElements.length > 0

  let childTiles: ParsedChildTile[] | undefined

  if (isMultiTile) {
    childTiles = []
    for (const childEl of childElements) {
      const indStr = childEl.getAttribute('ind')
      const childXStr = childEl.getAttribute('x')
      const childYStr = childEl.getAttribute('y')

      if (indStr !== null && childXStr !== null && childYStr !== null) {
        childTiles.push({
          index: parseInt(indStr, 10),
          x: parseInt(childXStr, 10),
          y: parseInt(childYStr, 10),
        })
      }
    }
  }

  return {
    x,
    y,
    mid,
    rotation,
    isMultiTile,
    childTiles,
  }
}

/**
 * Load and parse a save file from a File object.
 *
 * @param file - The save file to parse
 * @returns Promise resolving to the parse result
 */
export function loadSaveFile(file: File): Promise<SaveParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const text = event.target?.result
        if (typeof text !== 'string') {
          throw new Error('Failed to read file as text')
        }

        const result = parseSaveFile(text)
        resolve(result)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read save file'))
    }

    reader.readAsText(file)
  })
}



