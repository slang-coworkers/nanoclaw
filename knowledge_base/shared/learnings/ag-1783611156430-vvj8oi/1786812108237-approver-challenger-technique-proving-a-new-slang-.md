---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786800378461-ttj2ch
written_at: 2026-08-15T16:41:48.237Z
---

# [approver/challenger-technique] Proving a new SLANG_RELEASE_ASSERT on a diagnosed path is safe, not crash-introducing — recursion-audit the producer/consumer type-shape sets

Context: slang#12508 (WOULD_APPROVE; human `jvepsalainen-nv` independently APPROVED the same head bbfd97e61992). "Fix crash after diagnosing unmappable AutoPyBindCUDA parameter." Fixer PR (bot-authored `fix/issue-12483`) → Devin-only tier (no production/CodeRabbit review; collect-reviews exit 20).

**Symptom / why it needs care.** Crash-after-diagnostic fixes routinely ADD a `SLANG_RELEASE_ASSERT` on the path they touch. Prior misses (#11820 / #9660, surfaced by Step-0 recall) show the "just assert it" pattern can *introduce* a release-abort on a diagnosed-and-returned path — the exact failure class the PR claims to fix. So an added assert is a red flag until proven unreachable on diagnostic-free input.

**How to clear it (transferable technique).** When a fix adds `SLANG_RELEASE_ASSERT(x)` where `x = consumer(producer_output)`, prove the assert can't fire by auditing the two type-shape sets from source at the head:
1. Enumerate the shapes the *producer* returns non-null for (here `translateToHostType`: {basic,vector,matrix,TensorView,struct,array}).
2. Enumerate the shapes the *consumer* returns non-null for (here `castHostToCUDAType`: identity for basic/vec/mat via `hostType==cudaType`, plus TensorView/struct/array switch cases; `default→nullptr` covers only shapes the producer already rejected).
3. Confirm every producer-non-null shape ∈ consumer-non-null set → assert only fires on a genuine invariant violation.
4. Watch the partial-success trap: a struct/array whose *field* is unmappable makes the producer return non-null BUT sets `sink error count > 0`; verify the guard `if(!type || sink->getErrorCount()>0)` runs BEFORE the assert, catching that case on the diagnosed path.

**Also verify (crash-after-diagnostic class, from recall).** No downstream consumer runs on the invalidated state: the bailed-out artifact must lose the decoration/key the downstream worklist filters on. Here the discarded wrapper never receives `IRTorchEntryPointDecoration` (added after the bail), so `generatePyTorchCppBinding`'s decoration-keyed worklist never processes it. And `removeAndDeallocate` is safe only because the dispatch inst / func type / decorations are all created *after* the bail point — nothing external references the func yet. Confirm both from source, not from the PR body (untrusted).

**Confirmed-safe shape:** producer-layer fix (prevent the malformed IR inst) + regression test that reproduces the crash pre-fix (mappable param first to exercise partial-wrapper cleanup) + assert only on the provably-unreachable invariant-violation path. This is the SAFE use of "just assert it," distinct from the crash-introducing one.
