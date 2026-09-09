---
title: "Fixer PR Creation, Fork & CI Mechanics"
type: concept
group: agent-fixer-codex-skills
tags: [fixer, pr-hygiene, push-rights, drafts-only, fork-permissions, ci, tools-gfx, slang-rhi, devin, critique-gate, slang]
source_count: 13
---

# Fixer PR Creation, Fork & CI Mechanics

The mechanics the `nv-slang-bot[bot]` fixer coworker operates under on `shader-slang/slang`: branch/push rights and PR-state hygiene, the `tools/gfx`↔`slang-rhi` twin, fork-PR CI blockers, the Devin done-detector race, and the codex critique gate. Triage classification/routing lives on [Triage Decisions](agent-fixer-triage-decisions.md); dispatch/coordination failure modes on [Fixer Dispatch & Coordination Failure Modes](agent-fixer-dispatch-coordination.md).

## TL;DR

- **Fixer (`nv-slang-bot[bot]`) may push `fix/issue-<n>` direct to origin** (no fork; the CLAUDE.md "fork-only" wording is stale). PRs open as **DRAFT**; never self-flip to ready/merge (operator-gated).
- **Before reverting a non-draft PR state, verify the ACTOR via the timeline API** (`ready_for_review` event `.actor.login`) — revert only a *bot-authored* flip; a human maintainer's deliberate flip is left alone. Current draft state cannot answer this — only the timeline actor can.
- **PR bodies must carry `Closes #N` / `Fixes #N`** to auto-link (prose "also reported in #N" does not). Don't pass `--reviewer`; let CODEOWNERS auto-assign.
- **`tools/gfx/` is legacy code paralleling `external/slang-rhi/`** — grep the twin first; in-tree tests only exercise slang-rhi, so state the coverage limit in the PR.
- **On a fork PR the failing check is rarely the real merge blocker** — check fork permissions (`gh api repos/<fork-owner>/<repo> --jq .permissions`, `maintainerCanModify`) first; if the binding blocker is human-owned and humans are engaged, default to **watch-only**.
- **Off-repo (slang-rhi) triage from the slang-triager container:** anonymous clone works (public), but `GH_TOKEN` may be invalid for writes — report the posting blocker up, don't write with a broken token. Bot cannot push `.github/workflows/*` — deliver as a maintainer-applied patch.
- **Devin done-detector races the AI-analysis render** — the right-rail `Analysis complete` populates before the analysis paragraph hydrates; guard on a non-`Generating...` paragraph.
- **The critique gate keys off delivery markers, not off whether you wrote code** — it blocks even a no-code triage confirmation until PLAN/CODE/OUTPUT review stages are recorded. Satisfy it honestly: write the deliverable to a file, run `/codex-critique` per stage; the parser records STAGE only from a fresh STAGE-tagged `mcp__codex__codex` call and the verdict only from the exact `### Verdict\napprove` block.

## Fixer PR Creation and Push Rights

The fixer authenticated as `nv-slang-bot[bot]` may push `fix/issue-<n>` branches **directly to `origin = shader-slang/slang`** — no fork is required ([slang-fixer can push fix/ branches direct to origin (fork-only rule does not apply)](../learnings/1780685454567-slang-fixer-can-push-fix-branches-direct-to-origin.md)). The older CLAUDE.md "fork-only" wording is stale. An earlier learning ([slang fixer PR push: szihs fork master is stale/divergent (lacks docs/generated framework) → GitHub-App 'workflows permission' rejection; jkwak fork auth fails](../learnings/1780357449295-slang-fixer-pr-push-szihs-fork-master-is-stale-div.md)) documents why the szihs fork path fails: `szihs/master` is far behind `origin/master`, and pushing a branch that spans the gap triggers a GitHub App `workflows` permission rejection when the diff includes `.github/workflows/` files; the diagnostic is `git diff --name-only szihs/master..HEAD | grep '^.github/workflows/'`. The patch fallback (`git format-patch origin/master --stdout`) remains the real-rejection path, not the no-fork default.

All fixer PRs must open as **DRAFT**. Fixers must never self-flip a PR to ready-for-review (`gh pr ready`) or merge it — those remain operator/maintainer-gated ([Fixers must not self-flip PRs to ready — enforce drafts-only](../learnings/1782464090006-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md)). However, before directing a revert of a non-draft state, always verify the *actor* via the timeline API (`ready_for_review` event `.actor.login`) — a human maintainer may have flipped the PR intentionally ([Fixers must not self-flip PRs to ready — enforce drafts-only](../learnings/1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md)). Reverting a maintainer's deliberate decision is a worse breach than the (potentially nonexistent) bot violation. The corrected rule: revert only a **bot-authored** self-flip; leave human-flipped PRs alone. The audit is one call, and **current draft state cannot answer it — only the timeline actor can**: `gh api repos/O/R/issues/<n>/timeline --jq '.[] | select(.event=="ready_for_review" or .event=="convert_to_draft") | "\(.event) actor=\(.actor.login) \(.created_at)"'`. Confirming instance on PR #12281: the actor came back `pdeayton-nv` — a human flipped it, guardrail intact, nothing to revert ([draft-guardrail audit: use the timeline event actor, not current state](../learnings/1785825109539-a-dispatched-handoff-can-silently-die-verify-artif.md)).

PR bodies must include an explicit `Closes #N` / `Fixes #N` closing keyword to auto-link the issue ([Fixer PRs must use a Closes/Fixes #N closing keyword, not a prose issue reference](../learnings/1780562553886-fixer-prs-must-use-a-closes-fixes-n-closing-keywor.md)). Prose mentions like "also reported in #N" do not link. Backfill: `gh api -X PATCH repos/<o>/<r>/pulls/<pr> -f body="$(existing)\n\nCloses #<issue>"`. Do not pass `--reviewer` to `gh pr create`; let CODEOWNERS auto-assign.

## tools/gfx Legacy Code and the slang-rhi Twin

`tools/gfx/` is legacy code that parallels `external/slang-rhi/` ([slang-fixer: tools/gfx/ is legacy code paralleling slang-rhi — fixes need to land in both, but in-tree tests only exercise slang-rhi](../learnings/1778749638138-slang-fixer-tools-gfx-is-legacy-code-paralleling-s.md)). All in-tree tests go through slang-rhi, so a regression test for a `tools/gfx/` bug cannot catch the runtime issue. When fixing a `tools/gfx/` symbol, always grep for the twin in `external/slang-rhi/src/` first — often slang-rhi is already patched and `tools/gfx/` just lags. State this coverage limitation plainly in the PR. A `.slang` compile-only filecheck can guard the language surface, but real runtime coverage requires downstream consumers' CI (e.g. Falcor's gfx integration tests).

## Failing Checks, Fork Permissions, and CI Mechanics

On fork-based PRs, separate the *failing check* from the *actual merge blocker* ([Failing check ≠ real blocker on fork-based PRs (triage to watch-only)](../learnings/1780903795100-failing-check-real-blocker-on-fork-based-prs-triag.md)). Check fork permissions first (`gh api repos/<fork-owner>/<repo> --jq .permissions` and `maintainerCanModify`). If the binding blocker is human-owned AND humans are engaged, default to watch-only.

For off-repo triage of slang-rhi issues from the slang-triager container: anonymous clone works (public repo), but GH_TOKEN may be invalid for write operations ([slang-rhi off-repo triage: anonymous clone works, GH_TOKEN invalid, no GPU](../learnings/1780307950462-slang-rhi-off-repo-triage-anonymous-clone-works-gh.md)). Report the posting blocker to the parent rather than attempting a write with a broken token.

Falcor CI tracking issues opened by `jkiviluoto-nv` are self-assigned CI-infrastructure work, not compiler bugs ([Falcor CI tracking issues from jkiviluoto-nv: park at triaged, cross-link the family](../learnings/1782222346038-falcor-ci-tracking-issues-from-jkiviluoto-nv-park-.md)). Park at triaged; do NOT forward to slang-fixer. Still post a verified 5-bullet (value: cross-linking the Falcor-CI family). The Falcor-CI improvement family: #11495 → #11600 → #9219, #9228, #11703.

The Falcor YML 3-file refactor (#11600) requires build-flag reconciliation — the two existing falcor workflows produce different cmake-flag artifacts ([slang#11600 falcor YML 3-file refactor — triage design notes](../learnings/1781365729972-slang-11600-falcor-yml-3-file-refactor-triage-desi.md)). The required-check aggregator job key must be exactly `check-falcor` (kebab-case), and the dispatcher must add `merge_group: types:[checks_requested]` to avoid deadlocking the merge queue. Bot cannot push `.github/workflows/*` — deliver as maintainer-applied patch.

## Devin Review Done-Detector False Positives

`slang-pr-review-runner`'s `devin-fetch.sh` can declare completion while the middle-pane AI-analysis paragraph still shows `Generating...` ([Devin Review done-detector races AI-analysis text render](../learnings/1779298338813-devin-review-done-detector-false-positives-on-all-.md)). The right-rail `Analysis complete` status and flag toggle populate before the analysis paragraph hydrates. Fix: extend `DONE_EXPR` to check that the "Devin's AI analysis" heading is followed by a non-`Generating...` paragraph. When `devin-flags.md` shows the `## AI Analysis` as "Generating...", recover by driving `agent-browser` to open each flag panel and re-scrape the body text.

## The Critique Gate Fires Even for No-Code Deliveries

The `gate-critique-on-deliver.sh` hook keys off delivery markers (`[Fix Report]`, `[Resolution]`, `[Report]`, `gh pr create`/`gh api .../pulls`), not off whether you wrote code — so it blocks even a NO-CODE triage-confirmation with zero diff until all three stages (PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW, the last = `approve`) are recorded. Satisfy it honestly rather than fighting it: write the deliverable to a file so codex has an artifact, then run `/codex-critique` once per stage — for CODE_REVIEW with no diff, frame it as the scope-shrinkage guard ("confirm zero-diff is correct/complete — did I silently drop an in-scope fix?", pointing codex at `git status --porcelain` + `git diff --stat`) ([Critique gate fires on no-code triage-confirmations too](../learnings/1783523465568-critique-gate-fires-on-no-code-triage-confirmation.md)). The **parser** is exact: it records the STAGE only from a FRESH `mcp__codex__codex` call whose prompt contains a `STAGE: <X>` line, and the VERDICT only when codex returns the skill's exact `### Verdict\napprove` block (free-text "VERDICT: approve" shows "verdicts: none"); a `codex-reply` (round 2/3 of a must-fix) carries no STAGE tag, so to clear a must-fix'd OUTPUT_REVIEW you must fix then issue a NEW STAGE-tagged call, and all codex calls in-container require `sandbox: "danger-full-access"`. This is closely tied to the STEP-0 byte-compare methodology for "did this diff change the emitted/serialized output?" that produces such no-code diagnoses ([STEP-0 byte-compare to decide if a diff changed emitted output; and codex delivery-gate verdict-parsing format](../learnings/1783352556452-step-0-byte-compare-to-decide-if-a-diff-changed-em.md)).

## Contradictions / Supersessions

- The "fixers must not self-flip PRs" rule ([Fixers must not self-flip PRs to ready — enforce drafts-only](../learnings/1782464090006-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md)) was corrected by ([Fixers must not self-flip PRs to ready — enforce drafts-only](../learnings/1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md)): the drafts-only rule stands, but the bot never self-flipped in the confirming instance; a maintainer did — VERIFY THE ACTOR (timeline event, not current state) before directing a revert.

**Source learnings (13):**
- [slang-fixer can push fix/ branches direct to origin](../learnings/1780685454567-slang-fixer-can-push-fix-branches-direct-to-origin.md)
- [slang-fixer PR push: szihs fork master is stale/divergent](../learnings/1780357449295-slang-fixer-pr-push-szihs-fork-master-is-stale-div.md)
- [Fixer PRs must use a Closes/Fixes #N closing keyword](../learnings/1780562553886-fixer-prs-must-use-a-closes-fixes-n-closing-keywor.md)
- [Fixers must not self-flip PRs to ready (original)](../learnings/1782464090006-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md)
- [Fixers must not self-flip PRs to ready (corrected: verify actor)](../learnings/1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md)
- [tools/gfx/ is legacy code paralleling slang-rhi](../learnings/1778749638138-slang-fixer-tools-gfx-is-legacy-code-paralleling-s.md)
- [Failing check ≠ real blocker on fork-based PRs](../learnings/1780903795100-failing-check-real-blocker-on-fork-based-prs-triag.md)
- [slang-rhi off-repo triage: anonymous clone works, GH_TOKEN invalid](../learnings/1780307950462-slang-rhi-off-repo-triage-anonymous-clone-works-gh.md)
- [Falcor CI tracking issues from jkiviluoto-nv: park at triaged](../learnings/1782222346038-falcor-ci-tracking-issues-from-jkiviluoto-nv-park-.md)
- [slang#11600 falcor YML 3-file refactor triage design notes](../learnings/1781365729972-slang-11600-falcor-yml-3-file-refactor-triage-desi.md)
- [Devin Review done-detector false positives](../learnings/1779298338813-devin-review-done-detector-false-positives-on-all-.md)
- [Critique gate fires on no-code triage-confirmations too](../learnings/1783523465568-critique-gate-fires-on-no-code-triage-confirmation.md)
- [STEP-0 byte-compare to decide if a diff changed emitted output; and codex delivery-gate verdict-parsing format](../learnings/1783352556452-step-0-byte-compare-to-decide-if-a-diff-changed-em.md)
_Catalog: [[wiki/index.md]]_
