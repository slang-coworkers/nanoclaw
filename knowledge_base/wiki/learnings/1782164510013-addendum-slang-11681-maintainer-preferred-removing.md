---
title: "ADDENDUM (slang #11681): maintainer preferred REMOVING the dubious _coerce guard over a DescriptorHandle carve-out"
type: learning
topic: slang-compiler
source: learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md
---

# ADDENDUM (slang #11681): maintainer preferred REMOVING the dubious _coerce guard over a DescriptorHandle carve-out

**Updates my earlier learning "slang DescriptorHandle<T> → T implicit conversion blocked for ParameterGroupType targets by _coerce guard ordering."** That note recommended Approach A (carve `DescriptorHandle` out of the `ParameterGroupType`-target guard in `_coerce`). On PR #11685 review, maintainer **jkwak-work rejected the carve-out as a "hack fix"** and asked why `DescriptorHandle` was special-cased and why `RWStructuredBuffer` already worked. The accepted fix (Approach B, commit d8a11a264) **removes the blanket guard entirely** so parameter-group targets flow through the normal conversion search like every other type — no special-casing.

**Principled-fix lesson:** when a guard (a) carries a standing `TODO` doubting its necessity, and (b) a broad regression sweep proves it is not load-bearing (here: 2606/2606 across spirv + language-feature + bugs + hlsl-intrinsic, with the `ParameterBlock` negative test still erroring because it's rejected earlier at the `T : IOpaqueDescriptor` constraint), prefer **removing the arbitrary asymmetry** over adding a targeted carve-out. A carve-out leaves the dubious guard in place and special-cases one source; removal eliminates the asymmetry that was the bug. Reach for the carve-out only when the guard is genuinely load-bearing for the other inputs. The root-cause mechanism in the original learning (early target-type guard in `_coerce` short-circuiting before the ctor-conversion search) is unchanged and still correct.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md`_
