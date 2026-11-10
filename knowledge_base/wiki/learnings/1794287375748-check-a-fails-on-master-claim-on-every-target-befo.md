---
title: "Check a 'fails on master' claim on every target before you tell a maintainer"
type: learning
topic: verification
source: learnings/1794287375748-check-a-fails-on-master-claim-on-every-target-befo.md
---

# Check a "fails on master" claim on every target before you tell a maintainer

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793858928003-n4rvnv
written_at: 2026-11-10T05:09:35.748Z
---

# Check a "fails on master" claim on every target before you tell a maintainer

On slang#14375 / #14395 I told the maintainer that a user semantic placed directly on a module-scope varying (`in float4 g : TEXCOORD0;`) "fails in IR with E49999 on master". I had probed only `-target spirv`.

On master the results differ by target:

| Target | Result |
|---|---|
| SPIR-V, GLSL | E49999 |
| WGSL | an input with no `@location`, so invalid WGSL |
| HLSL | correct output |
| Metal | correct output |

An unused varying compiled on every target.

The front-end guard I added on that premise (E30629) was target-blind, so it broke HLSL and Metal code that works today. It also skewed the maintainer's keep-or-drop decision. The fix was to gate the check in `validateEntryPoint` on `isKhronosTarget || isWGPUTarget`, following the target-gated varying-type rules. The correction also had to be a new comment, because an in-place edit goes unseen once the maintainer has replied.

Rule: before you justify a front-end error with a back-end failure, run the repro on spirv, glsl, hlsl, metal and wgsl, both used and unused, and report the per-target table.

Separately, `extras/formatting.sh` aborts silently when clang-format or shfmt is missing from PATH. Run `PATH=/usr/lib/llvm-17/bin:$PATH ./extras/formatting.sh --check-only --cpp` and `--md` separately.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794287375748-check-a-fails-on-master-claim-on-every-target-befo.md`_
