---
name: feedback_debounce_approver_dispatch_deterministic_abstain
description: "On synchronize churn, ALWAYS resolve head.sha before dispatching (payload equality is non-diagnostic of redelivery — dispatcher-tier rule); debounce the approver re-run only on an evidenced diff-scope check, never the inbound scan"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5e3b608f-6ffc-40ab-8a3d-baa9d48d0217
---

When a `*-pr-approver` verdict is a **deterministic Step-1 clause short-circuit** — the canonical case is `CLAUSE_FAIL:no_protected_paths` on a PR whose diff is entirely `.github/**` — the ABSTAIN_POLICY outcome is a pure function of diff scope, not of the code. On rapid `pr_ready_for_review (synchronize)` churn, do **not** blindly re-dispatch the full approver+Devin cycle on every push.

**Why:** re-running harvest+Devin+clauses for a provably identical, non-operative (shadow-mode, nothing-posted) result is exactly the churn-burn `[[feedback_debounce_pr_review_on_churn]]` warns against. The human maintainer owns the real review; the ledger re-verifies join-SHA at merge/close, so a one-revision-stale row is caught at the only moment it matters.

**How to apply:** on each synchronize, run one cheap live routing check — `gh api repos/{repo}/pulls/{n}/files --jq '.[].filename'` — NOT a verdict. If the diff is still entirely protected paths → **evidenced hold**, no re-dispatch (this is not a silent no-op; the check confirms the deterministic condition still holds). Re-engage only when (1) the diff **leaves** `.github/**` (adds any non-protected file → genuinely decidable), or (2) merge/close. Validated on slang-rhi#804 (R1/R2/R3 all ABSTAIN_POLICY; held on synchronize #4/#5; PR MERGED @455d3bd0 with independent maintainer approval jkwak-work — class-invariant across all head moves, hold confirmed correct). Companions to expect the same pattern: slangpy#1084, slangpy-samples#57.

**⛔ Corrected 08-04 — the approval did NOT sit on a decided SHA, and this is what makes the hold defensible.** Both the approver's terminal report and my first version of this file implied jkwak-work approved at R3 `8271617af766`. **MINE-VERIFIED via `pulls/804/reviews` `commit_id` (the authoritative field): the APPROVED sits on `878ab52710c41ae24164ba015e4bd9badf014bd7` @21:08** — the merged head, i.e. **exactly the SHA my synchronize-#5 debounce check last verified**, two commits past any decision. R1/R2/R3 `commit_id`s carry only CodeRabbit `COMMENTED` rows.
⇒ ⭐⭐**This STRENGTHENS the debounce rather than excusing it: human review coverage ⊇ the approver's decided scope.** The two revisions I held on (`bc3d911`, `878ab527` — the latter adding `pr-sweep-nightly.yml`) were never left unreviewed; a maintainer inspected the complete head, including the caller no approver decision ever covered. The hold didn't create a coverage gap — the human loop the ABSTAIN routes to closed it.
⭐**Timing adjacency BOUNDS coverage; `commit_id` IDENTIFIES it.** The approver reached the right conclusion from commit-date comparison alone because its `reviews` endpoint was hook-blocked, and correctly flagged the SHA as "could not verify by that method" rather than asserting it. That gap was mine to close — cf. [[project_critique_gate_pulls_pattern_builtin_floor]] (the gate is **opt-in/edge-scoped**; the endpoint is unblocked from Main) and the standing rule that **the tier which can read the field owes it to the tier that can't**.

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

✅**APPLIED AS WRITTEN, 08-05, nanoclaw#1075 — the dispatcher-tier rule fired at the dispatcher seat and worked.** Byte-identical second `pr_ready_for_review (opened)` on a PR I had just reviewed. Ran recipe step 1 instead of comparing payloads: head unchanged `b3bcd59f`, `merged_at` unchanged ⇒ genuine redelivery, dropped; plus the inbound scan (comments = my own bot comment only, `reviews` = empty). ⭐⭐**New trap this case exposed: `updated_at` HAD advanced (07:02:10Z → 07:05:11Z) and the mover was MY OWN comment.** A freshening `updated_at` is the natural thing to reach for and it reads as external activity ⇒ **subtract your own writes before treating a timestamp as an inbound; the discriminators are `head.sha` + comment AUTHOR, never `updated_at`.** Same shape as this file's core lesson — a signal that cannot distinguish the states you care about (my write vs. theirs) is worthless. ⭐**Both payloads carried `reason: opened`, not `synchronize`, so this recipe generalizes past synchronize churn to ANY repeat webhook.**

Also note a terse `CHANGES_REQUESTED` may be a **capability** ask, not an edit list ([[feedback_changes_requested_read_body]]): "Needs testing" with 0 inline comments and the tests already written+enabled means *nobody in our reach can execute them* — escalate for hardware, don't dispatch a fixer to write code that already exists.

## ⛔ The duplicate-vs-advance check belongs to the DISPATCHER, not only the approver (08-04, slang#12344 — MINE, I got this wrong)

Recipe step 1 above already says: *"If unchanged ⇒ duplicate webhook, drop. If moved, it is NOT a duplicate — do not hand-wave it as one."* **I hand-waved it.** Two `pr_ready_for_review (synchronize)` webhooks arrived for #12344; I compared the two **payloads**, saw identical `reason`/`title`/`author`, and dispatched a nudge saying *"likely a duplicate delivery."* The approver re-probed and refuted me: head had moved `f8bfa0cb98d8` → `fb5bfdab71c1` (a 5th commit pushed 16:18:54Z, mid-run). **Verified independently: `compare/f8bfa0cb98d8...fb5bfdab71c1` → ahead_by 1, 6 files.**

⭐⭐⭐**The webhook payload carries NO head sha ⇒ payload equality is non-diagnostic of redelivery.** Two identical payloads are exactly what a *new push* produces, because every field that varies between pushes (`reason`, `title`, `author`, `pr_url`) is invariant across them. I read "identical payload" as evidence of sameness when it was evidence of *nothing* — the fields I compared could not have differed even in the case I was ruling out. Same shape as the standing rule that **a signal which can't distinguish the states you care about is worthless**; the tell was available for free (one `GET pulls/{n}` → `head.sha`).

⭐⭐**Why the tier matters: the rule existed but was scoped to the approver, so it never fired at my seat.** This file is indexed as "approver-never-posts & debounce" — it reads as an *approver* concern, and I am the *dispatcher*. The duplicate/advance discrimination is one API call and it belongs **before dispatch**, because the dispatcher is the tier that can cheaply hand-wave it and the only tier whose hand-wave becomes an *instruction*. ⇒ **On any second webhook for a PR already in flight: `GET pulls/{n}` → `head.sha`, compare to the sha you dispatched against, and state the sha — never the inference.**

⭐⭐⭐**A dispatcher's guess arrives at the downstream tier as a directive.** My "likely a duplicate" cost the approver a defensive re-probe it had to spend budget on to overcome, and had it deferred to me it would have recorded a ledger row keyed to a superseded sha. ⇒ **when relaying a hunch downstream, mark it as a hunch and name the check that would settle it** — cf. [[feedback_a_correct_action_does_not_validate_its_rationale]] (the no-op is identical whether the rationale is sound; here the *harm* was that the rationale travelled). The approver's independent re-probe is what made this recoverable — **it correctly treated my framing as a claim, not a fact.**

⚠️**Second-order trap found the same turn: a `docs/`-prefix scope read is NOT a docs-only finding.** #12344's diff is 124 files entirely under `docs/generated/**`, which invites a `no_protected_paths` short-circuit — but two of them are `_meta/regenerate.py` (**+73/-3** design tree, **+244/-4** tests tree = **+317/-7 of executable Python**, incl. a new markdown-table linter and a rewritten `_split_md_row` escape handler). ⇒ **Filter the file list by EXTENSION, not by top-level directory, before calling a diff non-operative** — a plausible mechanism is not a containment check.

## 08-10, slangpy#1098 — **a `+1-1` one-file diff that was OPERATIVE.** Expand submodule pointers before judging a delta

Third synchronize on #1098. Decided head `15f687920306` → current `f51ef4fa1589`. The compare API
reports the *entire* delta as **one commit, one file, `modified +1-1 external/slang-rhi`** — the
exact shape my debounce rule has always read as "non-operative, hold". **It was not.**

```
gh api repos/shader-slang/slangpy/compare/15f687920306...f51ef4fa1589 --jq '.files[].patch'
  -Subproject commit f8460cca0ef5e85e034520f9598eeb0af8d84d2b
  +Subproject commit 46a66b47123336aed8d040d5a6b19810432d5dd5
gh api repos/shader-slang/slang-rhi/compare/f8460cca0ef5...46a66b471233
  → ahead_by 1: "Enable parallel CUDA ray-tracing pipeline creation (#826)"
    src/cuda/cuda-device.h +2-6 · src/vulkan/vk-backend.cpp +43-14 · vk-backend.h +7-0
    tests/test-parallel-pipeline-creation.cpp +82-0   (new: initTaskPool(1) + TaskPoolReset)
```

⇒ ⭐⭐⭐**A submodule bump renders as `+1-1` in ONE file and can carry unbounded change. Line-count
and file-count are structurally blind to it** — the two cheap signals my debounce leans on both say
"cosmetic". The additions/deletions field is measuring the *pointer*, not the *content*.
⇒ **Rule: if a delta's file list contains a gitlink (`external/**`, or any path whose patch body is
`Subproject commit …`), the delta is UNKNOWN until you compare the sub-repo range. Never hold on it.**

**Why it was operative here specifically** (the test my methodology demands): #1098's abstain was
`OPEN_GAP` — the nanothread adapter is installed **process-wide** and its callback-side
`waitAndReleaseTaskGroup` is unverified against the `ITaskPool` contract, *blast radius = all of
slang-rhi*. The bump **adds a new task-pool client inside that blast radius**
(`canCreatePipelineOnTaskPool`, parallel pipeline creation) and a new test that drives
`initTaskPool`. So the delta moves the very surface the abstain was about — and it also **moves the
contract commit the prior decision cited** (`f8460cca`, quoted in the decision as the source of the
"safe when called from a task callback" blessing). ⇒ re-dispatch, not hold.

⚠️**Second finding from the same check — the new head has ZERO bot coverage.** CodeRabbit's only
review (`COMMENTED`) carries `commit_id=15f687920306`, i.e. the **old** head; the `CodeRabbit` check
showing `pass / Review completed` is the *stale* run. `pulls/1098/reviews` → 1 row, bot, old sha; no
human review, no `CHANGES_REQUESTED`. The sole human-authored comment (`jhelferty-nv`) is an
automated board-sync assignment notice marked *"do not reply"* — **not** a routing inbound.
⇒ ⭐⭐**A green "review completed" check is not a statement about the current head** — same class as
the standing rule that a passing suite may never have run the thing you care about. Read
`reviews[].commit_id`, never the check name.
