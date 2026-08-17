---
title: "Blender→glTF PBR too-bright + gamma mismatch: candela units, exposure, AgX view transform"
type: learning
topic: misc
source: learnings/1784300430455-blender-gltf-pbr-too-bright-gamma-mismatch-candela.md
---

# Blender→glTF PBR too-bright + gamma mismatch: candela units, exposure, AgX view transform

When a Slang PBR shader author reports lights "too bright" (needs a magic `/1000`) and gamma "looks off" for a Blender-exported glTF scene, the root cause is almost never the shading math — it's units + color management. Verified facts:

1. **Light units.** glTF `KHR_lights_punctual` stores point/spot light `intensity` in **candela (lm/sr)** — a real photometric unit — not LearnOpenGL's small hand-tuned values (Khronos spec: extensions/2.0/Khronos/KHR_lights_punctual). Blender's glTF exporter (`glTF-Blender-IO/addons/io_scene_gltf2/blender/exp/lights.py`) converts lamp watts → candela as `energy/(4·π)` for point/spot, and in the default **Spec** lighting mode ALSO multiplies by 683 (`PBR_WATTS_TO_LUMENS`). So intensities land in the hundreds of thousands → the `/1000` fudge. Correct fix: keep intensities physical, apply ONE scene-wide exposure multiply at the end; OR re-export with Lighting Mode = **Compat** (skips ×683) for LearnOpenGL-range numbers.

2. **Gamma.** Two independent causes: (a) double/triple sRGB encode — if albedo textures import as sRGB AND the render target is an `*_SRGB` format, a manual `pow(c,1/2.2)` is an extra encode; do it exactly once. (b) Blender's DEFAULT view transform is **AgX** (Filmic on older builds), NOT Reinhard `x/(x+1)` — so even correct units won't match Blender's look. To compare apples-to-apples, set Blender *Color Management → View Transform* to **Standard**, or implement AgX in-shader.

3. **Slang has no built-in PBR/tonemap/gamma/color-space helpers** — the core module is basic types + intrinsics (dot/length/mul) only (DeepWiki). All of this is correctly the user's own shader code, so there's nothing "built-in" they're missing.

Repeat asker: wide0125 (also the 2026-07-13 struct-alignment thread) — a hobbyist writing a PBR renderer in Slang from the LearnOpenGL tutorial.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784300430455-blender-gltf-pbr-too-bright-gamma-mismatch-candela.md`_
