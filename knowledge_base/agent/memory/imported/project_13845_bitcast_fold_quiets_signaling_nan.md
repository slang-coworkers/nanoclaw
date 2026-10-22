---
type: project
name: project_13845_bitcast_fold_quiets_signaling_nan
description: "HUMAN-OWNED, nothing dispatched (10-21 22:30Z). slang#13845 (albertrodriguezclo, external): a constant bit cast folded to a float literal quiets a signaling NaN (IR float literals are double; SCCP fold, IRBuilder::getFloatValue and SPIR-V float emit all convert through hardware). The author filed it together with their own fix PR #13846 (fix/wgsl-asfloat-keep-nan-bits, reviewer lujinwangnv, assignees jkwak-work + author). Spun off from our PR #13816 (#13635, slang-fixer sess-1792074353196-gj2lyx), which needs a one-line WGSL emitter change once #13846 lands."
---

# slang#13845: constant-folded bit cast to `float` quiets a signaling NaN

**10-21 22:29:56Z `issue_opened`.** Main webhook session `sess-1792621796690-woo8ez`. Live read at ~22:35Z: open,
0 comments, no labels, assignee jkwak-work (github-actions auto-assign).

**Origin.** The author's run-time measurements on our PR #13816 (WGSL `asfloat` NaN/Inf, parent issue #13635) showed
WGSL quieting signaling NaNs. Our bot's reply there called it WGSL-only and "wider than this issue". The author then
showed that SPIR-V on master quiets them the same way, and filed this issue.

**Ownership.** The timeline shows a `cross-referenced` event from **PR #13846**, which the author opened 29 s after the
issue ("Fixes #13845"). That PR changes `slang-math.h` (`FloatBitsToDouble`/`DoubleToFloatBits`), `slang-ir-sccp.cpp`,
`slang-ir.cpp` and `slang-emit-spirv.cpp`, and adds `tests/spirv/bitcast-constant-signaling-nan.slang`. It is not a draft,
and lujinwangnv is the requested reviewer.

**Disposition: held, nothing dispatched or posted.** A human filed the issue with their own fix PR, so triage or a
bot fix would duplicate their work.

**Link to our chain.** At 22:31:47Z the author commented on #13816 (comment 6328000332) with the follow-up that PR
needs once #13846 is in: the WGSL emitter narrows with `DoubleToFloatBits(litInst->value.floatVal)` instead of
`FloatAsInt(float(...))`, and `tests/wgsl/asfloat-signaling-nan.slang` expects `_slang_getNan(0x7F800001u)`. The host
routed that `pr_mention` to the #13816 owner (slang-fixer `sess-1792074353196-gj2lyx`, inbound seq 94), so the
fixer owns the follow-up.

**Resume on:** a maintainer asking the bot to act on #13845/#13846, or #13846 merging, which makes the #13816
follow-up line applicable. The fixer chain owns that.
