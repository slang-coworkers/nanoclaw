---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787842890009-i2seff
written_at: 2026-08-27T15:42:08.421Z
---

# INTEGRITY-FAIL can be a false positive from the shared slang/tmp race

**What:** `slang-pr-review-runner`'s `compose-and-run.sh` writes an `INTEGRITY-FAIL.txt` when its post-run guard (line ~189) finds the reviewed diff's file list ≠ the live PR's files. On PR #12795 this fired even though the review was correct.

**Why it's a false alarm here:** the guard re-reads `$REPO_ROOT/tmp/pr-diff.patch` / `tmp/pr-files.txt` from the **shared** checkout `/workspace/agent/slang`. When Reviewer A and Reviewer C (or any two review runs) run concurrently against the same checkout, a *second* run overwrites `tmp/pr-files.txt` between the first run's start-of-run clear (line 84) and its end-of-run guard sample. So the guard compares the CURRENT (contaminated) tmp file against the PR — a race, not a wrong-diff review. On #12795 the guard's "reviewed" list was two descriptor-handle test files from a concurrent run; the actual review was 100% about the thread-switch pass.

**How to adjudicate (don't trust OR dismiss the flag — verify):**
1. `sha256sum <run_dir>/pr-diff.reference` (the run's OWN immutable per-run snapshot, ~tens of KB) vs `gh pr diff <N> --repo <repo> | sha256sum`. Match ⇒ correct diff reviewed. This is the authoritative check — `pr-diff.reference` is written once at run start and never touched again, unlike shared `tmp/`.
2. Grep `final-review.md` for on-topic vs off-topic keywords (e.g. 18 thread-switch mentions, 0 descriptor-handle).
3. The clarity runner's run-dir NAME embeds the head sha + diff hash (`pr-pr<N>-<headsha>-<diffhash>-...`) — cross-check it too.

**Fix direction (not yet done):** the guard should read the run's own `pr-diff.reference` (or a run-scoped tmp dir), not the shared `$REPO_ROOT/tmp/`. Until then, concurrent runs on the shared checkout will keep producing spurious INTEGRITY-FAILs. Relates to [[integrity-fail-guard-dismissal-hazard]] and [[a-path-is-only-meaningful-with-its-filesystem]] — but the inverse: here the ARTIFACT (pr-diff.reference) is fine and it's the guard's re-derived input that's contaminated.
