# Third-party asset licenses

This file records the external art used by the modern neon-city presentation and
hero character. The selected files are intentionally kept separate from the
project's own code and artwork, and every model source is pinned below.

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
| `public/models/kenney/cube-pets/animal-cat.glb` | [Cube Pets](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/cube-pets) | Decorative menu city vignette |
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

## Vuena / Popyca free cat sample — CC0 1.0

The former hero cat has been replaced with the rigged low-poly cat from the
free sample repository below. This is a separate source from Kenney and is used
both by the live shop preview and by the offline Canvas sprite bake.

- **Creator:** Vuena / Popyca
- **License:** [Creative Commons Zero 1.0 Universal (CC0)](https://creativecommons.org/publicdomain/zero/1.0/)
- **Source repository:** [Vuena/free-low-poly-animals-cc0](https://github.com/Vuena/free-low-poly-animals-cc0)
- **Pinned source commit:** [`a3944e5e54eb7e1ab2c24744b88a1ae6617e4534`](https://github.com/Vuena/free-low-poly-animals-cc0/tree/a3944e5e54eb7e1ab2c24744b88a1ae6617e4534)
- **Exact source file:** [`GLB/animal_cat.glb`](https://github.com/Vuena/free-low-poly-animals-cc0/blob/a3944e5e54eb7e1ab2c24744b88a1ae6617e4534/GLB/animal_cat.glb)
- **License evidence:** the pinned repository contains [`LICENSE.txt`](https://github.com/Vuena/free-low-poly-animals-cc0/blob/a3944e5e54eb7e1ab2c24744b88a1ae6617e4534/LICENSE.txt), which dedicates the sample's cat, animations and textures to the public domain under CC0 1.0. GitHub's repository metadata also reports SPDX `CC0-1.0`.
- **Local evidence kept with the model:** `public/models/vuena/LICENSE.txt`, the full `public/models/vuena/LICENSE`, and the source `public/models/vuena/README.md`.
- **Verified local model SHA-256:** `35cfa9a000045a659938d5b882a7e818c24087131239ce0527eae91c239a82d9`.

The model includes embedded textures and named `idle`, `run` and `jump` clips.
Shadow Paw uses it in these visible paths:

| Local file | Use in Shadow Paw |
| --- | --- |
| `public/models/vuena/animal_cat.glb` | Lazy-loaded animated 3D shop/studio preview |
| `public/sprites/cat_idle_1.png` | Baked gameplay/menu idle fallback |
| `public/sprites/cat_run_frame_0.png` … `cat_run_frame_3.png` | Four baked samples of the model's `run` clip in gameplay |
| `public/sprites/cat_jump_1.png` | Baked gameplay jump pose |
| `public/sprites/cat_<pose>_<angle>.png` | Additional deterministic angles for the sprite preview helper |

The PNGs are generated by `node scripts/render-cat-sprites.mjs`; the script is
pinned to the same local GLB and selects the model's named clips. The runtime
stays Canvas 2D for mobile performance and falls back to the vector cat if a
sprite cannot be decoded. WebGL failure in the shop similarly leaves the 2D
preview visible.

## Existing assets

The older `toon_cat_free.glb` and old AI-rendered atlas remain in the checkout
as historical, unused source material; they are deliberately not described as
CC0 and are not referenced by the runtime hero path or the new bake scripts.
The current `cat_walk_*` diagnostic outputs are generated from the pinned Vuena
GLB by `scripts/bake-cat-animation.mjs`. The Kenney cat remains only as separate
CC0 city set dressing; the visible hero is the pinned Vuena model.
