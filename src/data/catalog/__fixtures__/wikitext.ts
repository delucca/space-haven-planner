/**
 * Sample wiki text fixtures for testing the parser
 * These are representative examples of how Space Haven wiki pages format footprint information
 */

/**
 * Bed page - typical infobox-style format
 */
export const BED_WIKITEXT = `
{{Infobox Building
|name = Bed
|image = Bed.png
|footprint = 1x2
|category = Crew Facilities
}}

'''Beds''' are one of the two buildings that can increase sleep Comfort. A Bed has a footprint of 1x2 tiles.

== Construction ==

=== Footprint ===
The Beds both take up a footprint of 1x2 tiles.
`

/**
 * Pod Hangar - larger structure with different format
 */
export const POD_HANGAR_WIKITEXT = `
{{Infobox Building
|name = Pod Hangar
|image = Pod_Hangar.png
}}

'''Pod Hangars''' are a structure designed to hold Miners and other Pod sized crafts when they are idle.

== Construction ==

=== Footprint ===
A Pod Hangar needs a 4x3 empty square to be built. The 1x3 lane in front of the Locker door is transparent.
`

/**
 * Weapons Console - footprint in prose format
 */
export const WEAPONS_CONSOLE_WIKITEXT = `
{{Infobox Building
|name = Weapons Console
|image = Weapons_Console.png
}}

The '''Weapons Console''' is a structure that allows crew members to control the ship's weapons.

== Construction ==

=== Footprint ===
The Weapons Console needs a 3x3 tile floor area to be built but only right behind the chair is blocked on the final row.
`

/**
 * Body Storage - "NxM tiles" format
 */
export const BODY_STORAGE_WIKITEXT = `
{{Infobox Building
|name = Body Storage
}}

The '''Body Storage''' building is used by your Crew to store the biological bodies of humans and aliens.

== Construction ==

=== Footprint ===
The Body Storage needs a 2x3 tiles area to be built.
`

/**
 * Item Storage - "takes up NxM" format
 */
export const ITEM_STORAGE_WIKITEXT = `
{{Infobox Building
|name = Item Storage
}}

The '''Storage''' buildings are used by your Crew to store the various items you procure.

== Construction ==

=== Footprint ===
The Small Storage takes up a 2x2 tile area.
The Large Storage takes up a 3x2 tile area.
`

/**
 * Hull Stabilizer - different prose style
 */
export const HULL_STABILIZER_WIKITEXT = `
{{Infobox Building
|name = Hull Stabilizer
|size = 3x2
}}

The '''Hull Stabilizer''' is a structure able to strengthen and reinforce a spaceship's frame.

== Construction ==

This structure takes 3x2 tiles to build.
`

/**
 * Page with no footprint information (should not match)
 */
export const NO_FOOTPRINT_WIKITEXT = `
{{Infobox Building
|name = Unknown Structure
}}

This is a structure with no footprint information documented.

== Description ==

Some description without any size information.
`

/**
 * Page with invalid/nonsense footprint (should not match due to sanity check)
 */
export const INVALID_FOOTPRINT_WIKITEXT = `
{{Infobox Building
|name = Huge Structure
|footprint = 100x100
}}

This structure has an unreasonably large footprint that should be rejected.
`

/**
 * Page with unicode multiplication sign
 */
export const UNICODE_MULTIPLY_WIKITEXT = `
{{Infobox Building
|name = Test Building
}}

== Construction ==

=== Footprint ===
The building needs a 2×3 tile area.
`

