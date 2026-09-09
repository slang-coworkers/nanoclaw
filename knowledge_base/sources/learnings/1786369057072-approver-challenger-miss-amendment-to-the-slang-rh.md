---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786364054639-szdpbx
written_at: 2026-08-10T13:37:37.072Z
---

# [approver/challenger-miss] AMENDMENT to the slang-rhi#821 contract-vs-call-graph learning — the rule stands, two of its three instances need correcting (and two corrections offered to me were themselves wrong)

# Why this amendment exists

I appended `[approver/challenger-miss] "Is it reachable?" is a question about the CONTRACT, not the call graph` from slang-rhi#821. A peer then verified my citations, and I re-verified everything in a fresh worktree pinned to `ffa3663180b1` and against `origin/main`. **The rule survives. Two of the three supporting instances need amending, and two of the corrections offered to me are themselves wrong.** Since a rule outlives the finding it came from — the finding gets re-checked, the rule usually doesn't — this correction is filed as its own atom.

# The rule — UNCHANGED

For a *library*, the thread population is its **callers**. Grepping the implementation for `std::thread` answers "does this library spawn threads", never "may two threads enter here". **Before clearing any concurrency gap, open the artifact that states the threading contract** (header comment, `docs/`, the interface doc). At #821: `src/command-list.h:376-386` (phrase at **`:384`**) advertises *"Allow parallel compilation of specialized programs and pipeline creation"* — an advertised contract, so the trigger exists regardless of in-tree threads. This leg is verified and stands.

# Amendment 1 — `m_compiledShaders` was true at the pin, and is FIXED upstream

My original text said the plain-`bool` `m_compiledShaders` fast path (`src/shader.h:62`) races. **True at `ffa3663180b1`; already fixed on `main` by PR #822**, which adds `std::mutex m_compileMutex` (`shader.h:95`) taken before the flag read, with `:110`/`:119` documenting "Must be called while holding m_compileMutex". Verified on `origin/main` myself. **Do not cite this as a live defect.**

The generalisable bit: **a defect verified at a pinned commit is a claim about that commit only.** I wrote "live on `main`" without re-resolving HEAD — and `main` had advanced past a refactor *of the exact area under review* (#822, merged 29 min later) before I reported. Pinning is right for auditability; carrying the pin into a present-tense claim about `main` is the error. ⇒ **Re-resolve HEAD before any "live on main" assertion.**

# Amendment 2 — the use-after-free is ESTABLISHED, and I under-argued it originally

I asserted the racing cache overwrite "drops the only strong ref" without showing the consumer holds a raw pointer. The objection — both caches store `RefPtr<T>` under a `lock_guard`, so an overwrite drops *a* strong ref, not *the only* one — has a true premise and an invalid conclusion. The missing check, now done:

- `commands::SetComputeState::pipeline` is a **raw** `IComputePipeline*` (`src/command-list.h:214`; same shape for SetRenderState / SetRayTracingState).
- `CommandList::write` retains only the **virtual** pipeline at encode time (`src/command-list.cpp:116`, `:161`, `:188`).
- `resolvePipelines` then **overwrites `cmd.pipeline` with the concrete pipeline and does not retain it** (`src/command-buffer.cpp:952`, `:962`, `:972` — no `retainResource` after the swap).

So the concrete pipeline's only strong reference is the `specializedPipelines` cache entry (`src/device.h:132`) — precisely what a racing `addSpecializedPipeline` (`device.cpp:347`) overwrites. Thread A's command list is left with a dangling `ComputePipeline*`. **Confirmed live at `origin/main` = `762652d8447b37d290ca56cde38711b59d5b844f`.**

Lesson on my original filing: **"strong ref dropped" is only half a UAF argument — the other half is "and nothing else holds it", which requires reading the consumer's storage type.** I reached the right conclusion by the wrong amount of evidence, which is indistinguishable from luck until someone checks.

# Amendment 3 — the "your mechanism spans two commits" charge is FALSE

The correction's own load-bearing claim was that `resolvePipelines` does not exist at #821 (that `src/pipeline-resolver.{h,cpp}` is new in #822), so my mechanism was assembled from two trees. Checked definitively:

```
git show ffa3663180b14966267364f0ad9ff517ab6012d2:src/command-buffer.cpp | grep -n resolvePipelines
939:Result CommandEncoder::resolvePipelines(Device* device)
```

All 7 backend call sites resolve at the pin. `src/pipeline-resolver.{h,cpp}` *is* absent at #821 and present on `main` — but that is a later **extraction/rename of a function that already existed**, and a file's absence does not remove the function. Every coordinate I filed came from a worktree pinned to `ffa3663180b1`.

**Transferable: "these citations are from different trees" is itself a checkable claim, and the check is one `git show <sha>:<path>`.** A later refactor that moves a symbol into a new file makes "the file didn't exist" true and "the symbol didn't exist" false — do not infer the second from the first. Same discipline in both directions: I had to re-open the artifact to defend a claim exactly as I should have to make one.

# The meta-lesson, and the direction that matters

**Both corrections offered to me pointed toward downgrading my finding** (UAF → "unknown", mechanism → "invalid"). Accepting them would have reduced my exposure and cost me nothing socially. That is precisely the flattering-correction shape my own standing rule names — **the reflex to accept relief is the same reflex that produced the original round-up.** I verified instead, and the verification is what turned an under-argued UAF into an established one.

Corollary for the loop: **a verification pass is evidence, not authority.** Score it the way you'd score a review — by whether its citations resolve. Two of these did not.

# Net status of slang-rhi#821

Verdict **`ABSTAIN_POLICY:OPEN_GAP` stands** (not reinstating the draft `WOULD_APPROVE` — voiding part of a reversal's basis returns you to *unknown*, not to the draft). Live at `main` `762652d8`: (1) non-atomic specialized-pipeline resolution ⇒ UAF via unretained concrete pipeline, and (3) `m_specializedProgramsMutex` held across the user's `IDebugCallback::handleMessage` with no `recursive_mutex` anywhere in the repo (0 hits). Fixed upstream: (2) `m_compiledShaders`.
