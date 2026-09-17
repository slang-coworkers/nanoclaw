---
title: "Verifying a SKIP_SANITIZERS boundary + TSan false-positive reasoning when TSan can't run"
type: learning
topic: verification
source: learnings/1789546126437-verifying-a-skip-sanitizers-boundary-tsan-false-po.md
---

# Verifying a SKIP_SANITIZERS boundary + TSan false-positive reasoning when TSan can't run

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787565793093-np84lo
written_at: 2026-09-16T08:08:46.437Z
---

# Verifying a SKIP_SANITIZERS boundary + TSan false-positive reasoning when TSan can't run

Context: reviewer asked whether excluding `slang-glslang` (via `SKIP_SANITIZERS`) from ThreadSanitizer produces false positives, and asked for an empirical run. TSan couldn't run in the container (ASLR-locked; see the separate learning). Two durable takeaways:

1. **Instrumentation-boundary verification substitutes for a blocked race run.** Even when a TSan process can't start, you can still prove the skip does what it claims by inspecting the produced binaries: `nm -D <lib>.so | grep -c __tsan_` and `ldd <lib>.so | grep tsan`. Here `libslang.so` had 23 `__tsan_` symbols + linked libtsan, while `libslang-glslang*.so` had **zero** and did not link libtsan — the skip excludes exactly the wrapper. This is a legitimate, reportable partial result.

2. **A `SKIP_SANITIZERS`/uninstrumented-library boundary is usually TSan-*safe*, not a false-positive source.** TSan's `pthread`/mutex interceptors are installed **process-wide at the runtime level**, independent of compile-time instrumentation — so an uninstrumented library's own locking stays *observable* and happens-before edges are still established. Uninstrumented code mainly costs false *negatives* (missed accesses), not false positives. The only real false-positive window is *non-interposed* synchronization: lock-free handoff through raw atomics compiled without instrumentation, ordering instrumented memory across threads. If a boundary passes only per-call disjoint buffers (thread-local pools, read-only shared inputs), that window is closed. Corollary: making such a skip "ASan-only" (instrument the thin wrapper but not the external lib it sits on) *increases* false-positive surface — prefer a targeted suppressions file over narrowing the skip. (Also: `mimalloc` DOES have a TSan mode, `MI_DEBUG_TSAN`; the gap when it's off is uninstrumented allocator *internals*, not "no integration.")

Process lesson from the same PR: an approval can land mid-turn — never post a reply drafted against a now-superseded `changes_requested` review; re-check PR review state before delivering. And don't list an item in an "open gaps" list that your own PR *corrects* (here `server-count 1`).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789546126437-verifying-a-skip-sanitizers-boundary-tsan-false-po.md`_
