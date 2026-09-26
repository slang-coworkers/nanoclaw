---
title: "Slang PR Process, Maintainer Workflow, and Issue Lifecycle"
type: concept
group: slang-grab-bag
tags: [maintainer, PR-process, merge-queue, CI, GitHub-Actions, issue-lifecycle, bot-permissions, regression-verification, declined-issues, superseded-PRs]
source_count: 38
---

# Slang PR Process, Maintainer Workflow, and Issue Lifecycle

## TL;DR

- The on-call Slang maintainer rotates ~biweekly: never hardcode; look it up live, and reconcile the rotation by searching the channel for the *topic*, not a reply to the bot.
- An internal "APPROVE-clean" verdict is invisible on GitHub; reconcile every handoff against live PR state.
- `mergeable_state` says THAT a requirement is unmet, never WHICH; `mergeable=true` is not `reviewDecision=APPROVED`. Read `requested_reviewers` + `/reviews`: an approval counts only if its `commit_id == head`, and `COMMENTED` is not a verdict.
- Never push after a maintainer APPROVES unless required: any new head commit (even a comment reword) auto-dismisses the approval. `behind` is not a rebase cue. Re-verify `reviewDecision` at HEAD before reporting "approved."
- Verify a merge by CONTENT, not ancestry: a squash rewrites SHAs, so `--is-ancestor` gives a false "not merged." Issue auto-close is eventually consistent; a blocked verification call means UNKNOWN, not UNCHANGED.
- `push:false` in a bot token's `.permissions` is the normal App-token shape, not a denial; only an actual `git push` is authoritative.
- Required status-check names equal the kebab-case job key. A `failed_checks` merge-queue eviction CLEARS auto-merge, so a post-eviction `autoMergeRequest=null` means manual requeue, not self-recovery.
- Verify a bug against checkout HEAD, not a stale `build/Release/bin/slangc`; an author-date inside a [good,bad] window does not prove a commit is in a release (check ancestry).
- Capture BOTH `.id` and `.html_url` from ONE `gh api … comments POST` (a second POST duplicates the comment); re-push after the LAST amend BEFORE `gh pr create`, because the PR and CI run the *remote* branch.
- Open bot PRs with no `--assignee`/`--reviewer`, even when a maintainer asks; @-mention them in the description instead.
- For a codegen asymmetry, lift the BAD leg to the good one (#12004); for a doc-vs-behavior mismatch, measure the behavior fix's cost before assuming code is the real fix (#11682).
- Source comments describe the code as-is: no change-history narration, no PR/issue pointers.
- Re-check `gh pr list` after a long build (the reporter may have self-fixed).

Companion: [[wiki/concepts/slang-pr-maintainer-scope-and-evidence.md]] (draft-PR footprint, maintainer-decision reversals).

## Maintainer Identity and Rotation

The on-call Slang duty maintainer rotates on a roughly two-week cadence and can be reassigned ad hoc, so any routing, @-mention, or escalation uses a live lookup via the Slang Maintainer agent ([maintainer is dynamic](../learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md)). `tfoley` in Slang TODO comments is Theresa Foley ("Tess"), not "Tim Foley", per the repo's `.mailmap` ([tfoley is Theresa Foley](../learnings/1777487718343-slang-compiler-tess-foley-name.md)).

The recurring "who is the next Slang Maintainer?" prompt in `#slang-committers` (`1352357976878481468`) has gone unanswered *as a reply* every cycle since 2026-06-22; humans reveal the maintainer in passing instead (2026-07-27, shannonwoods_90576: "`<@1306357396771311747>` for visibility as current maintainer" in an unrelated thread, answering for the 2026-07-21 → 2026-08-03 term). The PR-escalation report switched from handles (`<@jkwaknv>`) to raw IDs on 2026-07-23; resolve ID → handle by reverse lookup in `/workspace/agent/memory/github-to-discord.json` (GitHub username → Discord ID), cross-checking the person's PR set across old and new reports. For any "did a human answer our bot?" reconciliation, search the channel for the topic, not for a reply to your message ([rotation from indirect evidence](../learnings/1785758534668-reconciling-the-slang-maintainer-rotation-from-ind.md)).

## Reading Live PR State

An internal "APPROVE-clean" verdict is not visible on GitHub; before calling a handoff merge-ready, reconcile draft status, CI, review decision, and unresolved threads on the live PR ([handoff: verify live PR state](../learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md)).

**`mergeable_state` is one opaque enum.** On #12148 CI was fully green and a maintainer `APPROVED` at HEAD, yet the PR stayed `mergeable: true` + `mergeable_state: "blocked"`: the real gate was an unmet review requirement, with two reviewers in `requested_reviewers` and no submitted review. Report the observation, name candidate blockers, and flag blind spots rather than asserting a cause ("awaiting a merge click" and "awaiting a second reviewer" need different follow-ups). Read `--jq '{mergeable, mergeable_state, requested_reviewers:[.requested_reviewers[].login]}'`, then `pulls/<n>/reviews --jq '.[] | "\(.user.login) | \(.state) | \(.commit_id)"'`; a requested name with no APPROVED/CHANGES_REQUESTED review is outstanding, and `COMMENTED` does not discharge it. Check-runs are cumulative across runs, so filter for conclusions other than success/skipped/neutral rather than trusting an aggregate badge. Say which token you used: with a GitHub App/bot token, `GET /repos/*/branches/<b>/protection` returns 403 and GraphQL `reviewDecision` returns 401, while REST `requested_reviewers` is readable. Read the field that would change if your hypothesis were false ([mergeable_state: THAT, not WHICH](../learnings/1785791831427-mergeable-state-tells-you-that-a-requirement-is-un.md)).

`mergeable=true` (no conflicts) is also not `reviewDecision=APPROVED`. On #12935 (offered as the fix for #13259) a "MERGEABLE since 09-16" framing hid an unresolved CHANGES_REQUESTED (does `return none()` merely relocate the ICE?) that #13259's requested test targeted. Read `gh pr view --json reviewDecision,reviews` before framing a PR as idle; "repro compiles + validates" is not the reviewer's bar, and a PR with an open soundness concern does not claim `Closes #X` ([verify review state before "idle-mergeable"](../learnings/1790310304171-verify-a-pr-s-actual-review-state-before-framing-i.md)).

**Approvals and pushes.** Any new head commit auto-dismisses an approval (`APPROVED` → `REVIEW_REQUIRED`). On #12034 a comment-only reword (`a0635cc612`, 16:50) dismissed jkwak-work's 16:46 approval of `bdf2c2a2d0` for zero gain; #12009 hit the same pattern. Push after an approval only when strictly required (a requested code change or real CI fix); when the maintainer requested a cosmetic change, say applying it dismisses their approval and let them decide. "Update branch" and body edits do not dismiss; only a new head commit does. Likewise `mergeable_state=behind` on an approved, conflict-free PR is benign; the maintainer resolves it at merge ([Closes #N / draft footprint](../learnings/1785751816891-closes-n-does-not-excuse-an-issue-footprint-while-.md)). Both were relayed as "approved, awaiting merge" while `REVIEW_REQUIRED`, so verify at HEAD first:

```
gh pr view <n> -R <owner>/<repo> --json reviewDecision,headRefOid,reviews --jq '{decision:.reviewDecision, head:.headRefOid, approvals:[.reviews[]|select(.state=="APPROVED")|{who:.author.login, commit:.commit_id}]}'
```

"Approved at HEAD" requires `decision=="APPROVED"` and an approval whose `commit == head`; supervisors check this before recording a fixer's "approved" as terminal. Re-requesting review is a `requested_reviewers` write forbidden by the dev-team operator directive, so surface that conflict to the parent (scoped override, or a no-@ "ready for re-approval" comment) ([never push after approval; re-verify at HEAD](../learnings/1784048061144-never-push-after-a-maintainer-approval-unless-requ.md), [comment-only commit dismisses approval](../learnings/1784048274524-never-push-after-a-maintainer-approves-even-a-comm.md)).

## Verifying a Merge

`git merge-base --is-ancestor <branch-sha> origin/main` returns non-zero for a fully merged change when the merge was a squash: on slang-rhi#805 → PR #806, branch commit `f3b9f02` was squashed into `57b5dec`, and `--is-ancestor` said NO while `README.md` at `origin/main` carried the fix. Verify by content: `git show origin/main:path/to/file` after a fetch; check merge shape with `git rev-list --parents -n 1 <sha>` (1 parent = squash or fast-forward, 2 = true merge); confirm scope with `git show --stat <sha>`. `--is-ancestor` stays correct for "was commit X in the build that reproduced this bug?", wrong only for "did my branch land?" under squash. Issue closure is eventually consistent with the merge, so a read at `merged_at + 0s` can see `state: open`; re-read after a beat (there `Closes #805` fired one second after merge). A blocked verification call (here, by a critique gate) means UNKNOWN, not UNCHANGED; a git-only fallback cannot answer issue/review state. Publish at the granularity actually verified, attribute causes only to whoever could observe them, and demand more evidence for an exculpatory explanation, which draws less scrutiny ([squash breaks ancestry checks](../learnings/1785780766923-squash-merge-breaks-ancestry-checks-verify-a-merge.md)).

## CI: Status Checks, Merge Queue, Falcor Workflows

Required status-check names in `shader-slang/slang` equal the job key (kebab-case, no separate `name:`), so renaming a job key requires updating branch protection; workflow-file changes need a patch handoff because the bot lacks `workflows` permission ([status check name = job key](../learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md)).

Investigate evictions via `merge_group` workflow runs, which age out quickly; a batch failure evicts the whole batch, and most evictions are Falcor timeout flakes, not regressions ([merge-queue evictions](../learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md)). A missing-default-constructor break (shader-coverage `vkdemo::Context`) is all-platform, not MSVC-only, and evicts unrelated PRs ([vkdemo break is all-platform](../learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md)). A `failed_checks` eviction clears auto-merge, so a post-eviction `autoMergeRequest = null` does not mean it was never on, and the PR will not requeue itself. The bot cannot enqueue (#11675 "not authorized to push to queue branch"), so a green+approved bot PR evicted by a flake is the manual-requeue pattern (#12122/#12151/#12152; #12289 after the #12145 GBufferRTTexGrads_d3d12 flake). Read the timeline (`AutoMergeEnabledEvent` then `RemovedFromMergeQueueEvent`) rather than the bare null; HOLD while a hand-queuer is engaged, but do not call it self-recovering ([eviction clears auto-merge](../learnings/1785485875128-merge-queue-failed-checks-eviction-clears-auto-mer.md)).

The Falcor 3-file YML refactor (dispatcher + build + test reusable workflows) involves per-test-type artifact paths, `merge_group` triggers, and job-key naming for required checks ([Falcor YML refactor gotchas](../learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md)). `FALCOR_LOCAL_SLANG` is a relative, per-config build dir (not absolute), and building Falcor from source needs Slang built with GFX enabled (PR #11602) ([FALCOR_LOCAL_SLANG details](../learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md)).

## Bot GitHub Writes

`nv-slang-bot` can push and open PRs on `shader-slang/slang-rhi` and the other shader-slang repos; `push:false` in a `gh api` `.permissions` probe is the normal App-token shape, and only an actual `git push` is authoritative ([slang-rhi is bot-writable](../learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md)).

**Post a comment once.** Capture both `.id` and `.html_url` from a single `gh api .../comments --method POST`; posting again with a different `--jq` creates a duplicate (#12110: comments 4976372131 + 4976372230). Use `RESP=$(jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/$N/comments" --method POST --input -)` and read both fields from `$RESP` (the triage workflow's snippet stores only `.id`). After a POST, count the comments and delete a duplicate you authored this turn ([POST a comment once](../learnings/1784083867185-never-run-the-gh-post-comment-command-twice-to-cap.md)).

**Re-push before `gh pr create`.** The PR, the reviewer's view, and CI all run the remote branch, not local HEAD. On slang#11983 (PR #12148) four local amends were never re-pushed, so the PR opened on the stale first commit and a `github.ci_failed` webhook (`head_sha=1787e466d8`) failed on bugs already fixed. After the last amend, run `git push --force origin fix/issue-<n>` (only when `git log origin/master..origin/fix/issue-<n>` shows solely bot-authored commits) and check that `git rev-parse HEAD` equals `origin/fix/issue-<n>`. A `ci_failed` webhook whose `head_sha` differs from local HEAD signals a stale remote; compare `gh pr view <n> --json headRefOid` first. Re-dispatch CI with `gh workflow run ci.yml --ref fix/issue-<n>`, since a push does not auto-run CI on draft PRs ([re-push before gh pr create](../learnings/1784316959883-re-push-after-every-amend-before-gh-pr-create-else.md)).

**No assignee or reviewer on bot PRs.** When jkwak asked the bot on slang#11967 to "make a PR and assign it to me," the ruling was to open the draft with no `--assignee` and no `--reviewer`. The standing operator/dev-team [MUST NOT] on bot assignee/reviewer mutations (naming a maintainer reads as spam; CODEOWNERS auto-routes shader-slang/dev on ready-flip) outranks a maintainer's mechanical request; a triager or fixer is a peer and neither overrides it nor escalates to lift it. The maintainer's intent is met by @-mentioning them in the description prose. The gate applies even at PR-open time, separately from the operator-gated `gh pr ready`/`gh pr merge` writes (comments and labels are free); the fixer correctly bounced the question to the triager edge ([no-assignee gate beats "assign to me"](../learnings/1784277158125-maintainer-assign-the-pr-to-me-loses-to-standing-o.md)). `Closes/Fixes #N` stays off a draft PR, and a `Closes #N` does not excuse omitting the issue footprint while the PR is a draft; a discharged blocker line is actively wrong and gets PATCHed in place, and a create-only token asks the owning tier (slang-rhi#805 → #806).

## Regression Verification Discipline

Verifying with `build/Release/bin/slangc` is not verifying checkout HEAD; confirm the binary version string and checkout ancestry before claiming a repro on current code (slang#11483's crash was a stale pre-#11211 build) ([stale build, not master](../learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md)). An author-date inside a [good, bad] window does not put a commit in a given release; check with `git merge-base --is-ancestor` (seen on a precompiled `.slang-module` import emitting location-less diagnostics) ([verify commit-vs-tag ancestry](../learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md)). The #11483 reporter was already on a release containing the #11211 crash fix, so the wrong-data symptom is a distinct defect; a GPU-free spirv-val pass cannot refute a runtime/driver symptom, so the issue stays open for hardware retest ([#11483 wrong-data is distinct](../learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md)). For coverage-manifest bugs, read the association-copy sites and consumer validity guards before accepting a "not propagated" root cause; on #11629 HEAD contradicted it ([#11629 root cause contradicted at HEAD](../learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md)). A P0 merge-queue stopper can be self-fixed mid-build (#11814: the reporter merged an identical #11817 ~14h into our debug build), so re-check `gh pr list` and the linked-PR timeline after the build, before opening a PR ([P0 stoppers self-fixed mid-build](../learnings/1782867800939-p0-merge-queue-stoppers-can-be-self-fixed-mid-buil.md)).

## Fix-Direction Discipline

For a codegen asymmetry, converge on the good leg even when lowering it is the smaller diff. On slang#12004 (sampler-vs-texture `[noinline]` SPIR-V param asymmetry), PR #12027's Approach A (specialize scalar `SamplerState` params like textures so both pass by bindless index) was closed unmerged: *"we don't want to make changes to the SamplerState side. Passing the sampler-state as descriptors should be considered downgrading."* The by-value `OpTypeSampler` is the desired form; the texture's by-index reload is the #3252 old-driver workaround. The triage listed Approach B (revert the texture workaround so both pass by value) but recommended A as fastest, under-weighting that A is itself a downgrade. B is not authorized ("no plan to remove the workaround" unless proven driver-safe); relaxing the #3252 invariant is maintainer-owned, so B is not reopened unilaterally. Triage asks which leg is the better codegen and defaults toward it, flagging the risk of touching the older invariant ([#12004 Approach A rejected](../learnings/1783635981424-slang-12004-outcome-approach-a-rejected-as-downgra.md)).

A doc-vs-behavior mismatch can be fixed on either side, so measure the behavior fix's cost (test churn, output changes, optimization-shape effects) before recommending it. On #11682 (`slangc -g0` help text vs. still-emitted `OpSource`/`OpName`), a `None→Minimal` default flip defeated front-end optimizations suite-wide and gating names on `None` broke ~273 tests, steering the maintainer to a one-line docs-only fix (merged PR #12201); surfacing that blast radius is the triager's key contribution ([doc-vs-behavior: measure the cost](../learnings/1784844793184-a-doc-vs-behavior-bug-can-fix-either-side-measure-.md)).

## Code Comments Describe the Code As-Is

shader-slang maintainers (pdeayton-nv, PR #12148 review) ban two comment phrasings: change-history narration ("unchanged from before this change", "previously we…", "now we…") and PR/issue pointers ("see the issue linked in the PR", "deferred to a follow-up", "pending #12150"). Both rot at merge. When review changes scope, comments state the resulting behavior ("null here → emitter uses the module-global scope"); tracking references stay in the PR body or commit message. Before pushing a review fix, grep the added comments for `before this change|unchanged from|previously|see .* issue|pending #|deferred to` ([comments describe code as-is](../learnings/1784573605212-code-comments-must-describe-the-code-as-is-never-c.md)).

## Triage Boundaries and Park Lifecycles

A rename/branding request has no engineering surface: classify as feature request and park at triage, with no fixer and no self-close; it is a governance call ([rename is governance](../learnings/1783935538903-triage-of-rename-branding-requests-governance-not-.md)). Docs for a compiler-limitation bug belong in the compiler repo: the maintainer closed SlangPy docs PR #1060, redirecting it to the Slang docs ([docs go in the compiler repo](../learnings/1783943839130-docs-for-a-compiler-limitation-bug-belong-in-the-c.md)). On slang#12058 the maintainer landed the ASan fix in their own PR while our fixer was auth-down, validating the triage; a stalled fixer's late draft gets reaped ([#12058 validated by maintainer fix](../learnings/1783977766628-triage-validated-by-maintainer-s-own-merged-fix-a-.md)). A park is not a dead end: slang#12054's self-fix park flipped to a maintainer-authorized bot draft that merged ([#12054 park → bot draft shipped](../learnings/1783981181191-slang-12054-shipped-park-for-self-fix-that-flipped.md)).

## Declined Issues, Reversals, and Superseded PRs

- **#11568 (ResourceDescriptorHeap/SamplerDescriptorHeap)**: initially declined by jkwak-work in favor of `DescriptorHandle<T>`, later reversed: the maintainer team is implementing csyonghe's `UntypedResourceHandle`/`UntypedSamplerHandle` proxy types that implicit-cast to resource types ([#11568 reversed](../learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md)). The unified descriptor-heap stride work (#11718, PR #11723) changes only SPIR-V emit/CLI/diagnostics and does not remove the E39999 front-end blocker ([#11718 is backend-only](../learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md)).
- **#11599 (clip-space Z-remap)**: declined as outside Slang's scope ([#11599 declined](../learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md)); a later GLSL-only scope got `CHANGES_REQUESTED` meaning "won't merge to ToT": a cherry-pickable reference PR, not acceptance ([#11599 reference PR](../learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md)).
- **#11681 (DescriptorHandle `_coerce` guard)**: the maintainer preferred removing the dubious `ParameterGroupType` guard entirely over a DescriptorHandle carve-out ([#11681 remove the guard](../learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md)).

## Discord Support Bot Routing

`slang-discord-support` writes only to summon threads in #slang-support/#slang-support-bot; source channels like #slang-discussion are read-only, so answers there come from a human or a summon thread ([support bot posts only to summon threads](../learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md)).

**Source learnings (38):**
- [verify review state before "idle-mergeable"](../learnings/1790310304171-verify-a-pr-s-actual-review-state-before-framing-i.md) — `mergeable=true` is not APPROVED (#12935).
- [Closes #N / draft footprint](../learnings/1785751816891-closes-n-does-not-excuse-an-issue-footprint-while-.md) — draft PR still needs an issue footprint; `behind` is no rebase cue.
- [rotation from indirect evidence](../learnings/1785758534668-reconciling-the-slang-maintainer-rotation-from-ind.md) — search for the topic; ID→handle reverse lookup.
- [mergeable_state: THAT, not WHICH](../learnings/1785791831427-mergeable-state-tells-you-that-a-requirement-is-un.md) — #12148 unmet review requirement; bot-token blind spots.
- [squash breaks ancestry checks](../learnings/1785780766923-squash-merge-breaks-ancestry-checks-verify-a-merge.md) — verify by content; blocked call = UNKNOWN.
- [comments describe code as-is](../learnings/1784573605212-code-comments-must-describe-the-code-as-is-never-c.md) — no change-history or PR/issue pointers.
- [tfoley is Theresa Foley](../learnings/1777487718343-slang-compiler-tess-foley-name.md) — per `.mailmap`.
- [handoff: verify live PR state](../learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md) — internal verdicts are invisible on GitHub.
- [verify commit-vs-tag ancestry](../learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md) — author-date is not release membership.
- [stale build, not master](../learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md) — #11483 crash was a pre-#11211 binary.
- [#11483 wrong-data is distinct](../learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md) — runtime symptom stays open.
- [slang-rhi is bot-writable](../learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md) — `push:false` is not a denial.
- [support bot posts only to summon threads](../learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md) — source channels are read-only.
- [vkdemo break is all-platform](../learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md) — not MSVC-only.
- [status check name = job key](../learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md) — kebab-case; bot lacks `workflows`.
- [Falcor YML refactor gotchas](../learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md) — 3-file workflow.
- [FALCOR_LOCAL_SLANG details](../learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md) — relative per-config dir.
- [#11629 root cause contradicted at HEAD](../learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md) — check copy sites and guards.
- [maintainer is dynamic](../learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md) — never hardcode.
- [#11681 remove the guard](../learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md) — removal preferred over carve-out.
- [#11599 declined, companion](../learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md) — duplicate decline record.
- [#11718 is backend-only](../learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md) — E39999 blocker remains.
- [merge-queue evictions](../learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md) — merge_group runs; Falcor flakes.
- [#11568 reversed](../learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md) — UntypedResourceHandle proxy design.
- [#11599 reference PR](../learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md) — won't merge to ToT.
- [P0 stoppers self-fixed mid-build](../learnings/1782867800939-p0-merge-queue-stoppers-can-be-self-fixed-mid-buil.md) — re-check gh pr list.
- [#12004 Approach A rejected](../learnings/1783635981424-slang-12004-outcome-approach-a-rejected-as-downgra.md) — sampler-as-descriptor downgrades.
- [rename is governance](../learnings/1783935538903-triage-of-rename-branding-requests-governance-not-.md) — park at triage; no fixer.
- [docs go in the compiler repo](../learnings/1783943839130-docs-for-a-compiler-limitation-bug-belong-in-the-c.md) — SlangPy PR #1060 redirected.
- [#12058 validated by maintainer fix](../learnings/1783977766628-triage-validated-by-maintainer-s-own-merged-fix-a-.md) — stalled fixer's late draft reaped.
- [#12054 park → bot draft shipped](../learnings/1783981181191-slang-12054-shipped-park-for-self-fix-that-flipped.md) — park is not a dead end.
- [never push after approval; re-verify at HEAD](../learnings/1784048061144-never-push-after-a-maintainer-approval-unless-requ.md) — new head commit dismisses it.
- [comment-only commit dismisses approval](../learnings/1784048274524-never-push-after-a-maintainer-approves-even-a-comm.md) — #12034 reword lost the approval.
- [POST a comment once](../learnings/1784083867185-never-run-the-gh-post-comment-command-twice-to-cap.md) — id and url from one response.
- [re-push before gh pr create](../learnings/1784316959883-re-push-after-every-amend-before-gh-pr-create-else.md) — PR/CI run the remote branch.
- [no-assignee gate beats "assign to me"](../learnings/1784277158125-maintainer-assign-the-pr-to-me-loses-to-standing-o.md) — @-mention in the description instead.
- [doc-vs-behavior: measure the cost](../learnings/1784844793184-a-doc-vs-behavior-bug-can-fix-either-side-measure-.md) — #11682 chose docs-only.
- [eviction clears auto-merge](../learnings/1785485875128-merge-queue-failed-checks-eviction-clears-auto-mer.md) — manual requeue.

_Catalog: [[wiki/index.md]]_
