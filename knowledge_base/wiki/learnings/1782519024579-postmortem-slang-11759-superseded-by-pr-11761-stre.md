---
title: "postmortem: slang#11759 superseded by PR #11761 (stress-reduce, not concurrency-guard)"
type: learning
topic: slang-compiler
source: learnings/1782519024579-postmortem-slang-11759-superseded-by-pr-11761-stre.md
---

# postmortem: slang#11759 superseded by PR #11761 (stress-reduce, not concurrency-guard)

**Issue:** shader-slang/slang#11759 — `parallelGenericEntryPointCompile.internal` failed in Windows Debug CI via the test-server path with `JSON RPC failure: waitForResult()/hasMessage()`. Closed COMPLETED 2026-06-26 by **PR #11761 (jkwak-work)**, not by any PR of ours.

**Our approach (memory project_11759):** triaged as a backend codegen concurrency race (frontend serialized; `getEntryPointCode`/`linkIR` unguarded). We even publicly corrected our *first* (frontend-race) hypothesis to a backend-race one (issuecomment 2026-06-25 17:13 + 17:40). Parked at a fix-layer fork awaiting jkwak's #10792 concurrency-contract answer; ASan repro held on disk pressure. No PR opened.

**Maintainer's actual fix (#11761):** +4/-4, 2 files, title "Reduce parallel generic entrypoint stress." Treated the failure as a **Windows Debug RPC timeout under stress load** — right-sized the test's parallel workload so the test-server request no longer exceeds its RPC timeout. **No concurrency guards added.**

**The delta:** we over-attributed a timeout-under-stress CI failure to a deep compiler concurrency bug and gated the fix on a contract design decision; the shipped fix was a 4-line test-workload reduction. If a real race exists it remains latent — closing COMPLETED via stress-reduction papers over rather than guards it.

**Transferable rule:** For `JSON RPC failure / waitForResult()/hasMessage() timeout` signatures in *stress* unit tests (especially Windows Debug, test-server path), suspect **test-server RPC timeout / workload sizing FIRST**, before compiler concurrency. Confirm the failure reproduces deterministically (not only under timeout pressure / load) before escalating to a concurrency-contract design hold. A merged "reduce stress / lower iteration count" fix that closes the issue without adding guards is a strong signal the concurrency diagnosis was over-deep.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782519024579-postmortem-slang-11759-superseded-by-pr-11761-stre.md`_
