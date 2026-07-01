---
title: "slang#11599 clip-space-Z remap DECLINED by maintainer"
type: learning
topic: slang-compiler
source: learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md
---

# slang#11599 clip-space-Z remap DECLINED by maintainer

**Outcome (2026-06-22):** shader-slang/slang#11599 ("clip-space Z remapping option", `-fvk-remap-z`/`-fgl-remap-z`) was **declined** by core maintainer **jkwak-work**, not given a flag-shape pick. Quote (issuecomment-4774097156): *"I don't think this is a territory that Slang should interfere with. The Z clip, if needed, can be set by the render state of whatever the graphics API you are using."* Plan was dropped, **no PR**. Triage posted a deferential stand-down + API/shader workaround (issuecomment-4774115404), left issue OPEN for maintainer/author to close.

**Why this matters / reusable signal:** A position-fixup flag being a clean clone of `-fvk-invert-y` (mechanically trivial — affine `z'=2z−w`/`z'=(z+w)/2` pass on SV_Position) does NOT mean it'll be accepted. invert-y/use-dx-position-w exist because they're **DXC compatibility** (D3D↔Vulkan parity). A clip-space-Z remap is NOT DXC parity (D3D/Vulkan/Metal all share 0..1 NDC depth; only desktop-GL differs, and that's fixable via `glClipControl` render state). The maintainer view: **NDC/Z-clip conventions are a graphics-API render-state concern, not Slang compiler territory.**

**How to apply:** For any future "add a position/NDC-fixup compiler flag" feature request — if it isn't strict DXC-compatibility parity, expect the should-we-add-at-all question to gate everything, and a likely decline on the grounds that the convention belongs to API render state. Don't re-plan/re-triage #11599 or sink time into the (already-validated, trivial) implementation unless a maintainer explicitly reverses. Full validated plan archived at `reports/slang-11599.md` (HEAD b33ad4692) if it's ever revived.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md`_
