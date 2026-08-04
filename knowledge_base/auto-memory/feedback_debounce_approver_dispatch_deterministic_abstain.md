---
name: feedback_debounce_approver_dispatch_deterministic_abstain
description: "On synchronize churn of a protected-path-only PR, debounce approver re-dispatch with a cheap diff-scope check instead of a full re-run"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5e3b608f-6ffc-40ab-8a3d-baa9d48d0217
---

When a `*-pr-approver` verdict is a **deterministic Step-1 clause short-circuit** — the canonical case is `CLAUSE_FAIL:no_protected_paths` on a PR whose diff is entirely `.github/**` — the ABSTAIN_POLICY outcome is a pure function of diff scope, not of the code. On rapid `pr_ready_for_review (synchronize)` churn, do **not** blindly re-dispatch the full approver+Devin cycle on every push.

**Why:** re-running harvest+Devin+clauses for a provably identical, non-operative (shadow-mode, nothing-posted) result is exactly the churn-burn `[[feedback_debounce_pr_review_on_churn]]` warns against. The human maintainer owns the real review; the ledger re-verifies join-SHA at merge/close, so a one-revision-stale row is caught at the only moment it matters.

**How to apply:** on each synchronize, run one cheap live routing check — `gh api repos/{repo}/pulls/{n}/files --jq '.[].filename'` — NOT a verdict. If the diff is still entirely protected paths → **evidenced hold**, no re-dispatch (this is not a silent no-op; the check confirms the deterministic condition still holds). Re-engage only when (1) the diff **leaves** `.github/**` (adds any non-protected file → genuinely decidable), or (2) merge/close. Validated on slang-rhi#804 (R1/R2/R3 all ABSTAIN_POLICY; held on synchronize #4/#5; PR MERGED @455d3bd0 with independent maintainer approval jkwak-work — class-invariant across all head moves, hold confirmed correct). Companions to expect the same pattern: slangpy#1084, slangpy-samples#57.

**Generalizes past the `no_protected_paths` clause (08-03, slang-rhi#802).** The rule is really: *debounce when the synchronize delta cannot touch the premises the verdict rested on.* #802's ABSTAIN was `OPEN_GAP` (Metal tests SKIPPED on the paravirtual `macos-latest` runner ⇒ zero execution coverage), not a clause short-circuit — yet the same cheap check settled it. Recipe that worked, all unauthenticated `curl api.github.com` (no `gh` needed):
1. `pulls/802` → head SHA. **If unchanged ⇒ duplicate webhook, drop.** If moved, it is NOT a duplicate — do not hand-wave it as one.
2. `compare/<decided-sha>...<new-head>` → `files[]`. Filter to those **outside** the paths the verdict reasoned about. NONE ⇒ reviewed code byte-identical.
3. Re-check the *gap-specific* premise, not just diff scope: for a coverage gap that meant grepping `ci.yml` at the **new head** for `runs-on`/`macos`/`self-hosted` — a green run or a new workflow file is not coverage; only a **runner** change would be.
4. `commits/<sha>` → who pushed. Here it was **skallweitNV** (the added human reviewer) clicking web-flow "Update branch" — a *human-engagement* signal, not fixer churn. Worth noting upstream; still not a reason to re-run.

**Why it matters:** a moved head is the tempting case to re-dispatch reflexively, and "green CI on the new SHA" is the tempting reason to flip to approve. Both premises must be re-tested *individually* — cf. the standing lesson that a signal which can't distinguish the states you care about is worthless. Two cheap API calls replaced a full harvest+Devin+challenger cycle.

**The debounce check must also scan for non-push inbounds — this is its real load-bearing job (08-03, #802 sync 3).** Head moved again; delta was again non-operative (a maintainer's own merged workaround PR arriving via `Merge branch 'main'`, hunks provably non-overlapping with the PR's). But sitting in the same window, invisible to any diff-only check, was **skallweitNV's `CHANGES_REQUESTED` review**. A pure diff-scope debounce would have held silently and buried a human blocker. So: **on every synchronize, also `GET pulls/{n}/reviews` and check for new non-bot reviews.** Debounce the *approver re-run*, never the *inbound scan*.

Two lessons that generalize:
- **State the resume conditions, then honor them as tripwires.** I'd written "re-engage on a push touching `src/metal/**` or `tests/**`". Sync 3 hit exactly that, so I inspected instead of pattern-matching "third identical webhook → hold". The named tripwire is what surfaced the review. A debounce rule without explicit, checkable resume conditions degrades into a silent no-op.
- **A human reviewer independently reaching the approver's conclusion is a precision datapoint worth recording.** The approver held `OPEN_GAP` (Metal tests skipped ⇒ zero execution coverage) where a reviewer's APPROVE_WITH_NITS had said "source looks right"; the Metal maintainer then filed CHANGES_REQUESTED / "Needs testing" from the same premise. Evidence that abstaining on a coverage gap is calibrated, not timid — cf. [[feedback_green_job_skipped_backend_zero_coverage]].

Also note a terse `CHANGES_REQUESTED` may be a **capability** ask, not an edit list ([[feedback_changes_requested_read_body]]): "Needs testing" with 0 inline comments and the tests already written+enabled means *nobody in our reach can execute them* — escalate for hardware, don't dispatch a fixer to write code that already exists.
