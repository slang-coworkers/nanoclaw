---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788199846578-lvd4gr
written_at: 2026-08-31T18:17:43.542Z
---

# [approver/challenger-miss] Devin-only APPROVE can merely echo the PR author's own premise

**PR:** shader-slang/slang#12710 @ 9c97977be549 (Fix #12706: join slang-rhi global task pool at slang-test/test-server teardown). Bot-authored fixer branch `fix/issue-12706`.

**Decision:** ABSTAIN_POLICY (CLAUSE_FAIL:author_trust). The Step-1 author_trust clause (author = nv-slang-bot[bot] = CONTRIBUTOR, not in trusted set) short-circuited before the challenger ran — so this was a *near-miss*, not an actual false-safe.

**Symptom:** On the Devin-only tier (no production `github-actions[bot]` review because production skips fixer/bot branches), Devin returned a clean **APPROVE** with zero bugs/flags. But reading Devin's output, it had simply *reproduced the PR description's own reasoning* almost verbatim ("worker pool unjoined → survives dlclose → heap corruption"), and even flagged its own key premise as "not directly proven locally." Meanwhile a human MEMBER (jvepsalainen-nv) had posted CHANGES_REQUESTED at the *exact same head*, having built it and set an LLDB breakpoint on `rhi::globalTaskPool()` that was **never hit** on the single-entry-point #12706 repro — i.e. the pool the PR claims to fix is not even instantiated on that path (the ~29 threads are lavapipe's llvmpipe workers).

**Root cause:** Devin, run over a PR head, tends to summarize/agree with the PR's own narrative rather than independently falsify it. Its "APPROVE" therefore carries **low bits** whenever the PR's correctness hinges on an *empirical* claim (e.g. "this global/pool is live on this code path"). Clean clauses + Devin-only APPROVE would have produced WOULD_APPROVE had the author been trusted — a false-safe.

**How to catch it:** When the review doc is fallback/Devin-only AND the PR's correctness rests on an empirical liveness/reachability claim, treat Devin agreement as a restatement of the author, not corroboration. The challenger must independently probe reachability: is there evidence (a breakpoint hit, a test that fails without the change on the actual repro) that the targeted state is live on the reported path? If the only evidence is static "this leaked static exists," that does not prove it is exercised. A thread count equal to `hardware_concurrency()` does NOT identify which pool. Absent independent reachability evidence → ABSTAIN (OPEN_GAP), never round Devin's echo up to approve.

**Fix:** For teardown/threading/"join the global pool" PRs specifically, require the fix be tied to a repro-path reachability demonstration; a matching prior learning (slang-rhi global task pool not on single-entry-point repro path) already exists — Step-0 recall surfaced it here and it aligned exactly with the human's finding.
