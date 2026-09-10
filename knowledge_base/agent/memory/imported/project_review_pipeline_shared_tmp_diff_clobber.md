---
name: project_review_pipeline_shared_tmp_diff_clobber
description: "PR-review pipeline writes a SHARED tmp/pr-diff.patch — concurrent runs clobber it, causing INTEGRITY-FAIL false positives AND reviewers silently reviewing the wrong PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e0c2f28-dbc4-48a8-9626-3014cc4b7802
---

# Review pipeline: shared `tmp/pr-diff.patch` clobbered by concurrent runs

**Defect:** the PR-review pipeline stages the diff at a **shared, non-run-scoped path** (`tmp/pr-diff.patch`). When two PR reviews run concurrently, the second overwrites the first's file mid-run.

**Observed 2026-08-04 on slang#12269** (5th+ occurrence per slang-reviewer):
- **LOUD symptom:** the run's integrity guard tripped `INTEGRITY-FAIL` — it diffs the shared file, which by then listed `slang-compiler-options.cpp` + `unit-test-stdin-compile.cpp` (a *different* PR). **Adjudicated FALSE POSITIVE:** the run's own captured `pr-diff.reference` held exactly the two real #12269 files, and its footer pinned head `90b471ce5a` / `diff sha256 d2a5b8f014be` == live head.
- **SILENT symptom, same root cause:** `code-quality-reviewer` **reviewed the wrong PR (#12271, `buildHash`/`intValue2`)** while believing it had read the correct diff. Output was unusable; the dimension had to be covered first-hand.

⭐⭐⭐**ONE ROOT CAUSE, TWO FAILURE SHAPES — and the loud one trains you to dismiss the guard exactly when it is also producing wrong output.** After N adjudicated false positives, `INTEGRITY-FAIL` reads as noise; but in this run it was *correctly detecting* real cross-contamination that had already corrupted a reviewer's output. **A guard whose true positives look identical to its false positives is worse than no guard** — the dismissal habit is the damage. Family: [[feedback_a_guard_can_be_inert_and_read_as_passing]].

**How to tell a false positive from a real one:** don't compare against the shared file. Compare the run's **own captured reference** (`pr-diff.reference`) and the **footer-pinned head + diff hash** against live head. If those match the PR under review, the guard's complaint is about the shared file, not your diff.

**Fix (in operator queue):** **worktree-per-run isolation** — give each review run its own scoped tmp/worktree so no two runs share a diff path. This incident is additional evidence for that proposal. Interim mitigation: scope the diff filename by PR number + head sha.

## ✅ MAIN-VERIFIED BY SOURCE READ (08-04) — reviewer's fix location confirmed, plus a finding it didn't have

Read `compose-and-run.sh` in my own container (`/home/node/.claude/skills/slang-pr-review-runner/scripts/`; upstream-synced from `shader-slang/slang-skills` ⇒ **the path is per-container, the mechanism transfers**). Reviewer's claim is **correct**:
- **`RUN_DIR` is ALREADY per-run** — `RUN_DIR="$SKILL_DIR/transcripts/${MODE}-${TS}"` (:123-124), and `pr-diff.reference` is already staged there (:142). So the per-run infrastructure exists; only the clobbered artifacts sit outside it.
- **The guard reads the SHARED path** — `if [ "$MODE" = "pr" ] && [ -f "$REPO_ROOT/tmp/pr-diff.patch" ]` (:188-193). Moving that staging to `$RUN_DIR` removes both failure modes at once, exactly as the reviewer said. Small, contained change.
- ⚠️**BROADER THAN pr-diff.patch:** `pr-files.txt` **and `context.json`** share the same exposure (`context.json` written to `$REPO_ROOT/tmp/` at :145, and `MARK="$REPO_ROOT/tmp/context.json"` at :154). A fix that moves only `pr-diff.patch` leaves two artifacts clobberable. Reviewer named one file; the defect covers three.
- ⚠️**Guard is CONDITIONAL on the file existing** (:188) ⇒ if the model never materializes `pr-diff.patch`, the integrity check **does not run at all** — silent no-coverage, not a pass. Family: [[feedback_a_guard_can_be_inert_and_read_as_passing]].

⭐⭐⭐**THE KEEPER — A PRIOR FIX FOR THIS EXACT DEFECT CLASS WAS MADE AT THE WRONG LAYER, WHICH IS WHY IT RECURRED.** Lines :78-84 document an earlier instance — **PR #11455 reviewed as #11443** — and its fix was `rm -f "$REPO_ROOT/tmp/pr-diff.patch" …` *before* the run, with the reasoning "worst case is an empty read that falls back to a live `gh pr diff`, never a wrong diff." **That defeats SEQUENTIAL staleness (leftover from a prior run) and is structurally incapable of defeating CONCURRENT clobber** — a pre-run `rm` does nothing about a sibling run writing the shared path *while this run is in flight*. So the recurrence to 5+ isn't bad luck; the mitigation addressed *staleness* when the defect is *sharing*. ⇒ **When a fix for a recurring defect keeps failing, check whether it targets the right mechanism before making it stricter — and note the in-code comment's confident "never a wrong diff" was FALSIFIED by this very run.** Per-run isolation is the layer; clearing-before never could be.

## The `context.json` marker is NEAR-VACUOUS as integrity coverage (reviewer-found, Main source-verified 08-04)

⚠️**Do NOT cite the `context.json` marker check as existing protection that merely needs relocating.** Verified at `:145-160`: the marker is written from `$REPO`/`$PR_NUMBER` (:145-148) and then compared **against those same shell variables** (:156-158). Both sides of the comparison come from one source ⇒ it can only catch a clobber landing in the narrow write→read window, and **can never catch a wrong-PR diff**. (Its own comment at `:152` — "verify the freshly written marker matches the requested PR" — describes a race check accurately; the error is anyone reading it as *diff* integrity.)

⭐⭐⭐**COLLECTED-BUT-NEVER-READ — and it's 4 pieces of evidence, not 1** (my finding, widened by reviewer, both Main-verified by `grep` over all call sites 08-04). `read_marker` is called **only** with `repo` and `pr` (`:156`, `:158`). **`base_sha`, `head_sha`, AND `diff_sha256` are written at `:148` and never read back anywhere in the script**; `pr-diff.reference` is never consumed after being hashed at `:143-144`. So the script collects four pieces of PR-derived evidence and compares **none** of them. (`DIFF_SHA256` at `:143-144` hashes a live `gh pr diff` ⇒ genuinely PR-derived, unlike the shell vars.)

🔴**MY PRESCRIPTION WAS WRONG — reviewer caught it, Main-verified.** I proposed "assert `diff_sha256` in that same `:156` conditional." **That would have been self-comparison again:** inside `:156` the only thing available to compare against is `$DIFF_SHA256`, the very shell var the marker was written from at `:145`. It would read as fixed while proving nothing — *the exact failure this file documents*, reintroduced by the fix for it. ✅**CORRECT FIX (reviewer's): assert `diff_sha256` in the POST-RUN guard at `:188`** — re-derive the hash of the diff the model actually used and compare against the recorded value. Genuinely independent producer-vs-consumer, on data already collected. **Bonus hole it closes:** `:189-193` compares only the **file list**, so a contaminated diff with a coincidentally-matching file set passes today.

⭐⭐⭐**TAXONOMY — two shapes, and the obvious fix for one lands as the other:**
- **Shape 3 — collected-but-never-read:** the guard *has* independent evidence and never compares it (marker's `diff_sha256`).
- **Shape 4 — self-comparison:** the guard compares evidence that *cannot disagree*, because both sides derive from one source (marker `repo`/`pr` vs. the shell vars it was written from).
⛔**The trap: the natural fix for shape 3 lands as shape 4** — you reach for the unread field and assert it at the nearest site, which is usually still inside the producer's scope. **The single test that catches both: NAME THE TWO INDEPENDENT SOURCES BEING COMPARED. If you cannot name two, the guard proves nothing.** Sits alongside inert-guard (never armed) and bad-matcher. Family: [[feedback_a_guard_can_be_inert_and_read_as_passing]].
⭐⭐**Meta, on me:** I published this prescription in the same message where I named shape 3 as a new failure mode — *the diligence slot again*. A correction arrives carrying authority, so it is audited least, exactly when the writer's confidence peaks. Cf [[feedback_control_the_instrument_not_the_reasoning]] (errors cluster in corrections).

**Proposal path:** the script is upstream-synced from `shader-slang/slang-skills` ⇒ needs a **proposal PR, not a local edit**. Reviewer correctly did not touch it. **Lead with the wrong-layer history (why per-run isolation is the layer and clearing-before cannot be salvaged), dismissal-hazard second.** Scope: all 3 artifacts → `$RUN_DIR`; make the integrity check unconditional (`:188` gates on the file existing ⇒ silence is ambiguous); **assert `diff_sha256` in the POST-RUN guard at `:188` against a RE-DERIVED hash — NOT in the `:156` pre-dispatch conditional** (that would be self-comparison; see the 🔴 above).

**Verified clean in the same run:** drift = 0 for both reviewers (zero GitHub-write tool calls in either `tool-uses.jsonl`) — the clobber corrupts *inputs*, it did not cause stray writes.

Chains touched: [[project_12266_defer_bare_decl_scope_leak_crash]] (#12269).
