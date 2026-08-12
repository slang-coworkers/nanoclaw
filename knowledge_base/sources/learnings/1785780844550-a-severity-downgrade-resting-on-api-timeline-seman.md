# A severity DOWNGRADE resting on API timeline semantics — verify the receiver, not just that the call site exists

# A severity downgrade resting on API timeline semantics: verify the *receiver*, not just that the call site exists

**Context:** `shader-slang/slang-rhi#797`, third correction round between Main and slang-pr-approver, 2026-08-03. A CodeRabbit 🟠 Major flagged a non-aborting `CHECK` followed by an unconditional call that reaches `WaitForSingleObject(…, INFINITE)`. Both tiers converged on **nit-class, verdict does not move** — correct. The *reason given* was wrong, and it got recorded as the strengthened severity basis.

## The wrong premise

> "the `INFINITE` wait is on a **CPU-signalled** fence, so a resolve-bookkeeping regression yields a failing test, not a hang"

**Verified at the pinned SHA `b34042ac`:** `d3d12-command.cpp:2162` is

```cpp
m_d3dQueue->Signal(m_trackingFence.get(), m_lastSubmittedID)
```

That is **`ID3D12CommandQueue::Signal`** — a **GPU-timeline** signal, enqueued on the queue and processed in submission order. A CPU-side signal is the *other* method, on the *other* receiver: **`m_trackingFence->Signal(value)`** (`ID3D12Fence::Signal`). All four `Signal(` sites in the file (`:2044 :2129 :2132 :2162`) are queue-side; the CPU shape appears nowhere. So the GPU is very much involved in whether that wait returns.

## Why the conclusion survived anyway — and why that's the danger

The wait still can't hang on the regression the test targets, but for a **different** reason: the Signal is enqueued **fresh at wait time** and only needs **already-submitted** work to drain, which in the bookkeeping-regression scenario has already completed. A hang needs a genuine GPU stall (TDR / device-removal).

Right conclusion, wrong mechanism — **the hardest error class to catch, because the verdict it supports is correct, so nothing ever prompts a re-check.** It then hardens: it was written into the decision artifact *as the strengthening*, i.e. the false premise became the durable teaching while the true one went unrecorded.

## Rule

When a severity **downgrade** rests on an API's timing/ordering semantics, verify the semantics of the **exact method invoked — receiver *and* signature** — not merely that the call site exists at the cited line. `X->Signal(fence, v)` and `fence->Signal(v)` differ by *which object owns the verb*, and that difference is the entire argument. **"Verified the call site" ≠ "verified what the call does."**

Downgrades deserve this more than upgrades: an over-stated severity gets argued down by the next reader, while an under-stated one is *agreed with* and closes the thread.

## Method note — what a clean verification looks like here

Grep **all** call sites of the verb in the file and check they share the receiver you assumed (here: 4/4 queue-side ⇒ no CPU-signal path exists to have meant). Then walk the path end to end: `d3d12-query.cpp:129-132` — `getResult` with `state == Pending` → `resolvePendingTimestampQueries()` → `waitOnHost()` → `WaitForSingleObject(…, INFINITE)` (`:2168`).

Two adjacent claims in the same downgrade **did** hold under the same check, so this isn't an argument for blanket distrust — only for checking the load-bearing one:
- Pre-existing idiom precedent: `checkQueryResultReady` (`tests/test-cmd-query.cpp:36-41`) is non-aborting-`CHECK`-then-caller-`getResult`, with **4 call sites** (`:238→:241`, `:260→:261`, `:282→:285`, `:305→:306`) ⇒ not a novel deviation.
- `ci.yml` has **zero** `timeout-minutes` (0 occurrences / 139 lines on `main`) ⇒ a real hang is bounded only by GitHub's default job limit. Counter-consideration stands.

## Companion error in the same round: `file:line` in recorded artifacts

The finding's line was cited as `:412` by both tiers via **different routes** — Main quoted range-relative numbering from a `sed -n '395,425p'` window; the approver propagated CodeRabbit's inline anchor verbatim. Truth at the pinned SHA: the `CHECK` is `:409`; `:412` is the `getResult` it warns about. `:412` is a *real line in the relevant block, just not the one the finding is about* — wrong but not obviously wrong, so it survives review.

**Cure:** resolve every `file:line` against the pinned commit before it enters a recorded artifact; cite the line the finding's **claim** is about (inline anchors drift to the diff hunk, not the semantic subject); cross-check `original_line`/`start_line` against the prose. Note the approver held a prior learning covering exactly this (from #11118) and had applied it to bot-reported *counts* but not to *line refs* — **having the rule isn't executing it.**

Related: [an artifact-level defect is not a decision-level harm], [CodeRabbit findings live on pulls/N/comments], [never propagate harvest counts or line refs].
