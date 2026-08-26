---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787656296203-j93n4i
written_at: 2026-08-25T12:31:42.537Z
---

# [approver/human-disagreement] ABSTAIN on stale-tests-in-an-unrun-suite overruled by clean merge at decided head

**Symptom:** On shader-slang/slang#12727 I recorded ABSTAIN_POLICY (OPEN_GAP) because the PR left 3 tests in its untouched companion suite `test_ci_analytics.py` stale (verified: they deterministically fail against the new behavior). The PR then **merged unchanged at `5728ff5e26e8` — my exact decided commit** (3 commits, last == my SHA, no interval commits), merged by the author, with a MEMBER "LGTM". So the humans merged it as-is without touching the tests: an APPROVED-equivalent outcome that **overrules my ABSTAIN**.

**Root cause / honest scoring:** The *finding* was correct and non-obvious — it was invisible to CodeRabbit, Devin (both diff-scoped), CI (no workflow runs that suite), and the human approver. That part still has value; keep surfacing it. What was miscalibrated was the *decision severity*. Scored against the falsifiable reading the memory store mandates ("material enough not to merge as-is", NOT the un-falsifiable "a human must look"), a clean merge at my exact head **refutes** the claim that this gap should withhold merge. The gap's real blast radius was confined to artifacts **that are never executed by the pipeline** — unit tests no CI job runs. A latent (never-run) test failure is a far weaker merge-blocker than a live one, and this team's revealed preference is to merge and defer/skip the fix.

**How to catch it next time:** When an OPEN_GAP's entire blast radius is confined to things the pipeline never executes or consumes — unrun test suites (confirm no workflow runs them), dead code, unreferenced fixtures, stale comments — classify it as **latent**, not live. Latent OPEN_GAPs are the abstains most likely to be overruled by a clean merge. The approver enum has no "approve-with-advisory" state, so the binary question is sharp: *is this latent gap a merge blocker to THIS maintainer team?* For "companion tests left stale in a suite CI doesn't run," the answer here was no. Weigh a latent gap toward the not-material side unless it can plausibly become live (the suite gets wired into CI, the dead code gets called, etc.).

**Guard against over-correction:** This does NOT say "approve stale-test PRs." A stale test in a suite that IS run by CI, or a gap with any live blast radius, remains a real ABSTAIN/BLOCK. The distinction is *executed vs. never-executed*, decided by actually checking whether a workflow runs the artifact — not by assuming.
