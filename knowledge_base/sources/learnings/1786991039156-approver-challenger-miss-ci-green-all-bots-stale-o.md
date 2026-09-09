---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786989400334-cxstzf
written_at: 2026-08-17T18:23:59.156Z
---

# [approver/challenger-miss] CI-green + all-bots-stale-on-head hides an untested new branch

**Symptom.** shader-slang/slang#12574 (prelink supplies imported interfaces). Fully green CI, author is a MEMBER, clean clauses. Easy to round up to WOULD_APPROVE.

**Root cause of the trap.** Two things conspired to leave the *head commit* unreviewed while looking well-reviewed:
1. The production Claude review (`github-actions[bot]`) workflow run had conclusion=**failure** on the head (posted nothing) — check the "Claude PR Review" run conclusion, not just for a posted review. CodeRabbit was one commit **stale** (reviewed the 5th commit, head was the 6th) AND auto-**paused** ("Reviews paused"). So the visible review chain covered every commit EXCEPT the head.
2. The head commit's specific new code (a cross-module `[COM]`-interface decoration-copy branch in `tryBorrowInterfaceFromOwningModule`, `slang-lower-to-ir.cpp`) is reachable ONLY by importing a `[COM(guid)]` interface across a module boundary. All 9 `[COM(...)]` tests in the suite are single-file → the branch is exercised by NO test. Green CI cannot distinguish a correct COM-copy from a broken one because nothing drives the branch. (Instance of "a success-path test pins nothing.")

**Tell.** The author needed **5 successive corrections to one block** and wrote "'copy the decorations lowering needs' is an open-ended audit with nothing to enforce it." A self-described fragile block + a churn count like that is a flag to check whether a test actually *reaches* it.

**How to catch it.** (a) Resolve the head SHA and confirm which reviewers actually reviewed *the head* — a failed production review + a stale/paused CodeRabbit means the burden is entirely on your own read + Devin; do not treat CI-green as covering head-commit code. (b) For any new gated/borrow branch, grep the test suite for a case that *reaches the branch's trigger* (here: a multi-file test with `import` AND a `[COM(...)]` interface — 0 exist), not just tests that name the feature. (c) Blast radius was real (author-documented: wrong copy aborts the C++ emitter via a 32-char GUID `SLANG_RELEASE_ASSERT` at `slang-emit-cpp.cpp:716`, or silent miscompile) → conservative-lean OPEN_GAP, not a nit.

**Fix / decision.** ABSTAIN_POLICY(OPEN_GAP). No verified 🔴 bug (the head code searches the symbol list for the interface, copies the decoration WITH its GUID operand, asserts it) → not a BLOCK; but an untested reachable branch with real blast radius → a human must add the missing cross-module `[COM]` regression test before merge.
