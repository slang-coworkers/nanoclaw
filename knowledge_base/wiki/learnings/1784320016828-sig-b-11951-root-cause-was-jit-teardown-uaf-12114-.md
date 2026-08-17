---
title: "Sig-B (11951) root cause was JIT-teardown UAF (#12114), not AVX-512 — a real fix-gap can still be mis-attributed"
type: learning
topic: misc
source: learnings/1784320016828-sig-b-11951-root-cause-was-jit-teardown-uaf-12114-.md
---

# Sig-B (11951) root cause was JIT-teardown UAF (#12114), not AVX-512 — a real fix-gap can still be mis-attributed

**The Slang "Sig-B" flake (`static-const-*.slang.3 syn (llvm)` test-server JSON-RPC `waitForResult()/hasMessage()` drop, tracked #11951) is fully resolved as of 2026-07-17. TRUE root cause = a use-after-free in the LLVM JIT teardown, fixed by PR #12114 (`bf7a78ab25f4`, merged 07-15 21:40Z). The earlier AVX-512-SIGILL / `SLANG_DISABLE_AVX512=1` (#12056) attribution was INCIDENTAL, not the fix.**

Two durable lessons:

1. **A real fix-gap can be correctly detected yet wrongly attributed.** We had solid trifecta receipts (export-active + genuine FAILED line + unrelated evicted PR) showing the flake persisted *despite* #12056 — the fix-gap was genuinely real. But the cause we pinned it to (AVX-512 residual) was wrong; the actual cause was a nondeterministic UAF that #12056 happened to partially mask. A nondeterministic teardown UAF manifests intermittently on ordinary (non-`-g`) runs, which is exactly what an intermittent test-server drop looks like. **Lesson: "the flake still fires with the workaround active" proves the workaround isn't the fix — it does NOT prove your named mechanism is the cause.** Keep mechanism claims labeled "unproven" (we did) and defer to the path owner's attribution.

2. **The clean discriminator for "is a flake fixed by PR X" is a tree-ancestry sweep, not a timestamp sweep.** A rerun logged *after* PR X merged does NOT mean the run's tree contained X — a rerun re-runs the same (old) head. Correct method: for each candidate CI run, get `headSha`, then `gh api repos/OWNER/REPO/compare/<fix-sha>...<headSha> --jq .merge_base_commit.sha` — the fix is an ancestor iff merge_base == fix-sha. Then scan `--log-failed` only on the runs that provably CONTAIN the fix. For "did it recur on a fixed master?", enumerate `gh run list --event merge_group` since the merge (those trees contain the fix by construction) and grep their failed logs for the exact fingerprint. Result here: 8 post-#12114 failing merge-group runs, ZERO Sig-B → resolved.

Also: when closing an escalation loop you opened with a wrong-but-honest hypothesis, post a NEW follow-up owning the arc rather than editing history — the reviewer (here jkwak-work, who authored the fix and closed his own repro #12146) sees the correction in context.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784320016828-sig-b-11951-root-cause-was-jit-teardown-uaf-12114-.md`_
