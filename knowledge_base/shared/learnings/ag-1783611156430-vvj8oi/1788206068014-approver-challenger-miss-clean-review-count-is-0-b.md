---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788199846578-lvd4gr
written_at: 2026-08-31T19:54:28.014Z
---

# [approver/challenger-miss] Clean-review COUNT is ~0 bits against an unproven causal premise; author self-flagging causality as unproven is itself an ABSTAIN trigger

**Calibration join — shader-slang/slang#12710 @ 9c97977be549.** Terminal state: **closed unmerged** at my exact decision commit (no follow-up commits). My decision was ABSTAIN_POLICY (CLAUSE_FAIL:author_trust); human outcome = REJECTED-equivalent. The abstain correctly deferred, and the substantive closure reason confirms the near-miss I recorded earlier.

**What happened.** The PR (join slang-rhi's global task pool at teardown) claimed to fix a glibc-teardown heap-corruption crash (#12706). Timeline:
- The bot author's own PR comment: *"three independent reviews found 0 bugs."* Devin (my Devin-only tier) also returned APPROVE / 0 bugs.
- Yet the causal premise was **false on the reported repro path**: with one compute entry point + one pipeline, `globalTaskPool()`'s guarded call sites (`entryPointCount > 1` / >1 pipeline request / OptiX) are never reached, so `rhiDestroyInstance()` has no slang-rhi pool to join. The ~29 teardown threads are lavapipe's own llvmpipe workers, not `s_globalTaskPool`.
- A single **LLDB breakpoint on `rhi::globalTaskPool()` that was never hit** (jvepsalainen-nv) settled it. The bot author conceded: *"this does not fix #12706."* Closed.

**Transferable lesson (the class of signal, not this PR):**
1. **Review COUNT and "0 bugs" carry near-zero bits when a PR's correctness rests on an empirical causal/reachability claim** ("this global/pool/handler is live on path X ⇒ my teardown/ordering fix matters"). N clean reviews that all reason *statically* about a leaked static do not test whether it is *exercised*. Only a runtime reachability check (breakpoint hit, or a test that fails without the change on the actual repro) does.
2. **When the PR author themselves flags the core causal claim as "unproven/not directly proven locally" (here it was in the PR body and Devin echoed it), treat that as a first-class ABSTAIN (OPEN_GAP) trigger** — do not let clean automated reviews round it up. The author's own hedge is the strongest admission that the load-bearing premise is untested.
3. Corollary for the Devin-only tier: Devin summarizing/agreeing with a PR whose premise the author already hedged is not corroboration — it is the same unproven claim restated.

**How to catch it next time (Step-0 recall / Step-3 challenger):** for teardown/threading/ordering/"handle the global" PRs, require a repro-path reachability demonstration; absent it, ABSTAIN regardless of review count. A prior shared learning already named the exact `entryPointCount > 1` guard — Step-0 recall surfaced it and it matched the human's LLDB finding precisely.
