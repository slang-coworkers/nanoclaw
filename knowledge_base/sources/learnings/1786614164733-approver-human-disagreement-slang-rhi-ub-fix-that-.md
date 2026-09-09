---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786609057661-38chiz
written_at: 2026-08-13T09:42:44.733Z
---

# [approver/human-disagreement] slang-rhi UB-fix that WIDENS a container's input set can newly expose a pre-existing error-path bug — enumerate every failure mode of a Major finding before clearing it

## Case
shader-slang/slang-rhi#838 "Fix shader sub-object layout creation" (skallweitNV, MEMBER), decided @982d15cfde57 → **ABSTAIN_POLICY:OPEN_GAP**; **MERGED at my exact decided head** (self-merge, zero interval commits, `reviewDecision` still REVIEW_REQUIRED, only CodeRabbit COMMENTED — no human approval). Formal disagreement vs my ABSTAIN, but **weak calibration evidence**: no independent reviewer considered the concern; the author merged despite CodeRabbit's VISIBLE Major, and my internal abstain never posted, so it was not knowingly overridden.

## Symptom
I drafted WOULD_APPROVE by clearing CodeRabbit's sole 🟠 Major ("dereference an invalid layout OR perform invalid cleanup") as "pre-existing + not-widened + error-path-only." DECISION_REVIEW (codex) caught that I proved only the **downstream-deref** half. The Major had **two failure modes** and I traced one.

## Root cause
A "pre-existing / unchanged-code" clearance is scoped to the failure mode you actually trace — it does NOT transfer to a co-located second mode. Here both modes live in unchanged lines, but:
- **Deref mode** (null `subObjectLayout` deref'd in ParameterBlock/ConstantBuffer accounting): genuinely NOT widened — structured buffers (the newly-fixed path) hit `default: break` and are never deref'd there. Clears.
- **Cleanup mode** (destructor `~ShaderObjectLayoutImpl` unconditionally `wgpuBindGroupLayoutRelease`s null handles on `_init` failure): the SAME fact that makes the deref harmless — "structured buffers now reach `createForElementType`" (base crashed earlier at `varLayout->getTypeLayout()`) — is what WIDENS the input set reaching the failing builder. Widening the input set that reaches an unchanged-but-buggy error path expands that bug's reachability even though the bug's LINES are untouched.

## How to catch it
1. **Enumerate every failure mode named in a finding** ("X OR Y") and clear each separately. "Pre-existing/not-widened" proven for X says nothing about Y.
2. **"Not-widened" is per-failure-mode, not per-PR.** For a change that broadens what a container/type dispatch accepts, ask: does any newly-accepted input now reach code (even unchanged code) it couldn't reach before? A UB-*fix* that stops an early crash can ROUTE that input deeper into a pre-existing latent bug.
3. Keep the reachability claim **conditional** when you can only prove entry, not the full trigger: "the PR *may* expose the cleanup IF the nested layout creates bind-group entries AND creation fails" — don't state "newly-reachable" categorically without proving the descriptor-set-creation + failure legs.
4. Native release/free calls behind raw fn-pointer API tables (e.g. slang-rhi's `wgpu-api.h` X-macros) are NOT null-guarded by the wrapper; null-release safety is an external-API guarantee, unverifiable read-only ⇒ legitimate OPEN_GAP, not a nit.

## Fix (procedure)
On the fallback tier, a REQUEST_CHANGES review doc with a multi-mode Major finding cannot be rounded up until EVERY mode is cleared with proof. Uncertainty on any mode ⇒ ABSTAIN_POLICY:OPEN_GAP. Also: the DECISION_REVIEW critique gate is the backstop that caught the over-clear — a WOULD_APPROVE that cheap-clears a reviewer flag aimed at the fix under review is my most-punished class (cf. #826).

## Join scoring note
An unchanged author self-merge with no human review is APPROVED-equivalent for joining but weak evidence: score the disagreement, but record that no reviewer validated the safety I couldn't, and my abstain agreed with the sole visible reviewer's Major. Not a clean false-abstain.
