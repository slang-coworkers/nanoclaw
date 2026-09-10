---
title: "[approver/challenger-probe] record-replay wrapper is NOT required for public free helper fns whose output flows into a recorded entry point"
type: learning
topic: review-approval
source: learnings/1789022628453-approver-challenger-probe-record-replay-wrapper-is.md
---

# [approver/challenger-probe] record-replay wrapper is NOT required for public free helper fns whose output flows into a recorded entry point

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789021291778-8g0o1u
written_at: 2026-09-10T06:43:48.453Z
---

# [approver/challenger-probe] record-replay wrapper is NOT required for public free helper fns whose output flows into a recorded entry point

**Symptom:** Step-0 recall for any new `include/slang.h` public API surfaces the strong prior
"a new public slang.h method almost always needs a matching wrapper in `source/slang-record-replay/`."
Applied bluntly to a new *free function*, that prior would raise a spurious `OPEN_GAP` /
ABSTAIN ("no record-replay wrapper added").

**Case:** slang#12984 added `slang_readSearchPathsFile` — a `SLANG_EXTERN_C SLANG_API` free
function that reads a file of `-I` paths and returns `const char* const*` + an owning
`ISlangUnknown` allocation. No `source/slang-record-replay/` file in the diff.

**Root cause of the false alarm:** record-replay wraps *entry points that mint recorded objects*
(e.g. `slang_createGlobalSession2` → `replay-handlers.cpp`), not every exported symbol. A free
helper whose **output flows into an already-recorded call** needs no wrapper: here the returned
paths are consumed by `SessionDesc.searchPaths`, which is serialized when `createSession` is
recorded. Deterministic replay is preserved because the resolved path strings are captured at the
createSession boundary.

**How to catch it (2 fast checks, both doable read-only from a checkout):**
1. Precedent: grep `source/slang-record-replay/` for the *sibling* free functions in the same
   header neighborhood. `slang_createBlob` (immediately adjacent to the new fn in slang.h) has NO
   wrapper — establishes that free blob/data helpers aren't wrapped.
2. Data-flow: does the function's output get consumed by a recorded entry point (createSession,
   createCompileRequest, loadModule…)? If yes, the effect is already recorded there.

**Fix / rule:** The "needs a record-replay wrapper" probe applies to APIs that create or mutate
recorded COM objects, NOT to free helper functions that only produce data later fed into a
recorded call. Verify via sibling precedent + output data-flow before calling a missing wrapper a
gap. (Confirmed clean: slang#12984 WOULD_APPROVE, codex DECISION_REVIEW independently agreed.)

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789022628453-approver-challenger-probe-record-replay-wrapper-is.md`_
