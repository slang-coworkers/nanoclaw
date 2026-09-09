---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786363970214-op45cn
written_at: 2026-08-10T18:00:31.717Z
---

# liveness-claims-carry-their-sha-slang-rhi-821-round4

# A liveness claim is a claim about a HEAD, not about a defect (slang-rhi #821→#825, 2026-08-10)

Round 4 of the `shader-slang/slang-rhi#821` chain. **Both the approver and I shipped wrong
liveness claims, in opposite directions, from sound underlying verifications.** Verified at live
HEAD `f8460cca` (`Simplify and harden the task pool API (#825)`, 17:28:49Z) — resolved fresh,
because the correcting report itself pinned `8f1e51b2` and was ~1.5 h stale by the time I read it.

## The shared defect

⭐⭐⭐ **A verified mechanism ages well; "live on `main`" does not. Its shelf life is measured in
COMMITS, not insight.** `main` moved #821→#822→#823→#824→#825 in ~5 h because the author was
landing a series *through the reviewed area*. My own verification was sound at `762652d8` and
wrong ~90 min later.

⇒ **Every liveness claim carries, inline, the SHA it was resolved against.** "Live at
`<sha>`" is checkable and ages honestly. Bare "live" silently converts a measurement into a
standing assertion. Same failure class as re-shipping a stored figure as a live finding.

## Both directions were wrong — that's the instructive part

**My error: "Verified live" for the UAF.** #823 had closed the race. I had literally filed the
re-resolve-HEAD rule hours earlier, adopted from the approver after correcting *it* for the same
thing. Right rule, not applied to my own scope.

**The approver's error: "✅ FIXED by #823."** Also overstated. Verified at HEAD:

- ✅ The device-wide `m_pipelineResolutionMutex` is real and correctly placed — first statement of
  `resolve()` (`pipeline-resolver.cpp:99`, decl `device.h:522`), *above* the serial/parallel branch,
  so both arms hold it. No path reaches `createConcretePipeline` or `addSpecializedPipeline`
  without it (2 callers each, all traced). Dedup by `PipelineKey` before creation (`:204-255`),
  serial publication in `finalize()` (`:443`).
- ⛔ **The unsafe representation is byte-for-byte unchanged**: raw `IComputePipeline* pipeline`
  (`command-list.h:214`), `write` retains only the *virtual* pipeline into a pointer-value-keyed
  set (`command-list.cpp:161`), `patchCommand` overwrites `cmd.pipeline` unretained
  (`pipeline-resolver.cpp:171`), cache still sole owner (`device.cpp:319` comment verbatim
  *"Pipeline is owned by the cache"*), store still the dropping `specializedPipelines[key] = value`
  (`device.cpp:106`).
- ⛔ **Nothing enforces the discipline.** `ShaderCache::m_mutex` guards each accessor individually
  and does **not** span the check-then-act; there is no assert that the resolution mutex is held.
  Any future caller outside `resolve()` reopens the double-miss with zero compile- or run-time
  signal. `ShaderCache::free()` is a third writer taking only `m_mutex`.

⇒ ⭐⭐⭐ **"Fixed" and "currently unreachable by the call graph" are different claims.** A race
closed by a *caller's* lock over an unchanged unsafe representation is a **narrowing**: it returns
the moment the lock is relaxed for throughput — and the device-wide lock is held across all
parallel compile/create work and both task-pool waits, making it the prime candidate for exactly
that. Also note `PipelineCompilationMode::Serial` is the default (`slang-rhi.h:3334`,
`device.h:519`) and `Parallel` is documented *"Experimental"*, so the new machinery is opt-in.
Report *unreachable-by-call-graph*, never *fixed*, when the representation still permits the bug.

## Second lesson: a worst-case figure can be understated by the person raising the alarm

The approver reported the user `IDebugCallback` running under "as many as **three** non-recursive
mutexes." All three code paths VERIFIED (`device.cpp:176`→`:213`→`device.h:405`;
`m_pipelineResolutionMutex` across `getSpecializedProgram` at `pipeline-resolver.cpp:270`;
`ProgramWork::compileLock` `:73`/`:78` across `reportEntryPointCompilation` `:352` →
`shader.cpp:205`, released only at `:364`). `grep recursive_mutex` = **0** tree-wide.

But **the "three" is refuted and the reality is worse**: `m_specializedProgramsMutex` (released
when `getSpecializedProgram` returns at `:270`) and `m_compileMutex` (acquired at `:282`) are
sequential stages, never co-held — so that stack maxes at **2**. Meanwhile `ProgramWork` holds
**one `m_compileMutex` per distinct program** in the batch, all simultaneously, so Path 3 invokes
the user callback under **1 + K** non-recursive mutexes, K = distinct uncompiled programs —
**unbounded**. Work-stealing widens it further: `task-pool.cpp:12-15` lets a waiting thread run
unrelated tasks while `resolve()` holds the device-wide lock across `batch.wait()`.

⇒ ⭐⭐ **Check a worst-case figure in both directions. A too-low bound from the alarm-raiser is
credible precisely because it cuts against them** — and a refuted "3" invites dismissing the
whole finding, when the honest number is "unbounded".

## The finding that survives, and its sharp framing (the approver's, and it's right)

`include/slang-rhi.h:3201` — added by #821 itself — promises: *"May be called concurrently from
multiple threads. Implementations must provide any required synchronization."* Verified verbatim
at that exact line. **This is a contract bug, not merely a lock bug**: it instructs the user to
take *their* lock inside `handleMessage` while we hold up to `1 + K` of ours, and there is **no
re-entrancy or forbidden-action clause anywhere in the repository** — established by exhaustive
unfiltered grep over the whole tree for 14 terms (`reentran`, `re-entran`, `non-reentrant`,
`must not call back`, `from within the callback`, `inside the callback`, `deadlock`, …); the only
other guidance is `docs/error-handling.md:63` ("keep callbacks thread-safe"). A documented
lock-order inversion.

Still genuinely open, and why a human decides: no documented threading contract for concurrent
single-device encoding exists either. Silence in a contract is evidence for **neither** side —
clearing on it is wrong, and blocking on it is wrong.

## What paid for itself

The #821 record bound the next PR: *"must land per-key in-flight state (one creates, others wait)
plus a concurrent same-key regression test, and must be GATED on it."* #823/#824 landed exactly
that with threaded tests passing on real D3D12. **Because the trigger condition was written down,
this round could CHECK it instead of re-deriving it.** Write the follow-up condition into the
durable record, not just the verdict.
