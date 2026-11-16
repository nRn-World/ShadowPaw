# Third-party asset licenses

This file records the external art added for the modern neon-city presentation.
The selected files are stored under `public/models/kenney/` and are intentionally
kept separate from the project's own code and artwork.

## Kenney 3D kit — CC0

- **Creator:** Kenney / [kenney.nl](https://kenney.nl)
- **License:** [Creative Commons Zero 1.0 Universal (CC0)](https://creativecommons.org/publicdomain/zero/1.0/)
- **What the license allows:** copying, modifying, combining and using the assets
  in personal, educational and commercial projects without a required attribution.
- **Credit included by choice:** `Kenney · kenney.nl`.
- **Source archive:** [shorepine/kenney at pinned commit 3694c6879e487c108f55677be7dd2ca75b07cc3b](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b)
- **License evidence:** the source repository's [README](https://github.com/shorepine/kenney/blob/3694c6879e487c108f55677be7dd2ca75b07cc3b/README.md)
  identifies the complete art library as Kenney art released under CC0. The
  archive's `LICENSE.txt` notice is also kept at
  `public/models/kenney/LICENSE.txt`.

The following CC0 models are included and are used by the game UI:

| Local file | Source pack | Use in Shadow Paw |
| --- | --- | --- |
| `public/models/kenney/cube-pets/animal-cat.glb` | [Cube Pets](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/cube-pets) | Animated shop hero and menu city vignette |
| `public/models/kenney/city-commercial/building-a.glb` | [City Commercial](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/city-commercial) | Modular neon-city backdrop |
| `public/models/kenney/city-commercial/building-skyscraper-a.glb` | [City Commercial](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/city-commercial) | Modular neon-city backdrop |
| `public/models/kenney/city-roads/road-straight.glb` | [City Roads](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/city-roads) | Holographic street stage |
| `public/models/kenney/city-roads/light-square.glb` | [City Roads](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/city-roads) | Neon street lights |
| `public/models/kenney/car/race-future.glb` | [Car](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/car) | Future car set dressing |

### Changes made to the models in-game

The original files are not overwritten. At runtime Shadow Paw composes them into
new scenes, changes scale/rotation/material roughness and adds original lighting,
fog, holographic floor geometry and neon colour grading. The cat's supplied
`idle` animation is played in the studio/menu. These are permitted adaptations
under CC0.

The gameplay loop continues to use its Canvas 2D renderer and existing sprite
fallbacks. If WebGL or a model request is unavailable, the 2D preview remains
visible and the game is fully playable.

## Existing assets

The older `toon_cat_free.glb` and the baked sprite/atlas files predate this CC0
integration and have their own provenance. They are deliberately not described
as CC0 here. The new 3D studio path uses `animal-cat.glb` instead, so the new
model feature does not depend on the older attribution-only model.
