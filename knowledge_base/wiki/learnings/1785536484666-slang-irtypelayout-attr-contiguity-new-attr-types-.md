---
title: "Slang IRTypeLayout attr contiguity — new attr types interleaved into a mixed operand run break findAttrs"
type: learning
topic: slang-compiler
source: learnings/1785536484666-slang-irtypelayout-attr-contiguity-new-attr-types-.md
---

# Slang IRTypeLayout attr contiguity — new attr types interleaved into a mixed operand run break findAttrs

**Rule:** When adding a new `IRAttr` subtype that gets attached to an `IRTypeLayout` (or any inst whose readers use `findAttrs<T>()`), you MUST preserve the per-type contiguity of the operand list. `findAttrs<T>()` (source/slang/slang-ir.h ~599) skips to the first operand of type `T`, then STOPS at the first non-`T` operand — it returns only the FIRST contiguous run. The header (~line 596) documents this as an invariant.

**The bug (PR #12306, IRTypeAlignmentAttr):** `IRTypeLayout::Builder::addAttrs` iterated `m_resInfos` in `LayoutResourceKind` enum order and emitted, per kind, `size(kind)` then — inside the same loop — the new `TypeAlignment(kind)` attr. Since alignment attrs are always `Uniform` (enum index 8), any layout with a Uniform size attr (alignment>1) PLUS a higher-enum-index kind (ExistentialTypeParam=18, ExistentialObjectParam=19, DescriptorTableSlot=9) got: `size(Uniform), TypeAlignment(16), size(Existential…)`. `getSizeAttrs()`=`findAttrs<IRTypeSizeAttr>()` stopped at the TypeAlignment attr → dropped the existential size attrs → `bind-existentials.cpp findSizeAttr(ExistentialTypeParam)` returned null → slotCount=0 → existential/interface slot binding miscompiled. Reachable with `struct S { float4 color; ILight light; } ConstantBuffer<S>`.

**Fix:** emit the new attr type in a SEPARATE pass AFTER all size attrs (two loops, not one), so both runs stay contiguous.

**Verification tips:**
- Empirical proof: build slangc at the PR head, `slangc test.slang -target spirv-asm -dump-ir -o /dev/null`, and read the `structTypeLayout(...)` operand list directly — you'll literally see the attr order. A pre-PR binary is a valid oracle for alignment/stride VALUES and reachability (co-occurrence of kinds), but only the PR binary shows the new attr's interleaving.
- codex critique in a Docker container: must pass `sandbox:"danger-full-access"` (read-only/workspace-write fail with a bwrap namespace error). Instruct codex to stay read-only in the prompt.

**Retarget-mid-review:** if the fixer force-pushes during review, `git diff OLD..NEW` FIRST. If the buggy function (here `addAttrs`) is untouched in the delta, the finding persists verbatim — re-verify each finding's code still matches rather than re-running the whole pass. Sentinel-default changes (e.g. ResInfo::alignment 0→1) are equivalent iff the emission guard is unchanged (here `alignment > 1`, which both defaults fail → identical).

**Meta-lesson:** a fixer's "reviewer focus" list can miss the real blocker. PR #12306's 3 flagged concerns (element stride, alignment-1 convention, preservation completeness) were ALL fine — the blocker was a 4th issue outside them. Always run the full correctness pass.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785536484666-slang-irtypelayout-attr-contiguity-new-attr-types-.md`_
