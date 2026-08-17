---
title: "[approver/critique-mustfix] When a severity DOWNGRADE rests on API timing semantics, verify the receiver AND signature — not that a call exists at the cited line"
type: learning
topic: review-approval
source: learnings/1785780937062-approver-critique-mustfix-when-a-severity-downgrad.md
---

# [approver/critique-mustfix] When a severity DOWNGRADE rests on API timing semantics, verify the receiver AND signature — not that a call exists at the cited line

**Symptom.** Downgrading a CodeRabbit 🟠 Major on slang-rhi#797 to nit-class, I wrote that the `WaitForSingleObject(..., INFINITE)` in `CommandQueueImpl::waitOnHost` could not hang because the fence it waits on is **"CPU-signalled"**, citing `d3d12-command.cpp:2162`. **That premise is false.** Line `:2162` is `m_d3dQueue->Signal(m_trackingFence.get(), m_lastSubmittedID)` — that is **`ID3D12CommandQueue::Signal`**, a **GPU-timeline** signal enqueued on the queue and processed in submission order. The CPU-side signal is a different method on a different receiver: **`m_trackingFence->Signal(v)`** (`ID3D12Fence::Signal`). All four `Signal(` sites in the file (`:2044 :2129 :2132 :2162`) are queue-side; the CPU shape appears nowhere, so there was no path I could have meant. The GPU is squarely involved in whether that wait returns.

**The conclusion survived — for a different reason.** The wait can't hang on the regression *the test targets* not because the GPU is uninvolved, but because `waitOnHost()` enqueues a **fresh** Signal at wait time and therefore only needs **already-submitted** work to drain, which in the bookkeeping-regression scenario has already completed. A real hang still needs a genuine GPU/driver stall (TDR/device-removal). Nit-class holds.

**Why this is the error class worth a dedicated note: right conclusion, wrong mechanism.** Nothing prompts a re-check, because the call the premise supports is correct. It is invisible to outcome-based review. And it hardened in the worst possible way — the false premise went into the recorded artifact **as the strengthening** ("holds as a nit, on a stronger basis than test-only"), so the row taught the false mechanism while the true one went unrecorded. A reviewer who later leans on that row inherits a confident, wrong model of D3D12 fence timing.

**Rule.** When a severity **downgrade** rests on an API's timing/ordering semantics, verify the **receiver and signature of the exact method**, not merely that a call exists at the cited line. `X->Signal(fence, value)` vs `fence->Signal(value)` differ by *which object owns the verb*, and that difference was the entire argument. Concretely: grep every call site of the method name in the file and check what each is invoked *on*; if the distinction is load-bearing, name both forms explicitly in the artifact so the claim is falsifiable by the next reader.

**Downgrades need this discipline more than upgrades — an asymmetry worth internalizing.** An over-stated severity gets argued down by the next reader who disagrees; an **under-stated** one gets *agreed with*, and agreement closes the thread. So the direction that reduces scrutiny is exactly the direction that receives the least. Pair this with the sibling rule "narrowing a claim is not testing its premise": both describe ways a *more comfortable* conclusion escapes the check that a less comfortable one would attract.

**Related trap in the same finding, same session:** I also propagated CodeRabbit's line ref (`:412`) for a `CHECK` that sits at `:409` — bot anchors drift to the diff hunk, not the semantic subject. A peer reviewing the same code reached the same wrong number by a different route (quoting range-relative positions from a `sed -n` window as absolute), which made the agreement *feel* like corroboration when it was two independent errors converging. Two tiers agreeing on a number neither resolved at the pinned SHA is not verification.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785780937062-approver-critique-mustfix-when-a-severity-downgrad.md`_
