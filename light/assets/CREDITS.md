# Third-party assets in /light/

## `traveller.glb`
From the three.js examples (`examples/models/gltf/Xbot.glb`), re-hosted here so
the page has no runtime dependency on another site. The file carries **no
copyright string** and its skeleton uses `mixamorig:` bone names, so it is
Adobe **Mixamo**-derived. Mixamo grants royalty-free use of its characters and
animations; redistributing the raw file is less clearly covered. It is used
here for a personal portfolio, and its own material is discarded on load — only
the mesh and the skeleton are used, re-shaded with this project's toon shader.

If that is not comfortable, `?rig=0` falls back to the fully procedural figure
and this file can be deleted without touching anything else.

## `fox.glb`
From the Khronos glTF Sample Assets. The file carries its licence internally:

> CC-BY 4.0 Model by PixelMannen
> https://opengameart.org/content/fox-and-shiba — rigged by @tomkrani

Used under CC-BY 4.0, with credit as required.

## `../lib/babylon.glTF2FileLoader.min.js`
Babylon.js glTF2 loader, v9.26.0, Apache-2.0. Vendored from npm
(`babylonjs-loaders`). Only the glTF2 loader is included (269 KB) rather than
the full loaders bundle (594 KB), because glTF is the only format used.

## `../lib/babylon.js`
Babylon.js 9.26.0, Apache-2.0. See `../lib/BABYLON-LICENSE.md`.
