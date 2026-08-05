---
name: feedback_void_the_execution_claims_keep_the_source_claims
description: "When a verification substrate turns out never to have existed, partition claims into execution vs source before voiding — a blanket retraction has the same unenumerated-scope defect as the original claim"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**2026-08-05, slangpy#1052 / PR #1054.** Late on a long chain the fixer discovered **nothing had ever been built** in the worktree: `ImportError: libsgl.so`, no `.so` under `build/linux-gcc/src/slangpy_ext/`, a configure-only log. So every "built and verified" claim on the chain had been made against an extension that did not exist. The triager's summary: *"every 'built and verified' claim is retroactively void, not merely unconfirmed."*

That is true of the *empirical* claims and **over-reaches on the rest** — and the over-reach is costly, because it sends the executing party to spend a scarce 20-40 min build re-establishing things a build cannot establish anyway.

**The partition that matters:**

| VOID — required a built extension | STANDING — source/forge only, re-checkable now |
|---|---|
| "regression test fails pre-fix / passes post-fix" | main emits `[D,S,V]`, no grad bit (`git show`) |
| "330 passed / 84 skipped / 0 failed" | `requires_grad` only in the extraction struct |
| "both axes × both modes verified" | the 6-file conflict set (`git merge-tree`) |
| suite counts (167 / 13 / 17) | 3 branch-only tests (`comm -23`) |
| "CUDA L40S, torch 2.13.0" | guard pins the bound exactly (`:96-107`) |
| **"codex 3-stage approved"** — approved a *diff*, never an execution | `API_VERSION 8` collision both sides · `#759` `status:"added"` · 7 User-authored commits · out-of-conflict-set literals · `reviewRequests` |

⭐⭐⭐**The root-cause analysis and the entire fix design rested on the STANDING column** — so the plan survived intact and only the confirmations needed redoing. A blanket void would have implied re-deriving the design too.

⭐⭐⭐**A retraction is a claim: an unenumerated blanket void has exactly the defect of the original unenumerated claim.** "Everything is void" *feels* like the conservative, rigorous move, which is why it escapes scrutiny — the same diligence-slot trap as [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]]. Over-retraction is a failure mode, not a safe default.

**How to apply:**
- **When a substrate collapses (no build, wrong branch, stale container, bad instrument), partition before retracting:** which claims *required* the substrate, and which were established by reading source / querying the forge? Publish both columns.
- **Ask of each claim: what instrument produced this?** Anything from `git show` / `gh api` / `grep` survives a build failure. Anything from a test run, a timing, or a runtime observation does not.
- **A code review approving a diff is not evidence the code runs.** Don't let "N critique stages approved" migrate into the execution column — it never belonged there.
- **Scarce-resource corollary:** an over-broad void mis-spends the recovery. Say which claims the rerun must re-establish, so the build isn't burned on claims a build can't settle.

**Companion gap from the same incident:** two sessions in one container share a `build/` directory no matter how cleanly message routing separates them. ⭐⭐**Session isolation is not filesystem isolation** — no messaging rule catches a concurrent-writer collision, and it would bite a single-tier chain equally. Also: a "no build processes running" reading taken between *configure* and *ninja* is a sampling artifact, not evidence of a dead build.

Related: [[feedback_a_true_claim_that_widens_past_its_evidence]] · [[feedback_control_the_instrument_not_the_reasoning]] · [[feedback_a_tools_output_set_is_scoped_to_the_tools_question]] · [[project_slangpy_1052_autograd_cache_grad_bit]].
