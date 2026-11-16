# Free Low-Poly Animals (CC0): rigged cat, fox and owl

Three rigged, animated toy-style animals for your game, free and public domain. A cat, a fox and an owl, each with big glossy eyes, a mouth that really opens and 12 animations. GLB and FBX, ready for Godot, Unity, Unreal Engine, Blender and three.js. No credit needed, commercial use is fine.

![Cover: the cat, owl and fox of the free sample](Preview/cover.png)

![The cat attacks, the fox calls and the owl calls, all in place](Preview/cat-fox-owl-clips.gif)

I made these as the free taste of my bigger [Cute Pets & Wildlife](https://vuena.itch.io/blocky-pets-wildlife) pack. They are three animals from the full pack (v3.1), so you can try the whole style in your own project before deciding on anything else.

## What is inside

| | |
| --- | --- |
| Animals | 3: cat, fox, owl |
| Files | 3 GLB + 3 FBX + 6 texture PNGs (albedo and ORM for each animal) |
| Animations | 12 clips per animal: `idle`, `idle_alt`, `walk`, `run` (the owl has `fly` instead of `run`), `jump`, `eat`, `sit`, `sleep`, `attack`, `call`, `hit`, `death` |
| Rig | cat and fox: 19-bone skeleton. Owl: 13-bone bird skeleton. Clips are 30 fps and play in place (no root motion) |
| Faces | eyes blink, and the mouth opens in `call`, `attack` and `eat`. It is a lower jaw on a Jaw bone, so the owl opens its beak too |
| Meshes | full mesh (LOD0) plus a mobile LOD (LOD1) in every file |
| Textures | 2048 px painted albedo and ORM maps, embedded in the GLB and also included as PNG |
| Scale | 1 unit = 1 m, one material per animal |

```
GLB/        animal_cat.glb, animal_fox.glb, animal_owl.glb   (textures embedded)
FBX/        animal_cat.fbx, animal_fox.fbx, animal_owl.fbx
Textures/   the albedo and ORM PNGs the FBX files use
Preview/    cover and GIFs
LICENSE     the CC0 1.0 legal text
LICENSE.txt the dedication that shipped inside the itch.io zip
```

![Mouths open and eyes blink](Preview/mouths-and-eyes.gif)

## Using them

- **Godot 4:** drop the `.glb` into your project. The imported scene has the armature and an AnimationPlayer with the 12 clips, so you can play them by name.
- **Unity:** import the `.fbx` (keep the `Textures` folder next to it).
- **Unreal Engine:** import the `.fbx`, or the `.glb` if you use a glTF importer.
- **Blender:** import the `.glb`.
- **three.js / Babylon.js:** load the `.glb` with GLTFLoader or SceneLoader and play the clips by name.

## Good to know

- The lights, the floor and the backdrop in the pictures are not in the files. I rendered them in Blender with lights I added.
- The clips are procedural and in place, made for games and dioramas, not motion-capture quality. The owl's `fly` is an in-place hover.
- Mouths open and eyes blink, but there is no other facial animation.

## Licence

**CC0 1.0 Universal (public domain).** Use these three animals in anything, commercial or not, with no credit and no need to ask me. The waiver covers only the files in this repo. The full pack has its own royalty-free licence.

## How they were made, honestly

I build these procedurally with my own Blender Python code, and I wrote that code with AI assistance. The meshes and textures themselves are not AI-generated.

## Want more?

The full pack is **[Cute Pets & Wildlife on itch.io](https://vuena.itch.io/blocky-pets-wildlife)**: 36 rigged animals in 57 files, 13 animations, 6 rideable mounts, 15 shoulder pets and a bonus zip of 22 blocky props, as GLB and FBX. It is also part of the [Vuena All-in-1](https://vuena.itch.io/complete-collection) (every pack, plus all future packs). Buying it is what keeps me making these, and this free sample stays free either way.

- Free sample on itch: https://vuena.itch.io/blocky-pets-free
- Browse every model: https://models.popyca.com
- All packs: https://vuena.itch.io
- A tiny Godot 4 project that uses these animals: [Vuena/blocky-pets-godot-starter](https://github.com/Vuena/blocky-pets-godot-starter)
