# Local Hoyo artwork

The Hoyo page only loads artwork from this folder; it does not request image files from Nanoka.
Place `.webp` images you are authorized to use in the matching category directory:

- Characters use local filenames mapped to their game IDs (for example, `characters/Robin.webp` for ID `1661`).
- Weapons use local filenames based on their catalogue display names, such as `weapons/Angel in the Shell.webp`.
- `disks/SuitWoodpeckerElectro.webp`

Disk filenames use the Nanoka image ID (the `icon` basename returned by its catalogue). Some local weapon filenames omit apostrophes or contain small spelling differences; these are normalized or mapped by weapon ID. The catalogue obtains item names and image IDs from Nanoka, but loads artwork only from this local folder. If an image is unavailable, the page shows a placeholder.
