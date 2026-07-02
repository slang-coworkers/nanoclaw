---
title: "Fixer & Triage Automation"
type: concept
group: agent-fixer-codex-skills
tags: [fixer, triage, github, pr-hygiene, slang, ci, bot-policy]
source_count: 33
---

# Fixer & Triage Automation

Operational rules, guard-rails, and discovered failure modes for the `nv-slang-bot[bot]`-powered fixer and triage coworkers on the `shader-slang/slang` repo. Covers PR creation and push rights, GitHub artifact policy, root-cause verification discipline, and CI/fork-specific traps.

## Fixer PR Creation and Push Rights

The fixer authenticated as `nv-slang-bot[bot]` may push `fix/issue-<n>` branches **directly to `origin = shader-slang/slang`** — no fork is required ([[wiki/learnings/1780685454567-slang-fixer-can-push-fix-branches-direct-to-origin.md]]). The older CLAUDE.md "fork-only" wording is stale. An earlier learning ([[wiki/learnings/1780357449295-slang-fixer-pr-push-szihs-fork-master-is-stale-div.md]]) documents why the szihs fork path fails: `szihs/master` is far behind `origin/master`, and pushing a branch that spans the gap triggers a GitHub App `workflows` permission rejection when the diff includes `.github/workflows/` files; the diagnostic is `git diff --name-only szihs/master..HEAD | grep '^.github/workflows/'`. The patch fallback (`git format-patch origin/master --stdout`) remains the real-rejection path, not the no-fork default.

All fixer PRs must open as **DRAFT**. Fixers must never self-flip a PR to ready-for-review (`gh pr ready`) or merge it — those remain operator/maintainer-gated ([[wiki/learnings/1782464090006-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md]]). However, before directing a revert of a non-draft state, always verify the *actor* via the timeline API (`ready_for_review` event `.actor.login`) — a human maintainer may have flipped the PR intentionally ([[wiki/learnings/1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md]]). Reverting a maintainer's deliberate decision is a worse breach than the (potentially nonexistent) bot violation. The corrected rule: revert only a **bot-authored** self-flip; leave human-flipped PRs alone.

PR bodies must include an explicit `Closes #N` / `Fixes #N` closing keyword to auto-link the issue ([[wiki/learnings/1780562553886-fixer-prs-must-use-a-closes-fixes-n-closing-keywor.md]]). Prose mentions like "also reported in #N" do not link. Backfill: `gh api -X PATCH repos/<o>/<r>/pulls/<pr> -f body="$(existing)\n\nCloses #<issue>"`. Do not pass `--reviewer` to `gh pr create`; let CODEOWNERS auto-assign.

## tools/gfx Legacy Code and the slang-rhi Twin

`tools/gfx/` is legacy code that parallels `external/slang-rhi/` ([[wiki/learnings/1778749638138-slang-fixer-tools-gfx-is-legacy-code-paralleling-s.md]]). All in-tree tests go through slang-rhi, so a regression test for a `tools/gfx/` bug cannot catch the runtime issue. When fixing a `tools/gfx/` symbol, always grep for the twin in `external/slang-rhi/src/` first — often slang-rhi is already patched and `tools/gfx/` just lags. State this coverage limitation plainly in the PR. A `.slang` compile-only filecheck can guard the language surface, but real runtime coverage requires downstream consumers' CI (e.g. Falcor's gfx integration tests).

## GitHub Artifact Posting Policy

The canonical rule: post a verified 5-bullet issue comment on **every triaged issue** on the bot's own authority ([[wiki/learnings/1781137483321-superseded-skip-github-post-on-dev-authored-design.md]], [[wiki/learnings/1781008579138-slang-triage-labeling-issue-type-and-reproducer-re.md]]). Superseded exceptions:

- **Fixed-via-PR exception** ([[wiki/learnings/1780769170857-triage-github-artifact-fixed-via-pr-exception-reso.md]]): when a non-draft PR already carries `Closes #N`, the PR *is* the artifact; triage need not duplicate it. A draft PR does NOT qualify — still post the issue comment.
- **Maintainer RFC stand-down** ([[wiki/learnings/1781266520028-triage-when-to-post-a-5-bullet-vs-stand-down-on-a-.md]]): if it is the maintainer's own roadmap RFC (no bot mention, maintainer already driving a fix PR), AND there is no novel triage value to add → STAND DOWN (A2A disposition only; no issue comment). Otherwise post a deferential artifact.
- **Dev-authored design/tracking issues** ([[wiki/learnings/1781137483321-superseded-skip-github-post-on-dev-authored-design.md]]): post anyway, but frame it as triage INPUT (solution-space mapping, not a verdict), defer the decision to the design owner, and do NOT forward to fixer.

**Interim verdict timing**: hold a classification 5-bullet ("fix incoming") until the chain reaches a terminal state; a bot comment that needs retraction costs credibility ([[wiki/learnings/1781116432142-hold-interim-triage-classification-5-bullet-until-.md]]). Carve-out: author-facing scoping questions and missing-reproducer requests may post pre-terminal.

**Double-post prevention**: before posting any triage/resolution comment, check the last comment — `gh api repos/<owner>/<repo>/issues/<N>/comments --jq '.[-1] | "\(.user.login)\t\(.id)"'`. If `nv-slang-bot[bot]` already posted the current verdict, do NOT re-post ([[wiki/learnings/1780768870271-check-for-existing-bot-comment-before-posting-gith.md]]). "Always post" and "don't duplicate" are reconciled by *check-then-act*.

**Labeling and Issue Type** ([[wiki/learnings/1781008579138-slang-triage-labeling-issue-type-and-reproducer-re.md]]): apply `reproduced` only after reproducing on top-of-tree; if GPU/platform-dependent, skip both labels and note the limitation. Set Issue Type via GraphQL `updateIssue` — slang IDs: `Bug = IT_kwDOAb2kZs4AXYkt`, `Feature = IT_kwDOAb2kZs4AXYkw`. Human triage is authoritative — never change/remove a label a human set.

## Root-Cause Verification Discipline

Before implementing a fix, empirically confirm the root cause ([[wiki/learnings/1781724696064-verify-triage-root-cause-empirically-slang-10027-v.md]]). A detailed, plausible triage trace can name the wrong inst or decl — especially for `InternalError: Generic type/value shouldn't be handled here!` aborts. The slang#10027 case: triage claimed a vector element *count* deserialized as `DeclRefIntVal(N)`, but an actual Debug backtrace showed the abort was on the element *type* param `T` from two un-reconciled copies of the synthesized `vector<T,4>` extension generic across the module boundary.

When a code-reader subagent hedges a hypothesis ("most likely", "NOT pinned down", "must be confirmed empirically"), carry that hedge verbatim into the public verdict — label it "leading hypothesis (unconfirmed)", never "root cause (traced)" ([[wiki/learnings/1781724956224-don-t-promote-a-hedged-hypothesis-to-root-cause-tr.md]]). The abort *mechanism* and guard line may be verified while the upstream *cause* remains a guess; split these in the public comment.

For parser-ambiguity triage involving "two-pass / pre-scan / decl-discovery" approaches, verify the **discovery step** separately from the resolution step ([[wiki/learnings/1780064743810-verify-discovery-and-resolution-separately-in-pars.md]]). The circularity often hides in the discovery pass: if the ambiguity is on member access (`Outer<…>.member<…>`), a top-level decl-name scan cannot resolve it without descending into bodies, which requires skipping `<…>` lists — the same problem at a different layer.

Before implementing, scan `/workspace/shared/learnings/INDEX.md` for prior triager rulings on the issue cluster ([[wiki/learnings/1781775592867-a-fresh-unblock-handoff-can-contradict-a-prior-tri.md]]). A "fresh unblock" handoff may contradict an earlier evidence-backed ruling about which slice owns a check. A test re-expression added solely to dodge a new check is a "do not mask" smell — stop and verify.

DeepWiki and same-day triage memos can describe an older codebase state ([[wiki/learnings/1782408832985-triage-deepwiki-concurrency-premises-can-lag-head-.md]]). On concurrency/thread-safety work, always `grep -rn` actual lock-acquisition sites at HEAD before accepting any "component X is unsynchronized" framing.

Triage memos verify the defect site deeply but cite surrounding code more loosely ([[wiki/learnings/1782390307922-verify-triage-memo-file-line-claims-about-adjacent.md]]). Before quoting any file:line claim about *adjacent* code (alternative-approach blast radius, "other callers do X") in a commit/PR/comment, grep/read it yourself.

## Severity Triage: Pointer-Formation UB Is Not Always a Realized Crash

When triaging a "memory-safety / UB pointer arithmetic" bug, distinguish **pointer formation** from **pointer dereference**. Forming a pointer more than one-past-the-end (e.g. `cur + 6 <= end` when fewer than 6 bytes remain) is UB per C++ `[expr.add]` and `-fsanitize=pointer-overflow` will flag it — but if that pointer is only *compared*, never *dereferenced*, there is no actual OOB read/write and no crash on mainstream flat-memory ISAs. Check whether the subsequent dereferences are short-circuit-guarded behind the bounds check (`&&` ordering); if they are, the realized severity is "latent UB / UBSan finding" (typically P2), NOT "crash/OOB" (P1). On slang #11864, `JSONStringEscapeHandler::appendUnescaped` formed `cur+6`/`cur+4` past-end pointers but all `cur[0]`/`_parseHex4(cur+2)` reads were guarded behind `cur+6 <= end` via `&&` — so the honest call was P2, not the recommended P1. A true P1 is when the pointer is dereferenced OOB or drives an unguarded memcpy/index. Fix idiom: compute `end - cur >= N` (always well-defined). Also pickaxe (`git log -S`) the exact site to attribute the introducing PR — sibling sites in one function can have different provenance (one a fresh regression, one latent for years) ([[wiki/learnings/1782894644661-pointer-formation-ub-cur-n-only-compared-deref-sho.md]]).

## Cross-Reference and Re-Triage Scanning

When re-triaging an issue, run the cross-reference timeline plus per-PR `files` check — not just a keyword search ([[wiki/learnings/1781713625746-re-triage-rescan-live-cross-ref-timeline-for-newer.md]]). A PR can address an issue's artifacts under another issue's `Closes #` link: `gh api repos/.../issues/<n>/timeline --jq '.[]|select(.event=="cross-referenced")...'`. When a maintainer's own PR already touches the files, do NOT auto-fire the fixer; surface the PR, recommend, and pose the design decision.

Always check for a linked fix PR before flagging an issue as untriaged in daily/maintainer reports ([[wiki/learnings/1781511232421-daily-report-check-for-a-linked-fix-pr-before-flag.md]]). External contributors frequently file an issue and PR together; the issue may be unlabeled while the fix is deep in the human review pipeline.

Verify maintainer attributions in triage handoffs against `gh pr view <num> --json author,mergedBy,reviews` ([[wiki/learnings/1780073122582-verify-maintainer-attributions-in-triage-handoffs-.md]]). Bot triage comments have been observed asserting confident but wrong attribution (e.g. naming the wrong PR author). The actual coordination target is typically the issue assignee.

When a triage handoff names a contributor's existing PR as the fix, the triage outcome is **review/verify**, not implement from scratch ([[wiki/learnings/1780536698623-slang-csyonghe-files-per-hunk-issues-after-opening.md]]). csyonghe's workflow: open a bundle PR first, then file per-sub-bug issues linking back. Forward to fixer framed as REVIEW.

## Dependency and Functional Independence

When a fix appears to depend on an unmerged sibling PR, flag it as "possible, fixer to confirm" — not a hard blocker ([[wiki/learnings/1781186034425-slang-triage-verify-functional-independence-before.md]]). Often the same outcome is achievable with APIs already in master; the shared helper is a convenience. Also check the sibling PR's actual diff size against master before recommending a stack — a long-lived fork can be thousands of files diverged.

For dependency-bump PRs (SPIRV-Tools/Headers, glslang, slang-rhi pin), the decisive test for "did the bump cause this?" is cross-platform comparison ([[wiki/learnings/1782244083021-dependency-bump-pr-triage-cross-platform-check-pro.md]]). A failure on only one platform/API while the same suite passes on siblings indicates a flake/infra issue, not a bump regression.

## Failing Checks, Fork Permissions, and CI Mechanics

On fork-based PRs, separate the *failing check* from the *actual merge blocker* ([[wiki/learnings/1780903795100-failing-check-real-blocker-on-fork-based-prs-triag.md]]). Check fork permissions first (`gh api repos/<fork-owner>/<repo> --jq .permissions` and `maintainerCanModify`). If the binding blocker is human-owned AND humans are engaged, default to watch-only.

For off-repo triage of slang-rhi issues from the slang-triager container: anonymous clone works (public repo), but GH_TOKEN may be invalid for write operations ([[wiki/learnings/1780307950462-slang-rhi-off-repo-triage-anonymous-clone-works-gh.md]]). Report the posting blocker to the parent rather than attempting a write with a broken token.

Falcor CI tracking issues opened by `jkiviluoto-nv` are self-assigned CI-infrastructure work, not compiler bugs ([[wiki/learnings/1782222346038-falcor-ci-tracking-issues-from-jkiviluoto-nv-park-.md]]). Park at triaged; do NOT forward to slang-fixer. Still post a verified 5-bullet (value: cross-linking the Falcor-CI family). The Falcor-CI improvement family: #11495 → #11600 → #9219, #9228, #11703.

The Falcor YML 3-file refactor (#11600) requires build-flag reconciliation — the two existing falcor workflows produce different cmake-flag artifacts ([[wiki/learnings/1781365729972-slang-11600-falcor-yml-3-file-refactor-triage-desi.md]]). The required-check aggregator job key must be exactly `check-falcor` (kebab-case), and the dispatcher must add `merge_group: types:[checks_requested]` to avoid deadlocking the merge queue. Bot cannot push `.github/workflows/*` — deliver as maintainer-applied patch.

## Subagent Typing for Read-Only Steps

For read-only recall/scan sub-steps (scanning the learnings index, exploring code), use `subagent_type="Explore"` ([[wiki/learnings/1782152490395-don-t-fork-omit-subagent-type-for-read-only-recall.md]]). Omitting `subagent_type` creates a fork that inherits the full conversation context including AUTO-ROUTE directives; the fork may execute the entire triage workflow independently (post a duplicate GitHub comment, re-apply labels, dispatch a duplicate fixer handoff). If a general fork must be used, add an explicit READ-ONLY guard at the top of the prompt.

## Contributor PR Combined Reviews and Echo Loops

A combined `/slang-pr-review` handoff to the fixer for an external contributor's PR is advisory, not a fix task ([[wiki/learnings/1782719999000-slang-fixer-a-contributor-pr-combined-review-is-ad.md]]). Make no code change, make no GitHub post; a take-over needs explicit operator authorization arriving via the parent edge. The reviewer's `send_file(to="slang-fixer")` fan-out mints a new a2a wiring with `engage_mode=always`, which wakes a taskless fixer session repeatedly. Do NOT reply — every reply perpetuates the loop. Use `ask_user_question` to reach the operator; default to "leave with author" on timeout.

The root fix for the reviewer-fixer echo loop is **deleting the wiring** (`ncl wirings delete <wiring-id>`) ([[wiki/learnings/1782720540038-reviewer-combined-review-fan-out-can-trigger-a-tas.md]]). A restart alone is insufficient because the always-engage wiring persists and re-establishes the loop on the next inbound. `ncl destinations remove` only severs outbound, not inbound re-wakes.

## Devin Review Done-Detector False Positives

`slang-pr-review-runner`'s `devin-fetch.sh` can declare completion while the middle-pane AI-analysis paragraph still shows `Generating...` ([[wiki/learnings/1779298338813-devin-review-done-detector-false-positives-on-all-.md]]). The right-rail `Analysis complete` status and flag toggle populate before the analysis paragraph hydrates. Fix: extend `DONE_EXPR` to check that the "Devin's AI analysis" heading is followed by a non-`Generating...` paragraph. When `devin-flags.md` shows the `## AI Analysis` as "Generating...", recover by driving `agent-browser` to open each flag panel and re-scrape the body text.

## Contradictions / Supersessions

- The "skip GitHub post on dev-authored design placeholders" rule is RETIRED; post a deferential artifact for all reportable chain states ([[wiki/learnings/1781137483321-superseded-skip-github-post-on-dev-authored-design.md]]).
- The "hold classification 5-bullet until terminal" rule ([[wiki/learnings/1781116432142-hold-interim-triage-classification-5-bullet-until-.md]]) was later consolidated into the full posting policy; the fixed-via-PR exception ([[wiki/learnings/1780769170857-triage-github-artifact-fixed-via-pr-exception-reso.md]]) superseded the strict "terminal only" framing toward "verified verdict posts, unless a non-draft PR with Closes #N already covers it."
- The "fixers must not self-flip PRs" rule ([[wiki/learnings/1782464090006-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md]]) was corrected by ([[wiki/learnings/1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md]]): the bot never self-flipped; a maintainer did — VERIFY THE ACTOR before directing a revert.

---
**Source learnings (32):**
- [[wiki/learnings/1778749638138-slang-fixer-tools-gfx-is-legacy-code-paralleling-s.md]] — tools/gfx/ is legacy code paralleling slang-rhi
- [[wiki/learnings/1779298338813-devin-review-done-detector-false-positives-on-all-.md]] — Devin Review done-detector false positives
- [[wiki/learnings/1780064743810-verify-discovery-and-resolution-separately-in-pars.md]] — Verify discovery and resolution separately in parser-ambiguity triage
- [[wiki/learnings/1780073122582-verify-maintainer-attributions-in-triage-handoffs-.md]] — Verify maintainer attributions in triage handoffs
- [[wiki/learnings/1780307950462-slang-rhi-off-repo-triage-anonymous-clone-works-gh.md]] — slang-rhi off-repo triage: anonymous clone works, GH_TOKEN invalid
- [[wiki/learnings/1780357449295-slang-fixer-pr-push-szihs-fork-master-is-stale-div.md]] — slang-fixer PR push: szihs fork master is stale/divergent
- [[wiki/learnings/1780536698623-slang-csyonghe-files-per-hunk-issues-after-opening.md]] — csyonghe files per-hunk issues after opening bundle PR
- [[wiki/learnings/1780562553886-fixer-prs-must-use-a-closes-fixes-n-closing-keywor.md]] — Fixer PRs must use a Closes/Fixes #N closing keyword
- [[wiki/learnings/1780685454567-slang-fixer-can-push-fix-branches-direct-to-origin.md]] — slang-fixer can push fix/ branches direct to origin
- [[wiki/learnings/1780768870271-check-for-existing-bot-comment-before-posting-gith.md]] — Check for existing bot comment before posting GitHub triage artifact
- [[wiki/learnings/1780769170857-triage-github-artifact-fixed-via-pr-exception-reso.md]] — Triage + GitHub artifact: fixed-via-PR exception
- [[wiki/learnings/1780903795100-failing-check-real-blocker-on-fork-based-prs-triag.md]] — Failing check ≠ real blocker on fork-based PRs
- [[wiki/learnings/1781008579138-slang-triage-labeling-issue-type-and-reproducer-re.md]] — Slang triage: labeling, Issue Type, and reproducer-request rules
- [[wiki/learnings/1781116432142-hold-interim-triage-classification-5-bullet-until-.md]] — Hold interim triage classification 5-bullet until terminal
- [[wiki/learnings/1781137483321-superseded-skip-github-post-on-dev-authored-design.md]] — SUPERSEDED: skip GitHub post on dev-authored design placeholder
- [[wiki/learnings/1781186034425-slang-triage-verify-functional-independence-before.md]] — slang triage: verify functional independence before declaring dependency
- [[wiki/learnings/1781266520028-triage-when-to-post-a-5-bullet-vs-stand-down-on-a-.md]] — Triage: when to POST a 5-bullet vs STAND DOWN
- [[wiki/learnings/1781365729972-slang-11600-falcor-yml-3-file-refactor-triage-desi.md]] — slang#11600 falcor YML 3-file refactor triage design notes
- [[wiki/learnings/1781511232421-daily-report-check-for-a-linked-fix-pr-before-flag.md]] — Daily report: check for a linked fix PR before flagging as untriaged
- [[wiki/learnings/1781713625746-re-triage-rescan-live-cross-ref-timeline-for-newer.md]] — Re-triage: rescan live cross-ref timeline for newer maintainer PRs
- [[wiki/learnings/1781724696064-verify-triage-root-cause-empirically-slang-10027-v.md]] — Verify triage root cause empirically
- [[wiki/learnings/1781724956224-don-t-promote-a-hedged-hypothesis-to-root-cause-tr.md]] — Don't promote a hedged hypothesis to "root cause (traced)"
- [[wiki/learnings/1781775592867-a-fresh-unblock-handoff-can-contradict-a-prior-tri.md]] — A fresh unblock handoff can contradict a prior triager ruling
- [[wiki/learnings/1782152490395-don-t-fork-omit-subagent-type-for-read-only-recall.md]] — Don't fork (omit subagent_type) for read-only recall/scan steps
- [[wiki/learnings/1782222346038-falcor-ci-tracking-issues-from-jkiviluoto-nv-park-.md]] — Falcor CI tracking issues from jkiviluoto-nv: park at triaged
- [[wiki/learnings/1782244083021-dependency-bump-pr-triage-cross-platform-check-pro.md]] — Dependency-bump PR triage: cross-platform check proves innocence
- [[wiki/learnings/1782390307922-verify-triage-memo-file-line-claims-about-adjacent.md]] — Verify triage-memo file:line claims about adjacent code
- [[wiki/learnings/1782408832985-triage-deepwiki-concurrency-premises-can-lag-head-.md]] — Triage/DeepWiki concurrency premises can lag HEAD
- [[wiki/learnings/1782464090006-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md]] — Fixers must not self-flip PRs to ready (original)
- [[wiki/learnings/1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md]] — Fixers must not self-flip PRs to ready (corrected: verify actor)
- [[wiki/learnings/1782719999000-slang-fixer-a-contributor-pr-combined-review-is-ad.md]] — slang-fixer: contributor PR combined review is advisory
- [[wiki/learnings/1782720540038-reviewer-combined-review-fan-out-can-trigger-a-tas.md]] — Reviewer combined-review fan-out can trigger a taskless-fixer echo loop
- [[wiki/learnings/1782894644661-pointer-formation-ub-cur-n-only-compared-deref-sho.md]] — Pointer-formation UB (compare-only, deref short-circuit-guarded) is P2 UBSan finding, not P1 crash

_Catalog: [[wiki/index.md]]_
