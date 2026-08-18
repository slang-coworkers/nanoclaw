---
title: "[approver/challenger-miss] Proving a transform is deterministic is not proving its output matches the world — the 4th round-up on 'found it, wrote it down, cleared it'"
type: learning
topic: review-approval
source: learnings/1785937086901-approver-challenger-miss-proving-a-transform-is-de.md
---

# [approver/challenger-miss] Proving a transform is deterministic is not proving its output matches the world — the 4th round-up on "found it, wrote it down, cleared it"

**Symptom.** slang-rhi#813 makes `createBufferFromNativeHandle` call `fixupBufferDesc(desc)` on Vulkan/D3D12, deriving `defaultState` from `usage` when the caller left it `Undefined`. I verified the helper exhaustively — 6 pure lines (`src/resource-desc-utils.cpp:58-65`), one condition, no dangling temporary, byte-identical descriptor unless the field is `Undefined` — and concluded WOULD_APPROVE, scoring the missing test as a nit. The DECISION_REVIEW critique returned MUST-FIX ⇒ **ABSTAIN_POLICY (OPEN_GAP)**. I accepted it.

**Root cause — the transferable error.** Everything I verified was about the **descriptor rewrite**: that it is pure, monotone, deterministic. The claim the change actually makes about the world is different: that **an externally-owned buffer handed to an import API is in the usage-derived state**. `BufferImpl` caches that derived value as the assumed initial state (`src/d3d12/d3d12-buffer.cpp:9`), the state tracker seeds from it (`src/state-tracking.h:173`), and barriers are emitted from that assumption. If the owning application left the resource in COMMON, the assumption is wrong and so are the barriers. **I proved determinism and treated it as correctness.**

⭐⭐ **A PURE FUNCTION'S PROVABLE BEHAVIOR IS A CLAIM ABOUT THE FUNCTION, NOT ABOUT THE STATE OF THE EXTERNAL OBJECT IT DESCRIBES.** The distinction bites hardest on **import/adopt/attach APIs**, where a descriptor is an *assertion about a resource this library does not own*. "The rewrite is deterministic" and "the rewritten value is true of the resource" are different propositions; verifying the first feels like rigor and answers nothing about the second.

**Two secondary errors worth their own tells:**
1. **Precedent for the APPROACH is not the criterion "branch already covered elsewhere."** I cleared the contract concern because the maintainer already shipped this mechanism on the sibling *texture* import paths (`src/d3d12/d3d12-device.cpp:1514`, `src/vulkan/vk-texture.cpp:468`). That is evidence the approach is accepted; the gap-clearing bar requires the *specific behavior* to be exercised or the trigger unreachable. Neither held — and the API carries **no documented state contract** (`include/slang-rhi.h:3438`, no doc comment; no comment at either changed site). ⭐ **"The maintainer did this elsewhere" answers *is this approach sanctioned?*, never *is this instance correct?***
2. **A supporting trace can establish less than you lean on it for.** My strongest finding — that pre-fix, `requireDefaultStates()` transitions the buffer *back* to `Undefined` and reaches `SLANG_RHI_ASSERT(src)` with `src=false` (`src/state-tracking.h:127`, `src/vulkan/vk-command.cpp:1716`, `src/vulkan/vk-utils.cpp:418`) — proves that **leaving `Undefined` is bad**. It does not prove the usage-derived state is the **right replacement**. ⭐ **When a trace supports "X is broken", check whether you are using it to support "therefore Y is correct" — the second needs its own evidence.**

**How to catch it — the tell fired and I overrode it.** I wrote, in my own investigation doc, that this was *"the one call in this decision that a critic should press hardest"* — and then cleared it. ⛔⭐⭐ **NAMING A CONCERN AS THE WEAKEST POINT OF YOUR DERIVATION AND THEN NOT CHARGING IT *IS* ROUNDING UP UNDER UNCERTAINTY.** This is the **4th recorded instance** of the identical pattern (prior: #808, #11118, and one earlier), and in every case the tell was already in my own text before the critique found it. The mechanical countermeasure: **grep your own draft for hedges — "the one call a critic should press", "if a plausible reading", "arguably", "the weakest point" — and treat each as a pre-written abstain that you have not yet honored.**

**Fix.** ABSTAIN_POLICY(OPEN_GAP) recorded @`abec21d2fdb4`. Note the polarity for calibration: this abstain says *a human must look at the state contract*, **not** that the PR is wrong — the change is directionally toward correctness and no 🔴 exists. Also: coverage here is structurally absent, not merely thin — `tests/test-buffer-from-handle.cpp:24` sets `defaultState = UnorderedAccess` **explicitly**, making the changed call an exact no-op in the only test of the path (see the companion learning on masked default-value tests).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785937086901-approver-challenger-miss-proving-a-transform-is-de.md`_
