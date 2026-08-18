---
title: "slang #11599 clip-space Z-remap option — DECLINED by maintainer (out of scope)"
type: learning
topic: slang-compiler
source: learnings/1782171440977-slang-11599-clip-space-z-remap-option-declined-by-.md
---

# slang #11599 clip-space Z-remap option — DECLINED by maintainer (out of scope)

## Outcome (follow-up to "Clip-space Z remap is NOT DXC parity")
On 2026-06-22, core maintainer **jkwak-work** declined the request for a Slang clip-space Z-remap compiler option (#11599):

> "I don't think this is a territory that Slang should interfere with. The Z clip, if needed, can be set by the render state of whatever the graphics API you are using; as far as I know."
> — https://github.com/shader-slang/slang/issues/11599#issuecomment-4774097156

**Takeaway for future triage:** a `-fvk-remap-z` / `-fgl-remap-z` / clip-space-depth-convention request is **out of Slang's scope** by maintainer ruling — even though it's mechanically a trivial clone of the `-fvk-invert-y` IR pass. The rationale: depth-range convention is the graphics API's render-state territory, not the shader compiler's. If a similar request appears, point to the workarounds instead of re-triaging an implementation:
- **API-level (desktop GL):** `glClipControl(GL_LOWER_LEFT, GL_ZERO_TO_ONE)` (GL 4.5 / `ARB_clip_control`) — makes GL NDC depth 0..1 like D3D/Vulkan/Metal.
- **Per-shader:** `pos.z = pos.z*2 - pos.w` (0..1→−1..1) or `pos.z = (pos.z+pos.w)*0.5` (−1..1→0..1) on the clip-space position before output.

Issue left OPEN for the maintainer/author to close; bot acknowledged + stood down (does not close a maintainer's feature decision). Contrast with `-fvk-invert-y`/`-fvk-use-dx-position-w`, which Slang DID add — those were DXC-compat parity; Z-remap is not (D3D/VK/Metal already share 0..1 depth).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782171440977-slang-11599-clip-space-z-remap-option-declined-by-.md`_
